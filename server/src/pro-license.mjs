import { createHash, createPrivateKey, createPublicKey, randomBytes, randomUUID, sign, verify, constants } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { ApiError, input, object } from './security.mjs';

const PACKAGE = 'cl.forma.weightexercise';
const ISSUER = 'weight-exercise';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash = value => createHash('sha256').update(value).digest('base64url');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const unavailable = () => new ApiError(503, 'license_unavailable', 'La verificación de Google Play no está disponible. Intenta más tarde.');
const denied = () => new ApiError(403, 'license_denied', 'No se pudo verificar la licencia Pro de Google Play en este dispositivo.');
const notConfigured = () => new ApiError(503, 'license_not_configured', 'La activación con Google Play aún no está configurada.');

function decodeBase64url(value, maximum) {
  input(typeof value === 'string' && value.length > 0 && value.length <= maximum && /^[A-Za-z0-9_-]+$/.test(value));
  const bytes = Buffer.from(value, 'base64url');
  input(bytes.toString('base64url') === value);
  return bytes;
}
export function parseDevicePublicKey(value) {
  const bytes = decodeBase64url(value, 600);
  let key;
  try { key = createPublicKey({ key: bytes, format: 'der', type: 'spki' }); } catch { input(false); }
  input(key.asymmetricKeyType === 'rsa' && key.asymmetricKeyDetails?.modulusLength === 2048 && key.asymmetricKeyDetails?.publicExponent === 65537n, 'Se necesita una clave válida del dispositivo.');
  input(key.export({ type: 'spki', format: 'der' }).equals(bytes));
  return { key, bytes, hash: hash(bytes) };
}
export function makeLicenseRequestHash(id, nonce, userId, deviceKeyHash) {
  return hash(`we-pro-v1\n${id}\n${nonce}\n${userId}\n${deviceKeyHash}`);
}
function privateText(path) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > 16384) throw new Error('Invalid private license configuration file.');
  return readFileSync(path, 'utf8');
}
export function loadLicenseConfig(env = process.env) {
  if (!['', 'true', 'false'].includes(env.PRO_LICENSE_ENFORCEMENT || '')) throw new Error('PRO_LICENSE_ENFORCEMENT must be true or false.');
  const enforcement = env.PRO_LICENSE_ENFORCEMENT === 'true';
  const fields = ['PLAY_CLOUD_PROJECT_NUMBER', 'PLAY_CERTIFICATE_SHA256', 'PLAY_SERVICE_ACCOUNT_FILE', 'PRO_LICENSE_SIGNING_KEY_FILE'];
  const present = fields.filter(key => env[key]);
  if (!present.length && !enforcement) return { configured: false, enforcement: false, packageName: PACKAGE, offlineDays: 7, cloudProjectNumber: null };
  if (present.length !== fields.length) throw new Error('Google Play licensing needs every required configuration field.');
  const cloudProjectNumber = env.PLAY_CLOUD_PROJECT_NUMBER;
  if (!/^[1-9][0-9]{5,15}$/.test(cloudProjectNumber) || !Number.isSafeInteger(Number(cloudProjectNumber))) throw new Error('Invalid Google Cloud project number.');
  const certificateDigests = env.PLAY_CERTIFICATE_SHA256.split(',').map(value => value.trim());
  if (!certificateDigests.length || certificateDigests.length > 4 || certificateDigests.some(value => !/^[A-Za-z0-9_-]{43}$/.test(value) || Buffer.from(value, 'base64url').toString('base64url') !== value)) throw new Error('Use base64url SHA-256 Play signing certificate digests.');
  const offlineDays = Number(env.PRO_LICENSE_OFFLINE_DAYS || '7');
  const minimumVersionCode = Number(env.PLAY_MIN_VERSION_CODE || '1');
  if (!Number.isInteger(offlineDays) || offlineDays < 1 || offlineDays > 7 || !Number.isSafeInteger(minimumVersionCode) || minimumVersionCode < 1) throw new Error('Invalid license lifetime or minimum version.');
  // Read only named private files. Never expose private keys through config responses.
  const signingKey = createPrivateKey(privateText(env.PRO_LICENSE_SIGNING_KEY_FILE));
  const serviceAccount = JSON.parse(privateText(env.PLAY_SERVICE_ACCOUNT_FILE));
  if (signingKey.asymmetricKeyType !== 'rsa' || signingKey.asymmetricKeyDetails.modulusLength < 2048 || signingKey.asymmetricKeyDetails.modulusLength > 4096) throw new Error('License signing key must be RSA 2048–4096.');
  if (serviceAccount.type !== 'service_account' || typeof serviceAccount.client_email !== 'string' || !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(serviceAccount.client_email) || typeof serviceAccount.private_key !== 'string') throw new Error('Invalid Play service account file.');
  const oauthKey = createPrivateKey(serviceAccount.private_key);
  if (oauthKey.asymmetricKeyType !== 'rsa' || oauthKey.asymmetricKeyDetails.modulusLength < 2048) throw new Error('Invalid Play service account key.');
  const publicKey = createPublicKey(signingKey);
  return { configured: true, enforcement, packageName: PACKAGE, cloudProjectNumber, certificateDigests, offlineDays, minimumVersionCode, signingKey, publicKey, oauthKey, serviceEmail: serviceAccount.client_email, keyId: hash(publicKey.export({ type: 'spki', format: 'der' })).slice(0, 16) };
}
async function boundedJson(response, maximum = 65536) {
  if (!response.ok || !response.body) { await response.body?.cancel(); throw unavailable(); }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maximum) throw unavailable();
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw unavailable(); }
}
// Dependencies are injected only by unit tests; HTTP never accepts a verdict or a test URL.
export function createGoogleDecoder(config, { fetcher = fetch, now = Date.now } = {}) {
  let token; let tokenUntil = 0; let refreshing; let active = 0;
  async function accessToken() {
    if (token && tokenUntil > now() + 60000) return token;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const time = Math.floor(now() / 1000);
      const content = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: config.serviceEmail, scope: 'https://www.googleapis.com/auth/playintegrity', aud: 'https://oauth2.googleapis.com/token', iat: time, exp: time + 3600 })}`;
      const assertion = `${content}.${sign('RSA-SHA256', Buffer.from(content), config.oauthKey).toString('base64url')}`;
      const result = await boundedJson(await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6500), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString() }));
      if (typeof result.access_token !== 'string' || result.access_token.length > 8192 || result.token_type !== 'Bearer' || !Number.isFinite(result.expires_in) || result.expires_in < 120 || result.expires_in > 3600) throw unavailable();
      token = result.access_token; tokenUntil = now() + result.expires_in * 1000;
      return token;
    })();
    try { return await refreshing; } finally { refreshing = undefined; }
  }
  return async integrityToken => {
    if (active >= 2) throw unavailable();
    active++;
    try {
      const access = await accessToken();
      const result = await boundedJson(await fetcher(`https://playintegrity.googleapis.com/v1/${config.packageName}:decodeIntegrityToken`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6500), headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ integrity_token: integrityToken }) }));
      if (!object(result.tokenPayloadExternal)) throw unavailable();
      return result.tokenPayloadExternal;
    } catch { throw unavailable(); } finally { active--; }
  };
}
export function validateIntegrityVerdict(verdict, challenge, config, now = Date.now()) {
  const request = verdict?.requestDetails;
  const app = verdict?.appIntegrity;
  const stamp = Number(request?.timestampMillis);
  const created = new Date(challenge.created_at).getTime();
  const version = Number(app?.versionCode);
  const certificates = app?.certificateSha256Digest;
  if (!object(request) || request.requestPackageName !== config.packageName || typeof request.requestHash !== 'string' || request.requestHash !== challenge.request_hash || !Number.isSafeInteger(stamp) || !Number.isFinite(created) || stamp < created - 10000 || stamp < now - 300000 || stamp > now + 10000 || app?.appRecognitionVerdict !== 'PLAY_RECOGNIZED' || app.packageName !== config.packageName || !Number.isSafeInteger(version) || version < config.minimumVersionCode || !Array.isArray(certificates) || !certificates.length || certificates.some(cert => !config.certificateDigests.includes(cert)) || verdict?.accountDetails?.appLicensingVerdict !== 'LICENSED' || !Array.isArray(verdict?.deviceIntegrity?.deviceRecognitionVerdict) || !verdict.deviceIntegrity.deviceRecognitionVerdict.includes('MEETS_DEVICE_INTEGRITY')) throw denied();
  return { versionCode: version };
}
export function signLicenseTicket(config, userId, deviceKeyHash, requestHash, proofNonce, time = Date.now()) {
  const iat = Math.floor(time / 1000); const exp = iat + config.offlineDays * 86400;
  const payload = { iss: ISSUER, aud: config.packageName, sub: userId, deviceKeyHash, requestHash, proofNonce, plan: 'pro', iat, exp, jti: randomUUID(), v: 1 };
  const content = `${encode({ alg: 'RS256', typ: 'JWT', kid: config.keyId })}.${encode(payload)}`;
  return { ticket: `${content}.${sign('RSA-SHA256', Buffer.from(content), config.signingKey).toString('base64url')}`, expiresAt: new Date(exp * 1000).toISOString() };
}
export function createLicenseService({ pool, transaction, config, decode = config.configured ? createGoogleDecoder(config) : null, now = Date.now }) {
  const publicConfig = () => ({ configured: config.configured, cloudProjectNumber: config.configured ? config.cloudProjectNumber : null, packageName: config.packageName, offlineDays: config.offlineDays });
  async function enabledAccount(client, userId) {
    // Serialize activations and revocations on the account, including its first device.
    if (!(await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])).rowCount) throw new ApiError(401, 'unauthorized', 'Inicia sesión para continuar.');
    if ((await client.query('SELECT user_id FROM pro_account_blocks WHERE user_id=$1', [userId])).rowCount) throw denied();
  }
  async function challenge(userId, payload) {
    if (!config.configured) throw notConfigured();
    input(object(payload));
    const device = parseDevicePublicKey(payload.devicePublicKey);
    const id = randomUUID(); const nonce = randomBytes(32).toString('base64url');
    const requestHash = makeLicenseRequestHash(id, nonce, userId, device.hash);
    await transaction(async client => {
      await enabledAccount(client, userId);
      await client.query('DELETE FROM pro_license_challenges WHERE user_id=$1 AND (device_key_hash=$2 OR expires_at < now())', [userId, device.hash]);
      if ((await client.query('SELECT count(*)::integer AS count FROM pro_license_challenges WHERE user_id=$1', [userId])).rows[0].count >= 3) throw new ApiError(429, 'license_busy', 'Completa la verificación pendiente antes de continuar.');
      await client.query("INSERT INTO pro_license_challenges(id,user_id,device_key_hash,device_public_key,request_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes')", [id, userId, device.hash, device.bytes, requestHash]);
    });
    return { challengeId: id, requestHash, cloudProjectNumber: config.cloudProjectNumber };
  }
  async function verifyLicense(userId, payload) {
    if (!config.configured) throw notConfigured();
    input(object(payload) && typeof payload.challengeId === 'string' && UUID.test(payload.challengeId));
    input(typeof payload.integrityToken === 'string' && payload.integrityToken.length >= 20 && payload.integrityToken.length <= 32768 && /^[A-Za-z0-9._~+/=-]+$/.test(payload.integrityToken));
    input(decodeBase64url(payload.proofNonce, 43).length === 32);
    const signature = decodeBase64url(payload.deviceSignature, 400);
    input(signature.length === 256);
    // Commit consumption BEFORE network/signature checks. Failed attempts are never reusable.
    const consumed = await transaction(client => client.query('DELETE FROM pro_license_challenges WHERE id=$1 AND user_id=$2 RETURNING *, expires_at > now() AS valid', [payload.challengeId, userId]));
    const stored = consumed.rows[0];
    if (!stored?.valid) throw new ApiError(409, 'license_challenge_expired', 'La verificación expiró o ya se utilizó. Intenta nuevamente.');
    const publicKey = createPublicKey({ key: stored.device_public_key, format: 'der', type: 'spki' });
    if (!verify('RSA-SHA256', Buffer.from(`${stored.request_hash}\n${payload.proofNonce}`), { key: publicKey, padding: constants.RSA_PKCS1_PADDING }, signature)) throw denied();
    const evidence = validateIntegrityVerdict(await decode(payload.integrityToken), stored, config, now());
    return transaction(async client => {
      await enabledAccount(client, userId);
      const existing = (await client.query('SELECT revoked_at FROM pro_devices WHERE user_id=$1 AND device_key_hash=$2', [userId, stored.device_key_hash])).rows[0];
      if (existing?.revoked_at) throw denied();
      if (!existing && (await client.query('SELECT count(*)::integer AS count FROM pro_devices WHERE user_id=$1 AND revoked_at IS NULL', [userId])).rows[0].count >= 3) throw new ApiError(403, 'license_device_limit', 'Esta cuenta ya tiene tres dispositivos. Contacta con soporte para retirar uno.');
      const ticket = signLicenseTicket(config, userId, stored.device_key_hash, stored.request_hash, payload.proofNonce, now());
      await client.query(`INSERT INTO pro_devices(user_id,device_key_hash,version_code,expires_at) VALUES($1,$2,$3,$4)
        ON CONFLICT(user_id,device_key_hash) DO UPDATE SET verified_at=now(),version_code=EXCLUDED.version_code,expires_at=EXCLUDED.expires_at`, [userId, stored.device_key_hash, evidence.versionCode, ticket.expiresAt]);
      return ticket;
    });
  }
  async function hasEntitlement(userId) {
    if (!config.enforcement) return true;
    return (await pool.query(`SELECT 1 FROM pro_devices d WHERE d.user_id=$1 AND d.revoked_at IS NULL AND d.expires_at > now()
      AND NOT EXISTS(SELECT 1 FROM pro_account_blocks b WHERE b.user_id=d.user_id) LIMIT 1`, [userId])).rowCount > 0;
  }
  async function requireEntitlement(userId) {
    if (!await hasEntitlement(userId)) throw new ApiError(403, 'pro_required', 'Verifica tu licencia Pro de Google Play para usar este servicio.');
  }
  return { publicConfig, challenge, verify: verifyLicense, hasEntitlement, requireEntitlement };
}
