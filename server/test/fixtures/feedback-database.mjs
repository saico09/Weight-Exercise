import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import pg from 'pg';
import { createFeedbackService } from '../src/feedback.mjs';

// This module is only run in a newly created disposable database. SMTP is never
// imported; a fake send() collects messages in memory and can simulate failure.
const pool = new pg.Pool({ max: 3 });
const secret = randomBytes(48).toString('hex');
const deliveries = []; const observedLimits = [];
let clock = Date.now(); let failMail = false; let holdMail = false; let activeMail = 0; let maximumMail = 0;
const releases = []; let enforceLimits = false;
const hash = value => createHmac('sha256', secret).update(value).digest('hex');
async function transaction(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function limit(key, maximum, seconds) {
  observedLimits.push([key, maximum, seconds]);
  if (!enforceLimits) return;
  const result = await pool.query(`INSERT INTO rate_limits(bucket_hash,count,expires_at) VALUES($1,1,now()+($2 * interval '1 second'))
    ON CONFLICT(bucket_hash) DO UPDATE SET count=CASE WHEN rate_limits.expires_at < now() THEN 1 ELSE rate_limits.count+1 END,
    expires_at=CASE WHEN rate_limits.expires_at < now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING count`, [hash(key), seconds]);
  if (result.rows[0].count > maximum) throw Object.assign(new Error('Rate limit'), { status: 429, code: 'rate_limited' });
}
const service = createFeedbackService({ pool, transaction, secret, recipient: 'inbox@example.test', limit, now: () => clock, mailer: { send: async message => {
  if (failMail) throw new Error('private SMTP diagnostic must never leave the server');
  deliveries.push(message); activeMail++; maximumMail = Math.max(maximumMail, activeMail);
  try { if (holdMail) await new Promise(resolve => releases.push(resolve)); } finally { activeMail--; }
} } });
const ip = '127.0.0.10';
async function begin(message = 'Me gustaría poder agrupar mis registros por semana.', address = ip, edition = 'basic') {
  const value = await service.challenge(address);
  assert.match(value.id, /^[a-f0-9-]{36}$/); assert.match(value.token, /^[A-Za-z0-9_-]{43}\.[a-f0-9]{64}$/);
  assert.equal(value.minWaitMs, 2000); assert.equal(Date.parse(value.expiresAt) - clock, 600000);
  const answer = value.question.match(/\d+/g).map(Number).reduce((a, b) => a + b, 0);
  return { challengeId: value.id, challengeToken: value.token, answer: String(answer), message, website: '', edition, appVersion: '0.8.6' };
}
const advance = () => { clock += 2100; };
async function expectError(code, action) { await assert.rejects(action, error => error.code === code); }
const sentCount = () => deliveries.length;
const waitUntil = async predicate => {
  for (let n = 0; n < 100; n++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail('Timed out waiting for concurrent fake mail');
};
try {
  const first = await begin(); advance(); first.email = 'Reply@Example.Test';
  await service.send(ip, first);
  assert.equal(sentCount(), 1); assert.deepEqual(deliveries[0].to, { address: 'inbox@example.test' });
  assert.deepEqual(deliveries[0].replyTo, { address: 'reply@example.test' });
  assert.equal(deliveries[0].html, undefined); assert.equal(deliveries[0].attachments, undefined);
  assert.equal(deliveries[0].cc, undefined); assert.equal(deliveries[0].bcc, undefined);
  assert.ok(deliveries[0].text.includes(first.message));
  await expectError('feedback_challenge', () => service.send(ip, first));

  const tooFast = await begin('Una sugerencia distinta enviada demasiado rápido.');
  await expectError('feedback_too_fast', () => service.send(ip, tooFast)); advance();
  await expectError('feedback_challenge', () => service.send(ip, tooFast));
  const wrong = await begin('Una sugerencia con respuesta de verificación errónea.'); advance(); wrong.answer = '99';
  await expectError('feedback_answer', () => service.send(ip, wrong));
  await expectError('feedback_challenge', () => service.send(ip, wrong));

  const scoped = await begin('Esta sugerencia verifica el vínculo con la dirección.'); advance();
  await expectError('feedback_challenge', () => service.send('127.0.0.11', scoped));
  const altered = { ...scoped, challengeToken: `${randomBytes(32).toString('base64url')}.${scoped.challengeToken.split('.')[1]}` };
  await expectError('feedback_challenge', () => service.send(ip, altered));
  await service.send(ip, scoped); // Wrong IP/signature cannot consume a valid challenge.
  const expired = await begin('Esta sugerencia utiliza una pregunta que ya expiró.'); clock += 600001;
  await expectError('feedback_challenge', () => service.send(ip, expired));
  const beforeHoneypot = sentCount();
  assert.deepEqual(await service.send(ip, { website: 'spam.example' }), { status: 202, body: { ok: true } });
  assert.equal(sentCount(), beforeHoneypot);

  const replay = await begin('Esta sugerencia comprueba uso único con concurrencia.'); advance();
  const beforeReplay = sentCount();
  const replayResults = await Promise.allSettled([service.send(ip, replay), service.send(ip, replay), service.send(ip, replay)]);
  assert.equal(replayResults.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(replayResults.filter(r => r.status === 'rejected').every(r => r.reason.code === 'feedback_challenge'));
  assert.equal(sentCount() - beforeReplay, 1);

  const [dupeA, dupeB] = await Promise.all([begin('Una sugerencia duplicada compite desde Basic.'), begin('UNA SUGERENCIA   DUPLICADA COMPITE DESDE BASIC.', ip, 'pro')]); advance();
  const beforeDupe = sentCount();
  const duplicates = await Promise.allSettled([service.send(ip, dupeA), service.send(ip, dupeB)]);
  assert.equal(duplicates.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(duplicates.find(r => r.status === 'rejected').reason.code, 'feedback_duplicate');
  assert.equal(sentCount() - beforeDupe, 1);

  failMail = true;
  const ambiguous = await begin('Esta sugerencia simula fallo de confirmación del proveedor.'); advance();
  await assert.rejects(() => service.send(ip, ambiguous), error => error.code === 'feedback_unavailable' && !error.message.includes('private SMTP'));
  failMail = false;
  const ambiguousRetry = await begin(ambiguous.message); advance();
  await expectError('feedback_duplicate', () => service.send(ip, ambiguousRetry));

  holdMail = true; maximumMail = 0;
  const concurrent = await Promise.all(Array.from({ length: 5 }, (_, n) => begin(`Sugerencia número ${n}: prueba de envíos simultáneos acotados.`))); advance();
  const concurrentResults = concurrent.map(payload => service.send(ip, payload).then(value => ({ value }), error => ({ error })));
  await waitUntil(() => activeMail === 2);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(activeMail, 2); assert.equal(maximumMail, 2);
  holdMail = false; while (releases.length) releases.shift()();
  const completed = await Promise.all(concurrentResults);
  assert.equal(completed.filter(result => result.value).length, 2);
  assert.equal(completed.filter(result => result.error?.code === 'feedback_unavailable').length, 3);

  // Limits use persistent atomic PostgreSQL buckets, including independent IPs.
  enforceLimits = true;
  await pool.query('DELETE FROM rate_limits');
  for (let n = 0; n < 10; n++) await service.challenge('10.1.1.1');
  await expectError('rate_limited', () => service.challenge('10.1.1.1'));
  await pool.query('DELETE FROM rate_limits');
  for (let n = 0; n < 120; n++) await service.challenge(`10.1.2.${n}`);
  await expectError('rate_limited', () => service.challenge('10.1.3.1'));
  await pool.query('DELETE FROM rate_limits');
  for (let n = 0; n < 15; n++) await service.send(ip, { website: 'spam' });
  await expectError('rate_limited', () => service.send(ip, { website: 'spam' }));
  await pool.query('DELETE FROM rate_limits');
  for (let n = 0; n < 5; n++) { const value = await begin(`Sugerencia para límite horario por IP, número ${n}.`); advance(); await service.send(ip, value); }
  const overIp = await begin('Sugerencia número seis supera el límite por dirección.'); advance();
  await expectError('rate_limited', () => service.send(ip, overIp));
  await pool.query('DELETE FROM rate_limits');
  for (let n = 0; n < 30; n++) { const address = `10.2.2.${n}`; const value = await begin(`Sugerencia para límite horario global, número ${n}.`, address); advance(); await service.send(address, value); }
  const overGlobal = await begin('La sugerencia treinta y uno excede el máximo global.', '10.2.3.1'); advance();
  await expectError('rate_limited', () => service.send('10.2.3.1', overGlobal));
  enforceLimits = false;
  assert.ok(observedLimits.some(([, max, seconds]) => max === 5 && seconds === 3600));
  assert.ok(observedLimits.some(([, max, seconds]) => max === 30 && seconds === 3600));

  // Expired hash reservations can be reused; cleanup removes even disabled-mode history.
  await pool.query("UPDATE feedback_dedup SET expires_at=now()-interval '1 second'");
  const afterRetention = await begin(ambiguous.message); advance(); await service.send(ip, afterRetention);
  const stored = await pool.query('SELECT * FROM feedback_challenges LIMIT 1');
  assert.equal(typeof stored.rows[0].ip_hash, 'string'); assert.equal(stored.rows[0].ip_hash.length, 64);
  assert.equal(stored.rows[0].message, undefined); assert.equal(stored.rows[0].email, undefined);
  await pool.query("UPDATE feedback_challenges SET expires_at=now()-interval '1 second'");
  await pool.query("UPDATE feedback_dedup SET expires_at=now()-interval '1 second'");
  await service.cleanup();
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM feedback_challenges')).rows[0].count, 0);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM feedback_dedup')).rows[0].count, 0);
  console.log('Feedback PostgreSQL replay, quotas, deduplication and concurrency passed; no email sent');
} finally { holdMail = false; while (releases.length) releases.shift()(); await pool.end(); }
