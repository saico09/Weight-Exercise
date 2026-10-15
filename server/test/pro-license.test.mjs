import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, verify } from 'node:crypto';
import { createGoogleDecoder, createLicenseService, loadLicenseConfig, makeLicenseRequestHash, parseDevicePublicKey, signLicenseTicket, validateIntegrityVerdict } from '../src/pro-license.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const exported = publicKey.export({ type: 'spki', format: 'der' });
const now = Date.parse('2026-10-15T12:00:00Z');
const config = { configured: true, enforcement: true, packageName: 'cl.forma.weightexercise', minimumVersionCode: 10, certificateDigests: ['allowed-certificate'], offlineDays: 7, signingKey: privateKey, oauthKey: privateKey, keyId: 'test-key', serviceEmail: 'test@test.iam.gserviceaccount.com', cloudProjectNumber: '123456789' };
const challenge = { request_hash: 'bound-request-hash', created_at: new Date(now - 3000) };
const goodVerdict = () => ({ requestDetails: { requestPackageName: config.packageName, requestHash: challenge.request_hash, timestampMillis: String(now - 1000) }, appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED', packageName: config.packageName, certificateSha256Digest: ['allowed-certificate'], versionCode: '10' }, accountDetails: { appLicensingVerdict: 'LICENSED' }, deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] } });

test('device key is canonical RSA2048 SPKI, hash binds bytes and every challenge field', () => {
  const parsed = parseDevicePublicKey(exported.toString('base64url'));
  assert.equal(parsed.hash, createHash('sha256').update(exported).digest('base64url'));
  assert.throws(() => parseDevicePublicKey(exported.toString('base64')), { code: 'invalid_input' });
  assert.throws(() => parseDevicePublicKey(Buffer.concat([exported, Buffer.from([0])]).toString('base64url')), { code: 'invalid_input' });
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  assert.throws(() => parseDevicePublicKey(ec.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url')), { code: 'invalid_input' });
  assert.throws(() => parseDevicePublicKey('a'.repeat(601)), { code: 'invalid_input' });
  const args = ['id', 'nonce', 'user', parsed.hash]; const original = makeLicenseRequestHash(...args);
  for (let i = 0; i < args.length; i++) { const altered = [...args]; altered[i] += 'x'; assert.notEqual(makeLicenseRequestHash(...altered), original); }
});

test('only complete, fresh, bound and licensed Google Play verdicts authorize', async t => {
  assert.deepEqual(validateIntegrityVerdict(goodVerdict(), challenge, config, now), { versionCode: 10 });
  const failures = {
    'missing verdict': () => null,
    'different request hash': v => { v.requestDetails.requestHash = 'other'; },
    'missing request hash': v => { delete v.requestDetails.requestHash; },
    'request package mismatch': v => { v.requestDetails.requestPackageName = 'elsewhere'; },
    'future token': v => { v.requestDetails.timestampMillis = String(now + 10001); },
    'old token': v => { v.requestDetails.timestampMillis = String(now - 300001); },
    'token predates challenge': v => { v.requestDetails.timestampMillis = String(now - 20000); },
    'invalid time': v => { v.requestDetails.timestampMillis = 'NaN'; },
    'unrecognized app': v => { v.appIntegrity.appRecognitionVerdict = 'UNRECOGNIZED_VERSION'; },
    'wrong app package': v => { v.appIntegrity.packageName = 'another.app'; },
    'upload rather than Play signing key': v => { v.appIntegrity.certificateSha256Digest = ['upload-key']; },
    'extra untrusted certificate': v => { v.appIntegrity.certificateSha256Digest.push('untrusted'); },
    'empty certificates': v => { v.appIntegrity.certificateSha256Digest = []; },
    'old release': v => { v.appIntegrity.versionCode = '9'; },
    'fractional release': v => { v.appIntegrity.versionCode = '10.5'; },
    'unlicensed install': v => { v.accountDetails.appLicensingVerdict = 'UNLICENSED'; },
    'unevaluated license': v => { v.accountDetails.appLicensingVerdict = 'UNEVALUATED'; },
    'basic integrity alone': v => { v.deviceIntegrity.deviceRecognitionVerdict = ['MEETS_BASIC_INTEGRITY']; },
    'missing device verdict': v => { delete v.deviceIntegrity; },
  };
  for (const [name, mutate] of Object.entries(failures)) await t.test(name, () => {
    const verdict = goodVerdict(); const result = mutate(verdict);
    assert.throws(() => validateIntegrityVerdict(result === null ? null : verdict, challenge, config, now), { code: 'license_denied' });
  });
});

test('ticket has bounded expiry and trusted signature, is bound to user and device', () => {
  const signed = signLicenseTicket(config, 'account-id', 'device-hash', 'challenge-hash', 'native-proof-nonce', now);
  const [header, body, signature] = signed.ticket.split('.');
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${body}`), publicKey, Buffer.from(signature, 'base64url')), true);
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT', kid: 'test-key' });
  const payload = JSON.parse(Buffer.from(body, 'base64url'));
  assert.equal(payload.iss, 'weight-exercise'); assert.equal(payload.aud, config.packageName);
  assert.equal(payload.sub, 'account-id'); assert.equal(payload.deviceKeyHash, 'device-hash'); assert.equal(payload.plan, 'pro'); assert.equal(payload.v, 1);
  assert.equal(payload.requestHash, 'challenge-hash');
  assert.equal(payload.proofNonce, 'native-proof-nonce');
  assert.equal(payload.exp - payload.iat, 7 * 86400); assert.equal(Date.parse(signed.expiresAt), payload.exp * 1000);
  assert.notEqual(signLicenseTicket(config, 'account-id', 'device-hash', 'challenge-hash', 'native-proof-nonce', now).ticket, signed.ticket);
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${Buffer.from(JSON.stringify({ ...payload, sub: 'other' })).toString('base64url')}`), publicKey, Buffer.from(signature, 'base64url')), false);
});

test('default preview never mints tickets; production enforcement fails closed without keys', async () => {
  const disabled = loadLicenseConfig({});
  assert.equal(disabled.configured, false); assert.equal(disabled.enforcement, false);
  assert.throws(() => loadLicenseConfig({ PRO_LICENSE_ENFORCEMENT: 'true' }));
  assert.throws(() => loadLicenseConfig({ PLAY_CLOUD_PROJECT_NUMBER: '123456789' }));
  assert.throws(() => loadLicenseConfig({ PRO_LICENSE_ENFORCEMENT: 'TRUE' }));
  const service = createLicenseService({ config: disabled, pool: { query() { throw new Error('Preview should not query licenses'); } } });
  assert.equal(await service.hasEntitlement('preview'), true);
  await assert.rejects(service.challenge('preview', {}), { code: 'license_not_configured' });
  await assert.rejects(service.verify('preview', {}), { code: 'license_not_configured' });
  assert.deepEqual(service.publicConfig(), { configured: false, cloudProjectNumber: null, packageName: config.packageName, offlineDays: 7 });
});

test('Google decoder uses fixed HTTPS hosts, signed OAuth assertion and caches access token', async () => {
  const calls = [];
  const decode = createGoogleDecoder(config, { now: () => now, fetcher: async (url, options) => {
    calls.push(url); assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    if (url === 'https://oauth2.googleapis.com/token') {
      const assertion = new URLSearchParams(options.body).get('assertion'); const [head, body, sig] = assertion.split('.');
      assert.equal(verify('RSA-SHA256', Buffer.from(`${head}.${body}`), publicKey, Buffer.from(sig, 'base64url')), true);
      const claims = JSON.parse(Buffer.from(body, 'base64url')); assert.equal(claims.scope, 'https://www.googleapis.com/auth/playintegrity'); assert.equal(claims.exp - claims.iat, 3600);
      return Response.json({ access_token: 'test-access', token_type: 'Bearer', expires_in: 3600 });
    }
    assert.equal(url, 'https://playintegrity.googleapis.com/v1/cl.forma.weightexercise:decodeIntegrityToken');
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    assert.equal(JSON.parse(options.body).integrity_token, 'opaque-google-token');
    return Response.json({ tokenPayloadExternal: goodVerdict() });
  } });
  assert.deepEqual(await decode('opaque-google-token'), goodVerdict()); await decode('opaque-google-token');
  assert.equal(calls.filter(url => url.includes('oauth2')).length, 1);
});

test('Google failures and malformed/oversized responses never mint a license or leak upstream errors', async t => {
  for (const [name, response] of [['HTTP error', () => new Response('private error', { status: 403 })], ['oversized JSON', () => new Response('x'.repeat(65537))], ['invalid JSON', () => new Response('{')], ['missing token', () => Response.json({})], ['network failure', () => { throw new Error('sensitive credentials'); }]]) {
    await t.test(name, async () => {
      const decode = createGoogleDecoder(config, { fetcher: async () => response(), now: () => now });
      await assert.rejects(decode('opaque'), error => error.code === 'license_unavailable' && !error.message.includes('sensitive'));
    });
  }
});
