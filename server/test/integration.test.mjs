import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { keyedHash } from '../src/security.mjs';

const enabled = process.env.RUN_CLOUD_INTEGRATION === '1';
const base = 'http://127.0.0.1:3001';
const mailbox = 'http://127.0.0.1:8025';
const origin = 'http://127.0.0.1:5173';
const repository = fileURLToPath(new URL('../../', import.meta.url));
const unique = `qa_${Date.now().toString(36)}`;
const sample = () => ({ version: 1, profile: { heightCm: 170, initialWeightKg: 75, goalWeightKg: 70, age: 30, initialDate: '2026-01-01' }, settings: { theme: 'dark', language: 'es', weightUnit: 'kg', heightUnit: 'cm', motivation: { message: 'Hazlo por él', image: null } }, records: [{ id: 'r1', date: '2026-01-01', weightKg: 75, exercise: true, healthy: false, note: 'Test local' }], initialRecordId: 'r1', lastPromptDate: null, celebratedAchievementIds: [] });
async function api(path, method = 'GET', data, cookie, customOrigin = origin, expectedAccount) {
  const response = await fetch(base + '/api' + path, { method, headers: { ...(customOrigin ? { Origin: customOrigin } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(expectedAccount ? { 'X-WE-Account': expectedAccount } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], setCookie: response.headers.get('set-cookie') };
}
async function codeFor(address, subject = 'Código de acceso') {
  for (let attempt = 0; attempt < 20; attempt++) {
    const inbox = await (await fetch(mailbox + '/api/v1/messages')).json();
    const message = inbox.messages.find(m => m.To.some(to => to.Address === address) && m.Subject.includes(subject));
    if (message) {
      const full = await (await fetch(mailbox + '/api/v1/message/' + message.ID)).json();
      const code = full.Text.match(/Tu código es: (\d{6})/)?.[1];
      assert.ok(code, 'Mail should contain a six-digit code'); return code;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Local mail was not delivered.');
}
async function createAccount(suffix) {
  const address = `${unique}_${suffix}@example.test`;
  assert.equal((await api('/auth/request-code', 'POST', { email: address })).status, 200);
  const code = await codeFor(address);
  const response = await api('/auth/verify-code', 'POST', { email: address, code, username: `${unique}_${suffix}` });
  assert.equal(response.status, 200); assert.ok(response.cookie);
  return { email: address, code, ...response };
}
function sql(query) {
  return execFileSync('docker', ['compose', '--env-file', '.env.local', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'weight_exercise', '-At', '-c', query], { cwd: repository, encoding: 'utf8' }).trim();
}

test('local API security, account lifecycle and isolated versioned backup', { skip: !enabled }, async t => {
  const accounts = [];
  t.after(async () => { for (const account of accounts) if (account.cookie) await api('/account', 'DELETE', { confirmation: 'DELETE' }, account.cookie); });
  await t.test('requires authentication and rejects cross-site/missing Origin writes', async () => {
    assert.equal((await api('/backup')).status, 401);
    assert.equal((await api('/auth/request-code', 'POST', { email: `${unique}@example.test` }, null, 'http://evil.test')).status, 403);
    assert.equal((await api('/auth/request-code', 'POST', { email: `${unique}@example.test` }, null, null)).status, 403);
  });
  let a; let b;
  await t.test('email code signs up, session is HttpOnly, code cannot be reused', async () => {
    a = await createAccount('a'); accounts.push(a);
    assert.match(a.setCookie, /HttpOnly/); assert.match(a.setCookie, /SameSite=Strict/);
    assert.equal((await api('/auth/verify-code', 'POST', { email: a.email, code: a.code })).status, 400);
    assert.equal((await api('/account', 'GET', null, a.cookie)).data.user.id, a.data.user.id);
    assert.equal(sql(`SELECT count(*) FROM sessions WHERE token_hash='${a.cookie.split('=')[1]}'`), '0');
  });
  await t.test('private records roundtrip and conflict protects concurrent saves', async () => {
    b = await createAccount('b'); accounts.push(b);
    assert.equal((await api('/backup', 'GET', null, a.cookie)).data.revision, 0);
    assert.equal((await api('/backup', 'PUT', { revision: 0, data: sample() }, a.cookie)).status, 200);
    const stored = (await api('/backup', 'GET', null, a.cookie)).data;
    assert.equal(stored.revision, 1); assert.deepEqual(stored.data, sample());
    assert.equal((await api('/backup', 'GET', null, b.cookie)).data.data, null);
    const concurrent = await Promise.all([api('/backup', 'PUT', { revision: 1, data: sample() }, a.cookie), api('/backup', 'PUT', { revision: 1, data: sample() }, a.cookie)]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
    const invalid = sample(); invalid.records[0].weightKg = -1;
    assert.equal((await api('/backup', 'PUT', { revision: 2, data: invalid }, a.cookie)).status, 400);
    assert.equal((await api('/backup', 'GET', null, a.cookie)).data.revision, 2);
  });
  await t.test('stale account identity cannot read, write, delete or log out another account', async () => {
    const oldId = a.data.user.id;
    assert.equal((await api('/backup', 'GET', null, b.cookie, origin, oldId)).data.error.code, 'account_changed');
    assert.equal((await api('/backup', 'PUT', { revision: 0, data: sample() }, b.cookie, origin, oldId)).status, 409);
    assert.equal((await api('/account', 'DELETE', { confirmation: 'DELETE' }, b.cookie, origin, oldId)).status, 409);
    assert.equal((await api('/auth/logout', 'POST', {}, b.cookie, origin, oldId)).status, 409);
    assert.equal((await api('/account', 'GET', null, b.cookie)).data.user.id, b.data.user.id);
  });
  await t.test('username update and dual email verification revoke previous session', async () => {
    const renamed = await api('/account', 'PATCH', { username: `${unique}_renamed` }, a.cookie); assert.equal(renamed.status, 200);
    const updatedEmail = `${unique}_new@example.test`;
    assert.equal((await api('/account/email/request', 'POST', { email: updatedEmail }, a.cookie)).status, 200);
    const currentCode = await codeFor(a.email, 'correo actual'); const newCode = await codeFor(updatedEmail, 'nuevo correo');
    const wrongCode = String((Number(newCode) + 1) % 1_000_000).padStart(6, '0');
    assert.equal((await api('/account/email/verify', 'POST', { email: updatedEmail, currentCode, newCode: wrongCode }, a.cookie)).status, 400);
    const changed = await api('/account/email/verify', 'POST', { email: updatedEmail, currentCode, newCode }, a.cookie);
    assert.equal(changed.status, 200); assert.equal(changed.data.user.email, updatedEmail);
    assert.equal((await api('/account', 'GET', null, a.cookie)).data.user, null);
    a.cookie = changed.cookie;
    assert.equal((await api('/backup', 'GET', null, a.cookie)).data.revision, 2);
  });
  await t.test('five wrong attempts lock OTP; challenge is stored only hashed', async () => {
    const address = `${unique}_locked@example.test`;
    assert.equal((await api('/auth/request-code', 'POST', { email: address })).status, 200);
    const valid = await codeFor(address); const wrong = String((Number(valid) + 1) % 1_000_000).padStart(6, '0');
    for (let n = 0; n < 5; n++) assert.equal((await api('/auth/verify-code', 'POST', { email: address, code: wrong })).status, 400);
    assert.equal((await api('/auth/verify-code', 'POST', { email: address, code: valid })).status, 400);
    assert.equal(sql(`SELECT count(*) FROM auth_challenges WHERE code_hash='${valid}'`), '0');
    assert.ok(Number(sql('SELECT max(attempts) FROM auth_challenges')) >= 5);
    assert.equal((await api('/auth/request-code', 'POST', { email: address })).status, 429);
  });
  await t.test('expired OTP cannot create an account', async () => {
    const address = `${unique}_expired@example.test`;
    assert.equal((await api('/auth/request-code', 'POST', { email: address })).status, 200);
    const valid = await codeFor(address);
    const secret = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').match(/^AUTH_SECRET=(.+)$/m)?.[1].trim();
    assert.ok(secret);
    const target = keyedHash(secret, 'target', `login:${address}`);
    sql(`UPDATE auth_challenges SET expires_at=now()-interval '1 second' WHERE target_hash='${target}'`);
    assert.equal((await api('/auth/verify-code', 'POST', { email: address, code: valid })).status, 400);
  });
  await t.test('deleted account removes preferences, records and sessions', async () => {
    const id = a.data.user.id;
    assert.equal((await api('/account', 'DELETE', { confirmation: 'wrong' }, a.cookie)).status, 400);
    assert.equal((await api('/account', 'DELETE', { confirmation: 'DELETE' }, a.cookie)).status, 200);
    a.cookie = null;
    assert.equal(sql(`SELECT (SELECT count(*) FROM weight_records WHERE user_id='${id}') + (SELECT count(*) FROM user_preferences WHERE user_id='${id}') + (SELECT count(*) FROM sessions WHERE user_id='${id}')`), '0');
  });
});
