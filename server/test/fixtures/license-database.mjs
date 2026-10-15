import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import pg from 'pg';
import { createLicenseService } from '../src/pro-license.mjs';

// Executed in a throwaway database by pro-license-database.test.mjs. No mailer,
// HTTP mock route or production credentials are involved. The Google decoder is
// a dependency injection confined to this test process.
const pool = new pg.Pool({ max: 3 });
const user = randomUUID(); const other = randomUUID();
const keys = Array.from({ length: 4 }, () => generateKeyPairSync('rsa', { modulusLength: 2048 }));
const signer = generateKeyPairSync('rsa', { modulusLength: 2048 });
const config = { configured: true, enforcement: true, packageName: 'cl.forma.weightexercise', cloudProjectNumber: '123456789', certificateDigests: ['trusted'], minimumVersionCode: 11, offlineDays: 7, signingKey: signer.privateKey, keyId: 'test' };
let decoded = 0;
async function transaction(fn) { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); } }
const service = createLicenseService({ pool, transaction, config, decode: async token => {
  decoded++; const data = JSON.parse(Buffer.from(token, 'base64url'));
  return { requestDetails: { requestPackageName: config.packageName, requestHash: data.requestHash, timestampMillis: String(Date.now()) }, appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED', packageName: config.packageName, certificateSha256Digest: ['trusted'], versionCode: '11' }, accountDetails: { appLicensingVerdict: data.bad ? 'UNLICENSED' : 'LICENSED' }, deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] } };
} });
async function begin(key = keys[0], id = user) {
  const challenge = await service.challenge(id, { devicePublicKey: key.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url') });
  const proofNonce = randomBytes(32).toString('base64url');
  return { challengeId: challenge.challengeId, proofNonce, integrityToken: Buffer.from(JSON.stringify({ requestHash: challenge.requestHash })).toString('base64url'), deviceSignature: sign('RSA-SHA256', Buffer.from(`${challenge.requestHash}\n${proofNonce}`), key.privateKey).toString('base64url') };
}
try {
  for (const id of [user, other]) await pool.query('INSERT INTO users(id,email,username) VALUES($1,$2,$3)', [id, `${id}@example.test`, `test_${id.slice(0, 12)}`]);
  assert.equal(await service.hasEntitlement(user), false, 'Email account alone does not grant Pro');
  const wrongAccount = await begin();
  await assert.rejects(service.verify(other, wrongAccount), { code: 'license_challenge_expired' });
  assert.ok((await service.verify(user, wrongAccount)).ticket, 'A different account cannot consume the challenge');
  const replay = await begin(); const before = decoded;
  const results = await Promise.allSettled([service.verify(user, replay), service.verify(user, replay)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(decoded - before, 1);
  const invalid = await begin(); invalid.deviceSignature = sign('RSA-SHA256', Buffer.from('wrong message'), keys[0].privateKey).toString('base64url');
  await assert.rejects(service.verify(user, invalid), { code: 'license_denied' });
  await assert.rejects(service.verify(user, invalid), { code: 'license_challenge_expired' });
  const changedNonce = await begin(); changedNonce.proofNonce = randomBytes(32).toString('base64url');
  await assert.rejects(service.verify(user, changedNonce), { code: 'license_denied' });
  const expired = await begin();
  await pool.query("UPDATE pro_license_challenges SET expires_at=now()-interval '1 second' WHERE id=$1", [expired.challengeId]);
  await assert.rejects(service.verify(user, expired), { code: 'license_challenge_expired' });
  const bad = await begin(keys[1]); const unlicensed = JSON.parse(Buffer.from(bad.integrityToken, 'base64url')); unlicensed.bad = true; bad.integrityToken = Buffer.from(JSON.stringify(unlicensed)).toString('base64url');
  await assert.rejects(service.verify(user, bad), { code: 'license_denied' });
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM pro_devices WHERE user_id=$1', [user])).rows[0].count, 1);
  await service.verify(user, await begin(keys[1]));
  const [third, fourth] = await Promise.all([begin(keys[2]), begin(keys[3])]);
  const race = await Promise.allSettled([service.verify(user, third), service.verify(user, fourth)]);
  assert.equal(race.filter(r => r.status === 'fulfilled').length, 1, 'Concurrent activations cannot exceed three devices');
  assert.equal(race.find(r => r.status === 'rejected').reason.code, 'license_device_limit');
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM pro_devices WHERE user_id=$1 AND revoked_at IS NULL', [user])).rows[0].count, 3);
  const originalCount = (await pool.query('SELECT count(*)::integer AS count FROM pro_devices WHERE user_id=$1 AND revoked_at IS NULL', [user])).rows[0].count;
  assert.equal(originalCount, 3, 'Rejection never revokes an existing device');
  await pool.query('UPDATE pro_devices SET revoked_at=now() WHERE user_id=$1', [user]);
  assert.equal(await service.hasEntitlement(user), false);
  await assert.rejects(service.verify(user, await begin()), { code: 'license_denied' });
  await pool.query('INSERT INTO pro_account_blocks(user_id) VALUES($1)', [other]);
  await assert.rejects(service.challenge(other, { devicePublicKey: keys[0].publicKey.export({ type: 'spki', format: 'der' }).toString('base64url') }), { code: 'license_denied' });
  await pool.query('DELETE FROM pro_account_blocks WHERE user_id=$1', [other]);
  const blockDuringVerification = await begin(keys[0], other);
  await pool.query('INSERT INTO pro_account_blocks(user_id) VALUES($1)', [other]);
  await assert.rejects(service.verify(other, blockDuringVerification), { code: 'license_denied' });
  await pool.query("UPDATE pro_devices SET revoked_at=NULL,expires_at=now()-interval '1 second' WHERE user_id=$1", [user]);
  assert.equal(await service.hasEntitlement(user), false);
  await assert.rejects(service.requireEntitlement(user), { code: 'pro_required' });
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[user, other]]);
  for (const table of ['pro_license_challenges', 'pro_devices', 'pro_account_blocks']) assert.equal((await pool.query(`SELECT count(*)::integer AS count FROM ${table}`)).rows[0].count, 0);
  console.log('License PostgreSQL concurrency, replay, revocation and isolation passed; no email sent.');
} finally { await pool.end(); }
