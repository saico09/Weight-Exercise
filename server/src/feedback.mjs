import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ApiError, email, input, keyedHash, object, safeEqual, tokenHash } from './security.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const FIELDS = new Set(['challengeId', 'challengeToken', 'answer', 'message', 'email', 'website', 'edition', 'appVersion']);
const unavailable = () => new ApiError(503, 'feedback_unavailable', 'No pudimos confirmar el envío de tu sugerencia. Inténtalo más tarde.');
const invalidChallenge = () => new ApiError(409, 'feedback_challenge', 'La pregunta expiró o ya se utilizó. Solicita una nueva.');

export function feedbackRecipient(env = process.env) {
  if (!env.FEEDBACK_TO?.trim()) return null;
  try { return email(env.FEEDBACK_TO); } catch { throw new Error('FEEDBACK_TO must contain one valid recipient email address.'); }
}
export function validateFeedback(payload) {
  input(object(payload) && Object.keys(payload).every(key => FIELDS.has(key)));
  input(payload.website === undefined || typeof payload.website === 'string' && payload.website.length <= 200);
  if (payload.website) return { honeypot: true };
  input(typeof payload.message === 'string' && payload.message.length <= 2000, 'Escribe una sugerencia de 20 a 2000 caracteres.');
  const message = payload.message.normalize('NFC').trim();
  input(message.length >= 20 && message.length <= 2000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message), 'Escribe una sugerencia de 20 a 2000 caracteres.');
  input(['basic', 'pro'].includes(payload.edition));
  input(typeof payload.appVersion === 'string' && payload.appVersion.length <= 32 && /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[A-Za-z0-9.-]{1,16})?$/.test(payload.appVersion));
  const replyEmail = payload.email === undefined || payload.email === '' ? null : email(payload.email);
  input(typeof payload.challengeId === 'string' && UUID.test(payload.challengeId));
  input(typeof payload.challengeToken === 'string' && /^[A-Za-z0-9_-]{43}\.[a-f0-9]{64}$/.test(payload.challengeToken));
  input(typeof payload.answer === 'string' && /^\d{1,2}$/.test(payload.answer.trim()) || Number.isInteger(payload.answer) && payload.answer >= 0 && payload.answer <= 99, 'Responde la pregunta de verificación.');
  return { honeypot: false, message, replyEmail, edition: payload.edition, appVersion: payload.appVersion, id: payload.challengeId, token: payload.challengeToken, answer: String(Number(payload.answer)) };
}

export function createFeedbackService({ pool, transaction, mailer, secret, recipient, limit, now = Date.now }) {
  if (typeof secret !== 'string' || secret.length < 64) throw new Error('Feedback requires the configured server authentication secret.');
  const destination = recipient ? email(recipient) : null;
  const hash = (...values) => keyedHash(secret, 'feedback-v1', ...values);
  const ipHash = ip => hash('ip', ip);
  let sending = 0;
  const configured = Boolean(destination);
  async function challenge(ip) {
    if (!configured) throw unavailable();
    await limit(`feedback-challenge:${ip}`, 10, 900);
    await limit('feedback-challenge:global', 120, 3600);
    const id = randomUUID(); const nonce = randomBytes(32).toString('base64url');
    const token = `${nonce}.${hash('token', id, nonce, ipHash(ip))}`;
    const left = randomInt(1, 10), right = randomInt(1, 10);
    const issued = new Date(now()); const expires = new Date(issued.getTime() + 600000);
    await pool.query('INSERT INTO feedback_challenges(id,token_hash,ip_hash,answer_hash,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6)', [id, tokenHash(token), ipHash(ip), hash('answer', id, String(left + right)), issued, expires]);
    return { id, token, question: `${left} + ${right} = ?`, expiresAt: expires.toISOString(), minWaitMs: 2000 };
  }
  async function send(ip, payload) {
    if (!configured) throw unavailable();
    await limit(`feedback-post:${ip}`, 15, 900);
    const value = validateFeedback(payload);
    // Quietly discard submissions in the hidden field, without sending any mail.
    if (value.honeypot) return { status: 202, body: { ok: true } };
    const [nonce, signature] = value.token.split('.');
    if (!safeEqual(signature, hash('token', value.id, nonce, ipHash(ip)))) throw invalidChallenge();
    // DELETE commits before answer/time checks or SMTP, so retries and concurrent
    // submissions can never reuse a challenge. Raw IPs and answers are not stored.
    const row = (await transaction(client => client.query('DELETE FROM feedback_challenges WHERE id=$1 AND token_hash=$2 AND ip_hash=$3 RETURNING *', [value.id, tokenHash(value.token), ipHash(ip)]))).rows[0];
    if (!row || new Date(row.expires_at).getTime() <= now()) throw invalidChallenge();
    if (now() - new Date(row.created_at).getTime() < 2000) throw new ApiError(400, 'feedback_too_fast', 'Espera un momento y solicita una nueva pregunta.');
    if (!safeEqual(row.answer_hash, hash('answer', value.id, value.answer))) throw new ApiError(400, 'feedback_answer', 'La respuesta no es correcta. Solicita una nueva pregunta.');
    await limit(`feedback-send:${ip}`, 5, 3600);
    await limit('feedback-send:global', 30, 3600);
    if (sending >= 2) throw unavailable();
    // Reserve before the next await: concurrent requests cannot all pass the cap.
    sending++;
    try {
      const digest = hash('message', value.message.normalize('NFKC').replace(/\s+/gu, ' ').toLowerCase());
      const reserved = await pool.query(`INSERT INTO feedback_dedup(message_hash,expires_at) VALUES($1,$2)
        ON CONFLICT(message_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at WHERE feedback_dedup.expires_at <= $3 RETURNING message_hash`, [digest, new Date(now() + 86400000), new Date(now())]);
      if (!reserved.rowCount) throw new ApiError(409, 'feedback_duplicate', 'Esta sugerencia ya se recibió recientemente. Gracias por compartirla.');
      try {
        await mailer.send({ to: { address: destination }, ...(value.replyEmail ? { replyTo: { address: value.replyEmail } } : {}),
          messageId: `<feedback-${value.id}@weight-exercise.local>`, subject: `Weight&Exercise · Sugerencia · ${value.edition.toUpperCase()}`,
          text: [`Nueva sugerencia de Weight&Exercise ${value.edition.toUpperCase()}`, `Versión declarada: ${value.appVersion}`, `Correo de respuesta (no verificado): ${value.replyEmail || 'No indicado'}`, '', value.message, '', 'Enviado desde el formulario de sugerencias. No se adjuntan registros ni datos del perfil.'].join('\n'),
        });
      } catch {
        // Keep the dedup reservation: a provider can accept DATA and lose the reply.
        // Replaying that ambiguous delivery could send duplicate messages.
        throw unavailable();
      }
      return { status: 200, body: { ok: true } };
    } finally { sending--; }
  }
  async function cleanup() {
    await pool.query('DELETE FROM feedback_challenges WHERE expires_at <= now()');
    await pool.query('DELETE FROM feedback_dedup WHERE expires_at <= now()');
  }
  return { configured, challenge, send, cleanup };
}
