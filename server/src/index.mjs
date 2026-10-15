import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { ApiError, input, object, email, username, validateSnapshot, tokenHash, makeToken, makeCode, keyedHash, safeEqual, sessionToken, sessionCookie, expiredCookie } from './security.mjs';

// This first deployment is intentionally local. Internet deployment requires HTTPS,
// a transactional mail provider, release entitlement verification and a security review.
if (process.env.LOCAL_DEVELOPMENT !== 'true') throw new Error('Local preview only. LOCAL_DEVELOPMENT=true is required.');
const secret = process.env.AUTH_SECRET;
if (!secret || secret.length < 64) throw new Error('AUTH_SECRET must contain at least 64 characters.');
const origins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean));
if (!origins.size || [...origins].some(origin => !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))) throw new Error('Local origins only.');
const pool = new pg.Pool({ max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 3000 });
pool.on('error', () => console.error('Database connection unavailable.'));
const mail = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'mailpit', port: Number(process.env.SMTP_PORT || 1025), secure: false, connectionTimeout: 5000, socketTimeout: 5000, disableFileAccess: true, disableUrlAccess: true });
const userView = row => ({ id: row.id, email: row.email, username: row.username });
const hash = (...values) => keyedHash(secret, ...values);
const invalidCode = () => new ApiError(400, 'invalid_code', 'El código no es válido o expiró. Solicita uno nuevo si agotaste los intentos.');
const requestBytes = Symbol('requestBytes');
let bufferedRequestBytes = 0;
let activeRequests = 0;

async function transaction(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function limit(key, maximum, seconds) {
  const { rows } = await pool.query(`INSERT INTO rate_limits(bucket_hash,count,expires_at) VALUES($1,1,now()+($2 * interval '1 second'))
    ON CONFLICT(bucket_hash) DO UPDATE SET count=CASE WHEN rate_limits.expires_at < now() THEN 1 ELSE rate_limits.count+1 END,
    expires_at=CASE WHEN rate_limits.expires_at < now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING count`, [hash('rate', key), seconds]);
  if (rows[0].count > maximum) throw new ApiError(429, 'rate_limited', 'Espera unos minutos antes de intentarlo otra vez.');
}
async function issueChallenge(target) {
  const code = makeCode(); const salt = randomBytes(16).toString('hex');
  await pool.query(`INSERT INTO auth_challenges(target_hash,salt,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')
    ON CONFLICT(target_hash) DO UPDATE SET salt=EXCLUDED.salt,code_hash=EXCLUDED.code_hash,attempts=0,expires_at=EXCLUDED.expires_at,created_at=now()`, [hash('target', target), salt, hash('code', target, salt, code)]);
  return code;
}
async function checkChallenge(client, target, code) {
  const targetHash = hash('target', target);
  const { rows } = await client.query('SELECT *, expires_at > now() AS valid FROM auth_challenges WHERE target_hash=$1 FOR UPDATE', [targetHash]);
  const row = rows[0];
  if (!row || !row.valid || row.attempts >= 5) return false;
  await client.query('UPDATE auth_challenges SET attempts=attempts+1 WHERE target_hash=$1', [targetHash]);
  if (typeof code !== 'string' || !/^\d{6}$/.test(code) || !safeEqual(row.code_hash, hash('code', target, row.salt, code))) return false;
  await client.query('DELETE FROM auth_challenges WHERE target_hash=$1', [targetHash]);
  return true;
}
async function sendCode(to, code, purpose) {
  await mail.sendMail({ from: 'Weight&Exercise <access@weight-exercise.local>', to, subject: `Weight&Exercise · ${purpose}`, text: `Tu código es: ${code}\n\n${purpose}. Expira en 10 minutos y solo puede usarse una vez.\nSi no pediste este código, ignora este mensaje.\n\nVista local: este correo permanece en Mailpit y no se envía por Internet.` });
}
async function getUser(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const { rows } = await pool.query('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()', [tokenHash(token)]);
  return rows[0] || null;
}
function checkAccount(req, user) {
  const expected = req.headers['x-we-account'];
  if (expected && expected !== user?.id) throw new ApiError(409, 'account_changed', 'La cuenta cambió en otra ventana. Actualiza antes de continuar.');
}
async function newSession(client, userId) {
  const token = makeToken();
  await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')", [tokenHash(token), userId]);
  // Bound active sessions as well as cleaning expired ones.
  await client.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash IN (SELECT token_hash FROM sessions WHERE user_id=$1 ORDER BY created_at DESC OFFSET 8)', [userId]);
  return token;
}
async function body(req) {
  input(req.headers['content-type']?.split(';')[0] === 'application/json', 'Se necesita JSON.');
  let length = 0; const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    bufferedRequestBytes += chunk.length;
    req[requestBytes] = length;
    if (bufferedRequestBytes > 8_400_000) throw new ApiError(503, 'unavailable', 'Hay varios respaldos en curso. Intenta nuevamente en un momento.');
    if (length > 2_100_000) throw new ApiError(413, 'invalid_input', 'El archivo es demasiado grande.');
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ApiError(400, 'invalid_input', 'JSON no válido.'); }
  input(object(value)); return value;
}
function json(res, status, value, cookie) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...(cookie ? { 'Set-Cookie': cookie } : {}) });
  res.end(JSON.stringify(value));
}

const server = http.createServer(async (req, res) => {
  if (activeRequests >= 16) {
    req.resume();
    return json(res, 503, { error: { code: 'unavailable', message: 'El servicio está ocupado. Intenta nuevamente en un momento.' } });
  }
  activeRequests++;
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith('/api/')) throw new ApiError(404, 'not_found', 'Ruta no disponible.');
    if (req.method === 'GET' && path === '/api/health') {
      await pool.query('SELECT 1'); return json(res, 200, { ok: true, localDevelopment: true, edition: 'pro-preview' });
    }
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) throw new ApiError(405, 'method_not_allowed', 'Método no disponible.');
    if (req.method !== 'GET' && (!origins.has(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site')) throw new ApiError(403, 'forbidden', 'Origen no permitido.');
    // The local Vite proxy is the single caller. Never trust a client-supplied X-Forwarded-For.
    const ip = req.socket.remoteAddress || 'unknown';
    await limit(`all:${ip}`, 400, 60);
    if (req.method === 'POST' && path === '/api/auth/request-code') {
      const data = await body(req); const address = email(data.email);
      await limit(`send-ip:${ip}`, 30, 900); await limit(`send-email:${address}`, 5, 900); await limit(`send-cooldown:${address}`, 1, 45);
      const code = await issueChallenge(`login:${address}`);
      try { await sendCode(address, code, 'Código de acceso'); }
      catch { await pool.query('DELETE FROM auth_challenges WHERE target_hash=$1', [hash('target', `login:${address}`)]); throw new ApiError(503, 'unavailable', 'No se pudo enviar el código. Intenta nuevamente.'); }
      return json(res, 200, { ok: true, message: 'Si el correo es válido, recibirás un código.', expiresIn: 600 });
    }
    if (req.method === 'POST' && path === '/api/auth/verify-code') {
      const data = await body(req); const address = email(data.email);
      await limit(`verify:${ip}`, 60, 900);
      const proposedName = data.username ? username(typeof data.username === 'string' ? data.username.trim() : data.username) : null;
      const result = await transaction(async client => {
        if (!await checkChallenge(client, `login:${address}`, data.code)) return null;
        let user = (await client.query('SELECT * FROM users WHERE email=$1', [address])).rows[0];
        if (!user) {
          const name = proposedName || `we_${randomBytes(6).toString('hex')}`;
          user = (await client.query('INSERT INTO users(id,email,username) VALUES($1,$2,$3) RETURNING *', [randomUUID(), address, name])).rows[0];
        }
        return { user, token: await newSession(client, user.id) };
      });
      if (!result) throw invalidCode();
      return json(res, 200, { user: userView(result.user) }, sessionCookie(result.token));
    }
    if (req.method === 'GET' && (path === '/api/account' || path === '/api/session')) {
      const user = await getUser(req); return json(res, 200, { user: user ? userView(user) : null, localDevelopment: true });
    }
    if (req.method === 'POST' && path === '/api/auth/logout') {
      checkAccount(req, await getUser(req));
      const token = sessionToken(req);
      if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
      return json(res, 200, { ok: true }, expiredCookie);
    }
    const user = await getUser(req);
    if (!user) throw new ApiError(401, 'unauthorized', 'Inicia sesión para continuar.');
    checkAccount(req, user);
    if (req.method === 'PATCH' && path === '/api/account') {
      const data = await body(req); const name = username(typeof data.username === 'string' ? data.username.trim() : data.username);
      const { rows } = await pool.query('UPDATE users SET username=$1 WHERE id=$2 RETURNING *', [name, user.id]);
      return json(res, 200, { user: userView(rows[0]) });
    }
    if (req.method === 'POST' && path === '/api/account/email/request') {
      const data = await body(req); const address = email(data.email); input(address !== user.email, 'Elige un correo diferente.');
      await limit(`change:${user.id}`, 5, 900); await limit(`change-cooldown:${user.id}`, 1, 45);
      const target = `change:${user.id}:${user.email}:${address}`;
      const currentCode = await issueChallenge(`${target}:current`); const newCode = await issueChallenge(`${target}:new`);
      try { await sendCode(user.email, currentCode, 'Confirma el cambio desde tu correo actual'); await sendCode(address, newCode, 'Confirma tu nuevo correo'); }
      catch { throw new ApiError(503, 'unavailable', 'No se pudieron enviar ambos códigos. Intenta nuevamente.'); }
      return json(res, 200, { ok: true, expiresIn: 600 });
    }
    if (req.method === 'POST' && path === '/api/account/email/verify') {
      const data = await body(req); const address = email(data.email); input(address !== user.email);
      await limit(`change-verify:${user.id}`, 30, 900);
      const target = `change:${user.id}:${user.email}:${address}`;
      const result = await transaction(async client => {
        // Validate both with retained challenge until both codes succeed. A wrong pair
        // spends an attempt on each side, without consuming a correct half prematurely.
        const hashes = [hash('target', `${target}:current`), hash('target', `${target}:new`)];
        const rows = (await client.query('SELECT *, expires_at > now() AS valid FROM auth_challenges WHERE target_hash=ANY($1::text[]) ORDER BY target_hash FOR UPDATE', [hashes])).rows;
        const current = rows.find(row => row.target_hash === hashes[0]); const next = rows.find(row => row.target_hash === hashes[1]);
        if (!current || !next || !current.valid || !next.valid || current.attempts >= 5 || next.attempts >= 5) return null;
        await client.query('UPDATE auth_challenges SET attempts=attempts+1 WHERE target_hash=ANY($1::text[])', [hashes]);
        if (!safeEqual(current.code_hash, hash('code', `${target}:current`, current.salt, data.currentCode)) || !safeEqual(next.code_hash, hash('code', `${target}:new`, next.salt, data.newCode))) return null;
        const updated = (await client.query('UPDATE users SET email=$1 WHERE id=$2 AND email=$3 RETURNING *', [address, user.id, user.email])).rows[0];
        if (!updated) return null;
        await client.query('DELETE FROM auth_challenges WHERE target_hash=ANY($1::text[])', [hashes]);
        await client.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
        return { user: updated, token: await newSession(client, user.id) };
      });
      if (!result) throw invalidCode();
      return json(res, 200, { user: userView(result.user) }, sessionCookie(result.token));
    }
    if (req.method === 'DELETE' && path === '/api/account') {
      const data = await body(req); input(data.confirmation === 'DELETE', 'Confirma la eliminación.');
      await pool.query('DELETE FROM users WHERE id=$1', [user.id]);
      return json(res, 200, { ok: true }, expiredCookie);
    }
    if (req.method === 'GET' && path === '/api/backup') {
      const result = await transaction(async client => {
        // Snapshot read sees preferences and records from one committed revision.
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        const saved = (await client.query('SELECT * FROM user_preferences WHERE user_id=$1', [user.id])).rows[0];
        if (!saved) return { revision: 0, updatedAt: null, data: null };
        const records = (await client.query('SELECT id,to_char(date,\'YYYY-MM-DD\') AS date,weight_kg AS "weightKg",exercise,healthy,note FROM weight_records WHERE user_id=$1 ORDER BY date', [user.id])).rows;
        return { revision: saved.revision, updatedAt: saved.updated_at, data: { ...saved.metadata, settings: saved.preferences, profile: saved.profile, records } };
      });
      return json(res, 200, result);
    }
    if (req.method === 'PUT' && path === '/api/backup') {
      await limit(`backup:${user.id}`, 30, 3600);
      const payload = await body(req); input(Number.isInteger(payload.revision) && payload.revision >= 0);
      const data = validateSnapshot(payload.data);
      const result = await transaction(async client => {
        // Lock account first, including the first backup where no preferences row exists.
        const account = await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
        if (!account.rowCount) throw new ApiError(401, 'unauthorized', 'Inicia sesión para continuar.');
        const previous = (await client.query('SELECT revision FROM user_preferences WHERE user_id=$1', [user.id])).rows[0];
        if ((previous?.revision || 0) !== payload.revision) throw new ApiError(409, 'conflict', 'El respaldo cambió en otro dispositivo. Actualiza antes de reemplazarlo.');
        const saved = (await client.query(`INSERT INTO user_preferences(user_id,preferences,profile,metadata,revision) VALUES($1,$2,$3,$4,1)
          ON CONFLICT(user_id) DO UPDATE SET preferences=EXCLUDED.preferences,profile=EXCLUDED.profile,metadata=EXCLUDED.metadata,revision=user_preferences.revision+1,updated_at=now() RETURNING revision,updated_at`, [user.id, data.settings, data.profile, data.metadata])).rows[0];
        await client.query('DELETE FROM weight_records WHERE user_id=$1', [user.id]);
        if (data.records.length) await client.query(`INSERT INTO weight_records(user_id,id,date,weight_kg,exercise,healthy,note)
          SELECT $1,record.id,record.date::date,record."weightKg",record.exercise,record.healthy,record.note FROM jsonb_to_recordset($2::jsonb) AS record(id text,date text,"weightKg" double precision,exercise boolean,healthy boolean,note text)`, [user.id, JSON.stringify(data.records)]);
        return { revision: saved.revision, updatedAt: saved.updated_at };
      });
      return json(res, 200, result);
    }
    throw new ApiError(404, 'not_found', 'Ruta no disponible.');
  } catch (error) {
    if (res.headersSent) return res.end();
    if (error.code === '23505') return json(res, 409, { error: { code: 'conflict', message: 'Ese nombre o correo ya está en uso.' } });
    if (error instanceof ApiError) return json(res, error.status, { error: { code: error.code, message: error.message } });
    // Do not log database parameters, personal records, OTPs, cookies or SMTP payloads.
    console.error('API request failed.', typeof error.code === 'string' ? error.code.slice(0, 30) : 'internal_error');
    return json(res, 503, { error: { code: 'unavailable', message: 'El servicio local no está disponible. Intenta nuevamente.' } });
  } finally {
    activeRequests--;
    bufferedRequestBytes -= req[requestBytes] || 0;
  }
});
server.requestTimeout = 15000; server.headersTimeout = 10000; server.maxHeadersCount = 30; server.maxConnections = 32;
const cleanup = setInterval(async () => {
  try {
    await pool.query('DELETE FROM auth_challenges WHERE expires_at < now()');
    await pool.query('DELETE FROM sessions WHERE expires_at < now()');
    await pool.query('DELETE FROM rate_limits WHERE expires_at < now()');
  } catch { console.error('Deferred auth cleanup unavailable.'); }
}, 60000);
cleanup.unref();
await pool.query('SELECT 1');
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Weight&Exercise local API ready. No real email delivery.'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { clearInterval(cleanup); server.close(() => pool.end().then(() => process.exit(0))); });
