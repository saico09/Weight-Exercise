import test from 'node:test';
import assert from 'node:assert/strict';
import { email, username, date, validateSnapshot, makeCode, makeToken, tokenHash, keyedHash, safeEqual } from '../src/security.mjs';

const sample = () => ({ version: 1, profile: { heightCm: 170, initialWeightKg: 75, goalWeightKg: 70, age: 30, initialDate: '2026-01-01' }, settings: { theme: 'dark', language: 'es', weightUnit: 'kg', heightUnit: 'cm' }, records: [{ id: 'r1', date: '2026-01-01', weightKg: 75, exercise: true, healthy: false, note: '' }], initialRecordId: 'r1', lastPromptDate: null, celebratedAchievementIds: [] });
test('email normalization rejects header injection and invalid host', () => {
  assert.equal(email(' Name@Example.com '), 'name@example.com');
  for (const value of ['foo', 'x@localhost', 'a@example.com\r\nBcc:x@evil.com']) assert.throws(() => email(value));
});
test('username rejects whitespace and SQL-shaped input; allows accents', () => {
  assert.equal(username('María_01'), 'María_01');
  assert.throws(() => username("abc';DROP TABLE users;--"));
  assert.throws(() => username('aa'));
});
test('real calendar dates only', () => {
  assert.equal(date('2024-02-29'), true); assert.equal(date('2025-02-29'), false); assert.equal(date('2026-13-01'), false);
});
test('snapshot validates canonical measurements, duplicates and initial reference', () => {
  const data = sample(); assert.equal(validateSnapshot(data).records.length, 1);
  data.records.push({ ...data.records[0], id: 'r2' }); assert.throws(() => validateSnapshot(data));
  const invalid = sample(); invalid.initialRecordId = 'missing'; assert.throws(() => validateSnapshot(invalid));
  invalid.initialRecordId = 'r1'; invalid.records[0].weightKg = Infinity; assert.throws(() => validateSnapshot(invalid));
});
test('bounded snapshots preserve optional product settings', () => {
  const data = sample(); data.settings.motivation = { message: 'Hazlo por él', image: null };
  assert.deepEqual(validateSnapshot(data).settings.motivation, data.settings.motivation);
  data.settings.motivation.image = 'x'.repeat(2_000_001); assert.throws(() => validateSnapshot(data));
});
test('secure random OTP/session and domain-separated hashes', () => {
  const tokens = new Set(Array.from({ length: 100 }, makeToken)); assert.equal(tokens.size, 100);
  assert.match(makeCode(), /^\d{6}$/); assert.equal(tokenHash(makeToken()).length, 64);
  assert.notEqual(keyedHash('secret', 'login', '123456'), keyedHash('secret', 'change', '123456'));
  assert.equal(safeEqual('abc', 'abc'), true); assert.equal(safeEqual('abc', 'ab'), false);
});
test('step targets and goal display round-trip without accepting unsafe values', () => {
  const data = sample(); data.settings.stepGoal = 7000; data.settings.goalChartStyle = 'depth';
  assert.equal(validateSnapshot(data).settings.stepGoal, 7000);
  assert.equal(validateSnapshot(data).settings.goalChartStyle, 'depth');
  for (const invalid of [0, 50001, 100.5, '7000']) { data.settings.stepGoal = invalid; assert.throws(() => validateSnapshot(data)); }
  data.settings.stepGoal = null; assert.equal(validateSnapshot(data).settings.stepGoal, null);
});

test('profile photos are bounded embedded rasters and reward palettes round-trip', () => {
  const data = sample();
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNc8AAAAASUVORK5CYII=';
  data.profile.photo = photo;
  for (const theme of ['gold', 'platinum']) {
    data.settings.theme = theme;
    assert.equal(validateSnapshot(data).profile.photo, photo);
    assert.equal(validateSnapshot(data).settings.theme, theme);
  }
  for (const invalid of ['https://example.com/avatar.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', photo.replace('image/png', 'image/jpeg'), 'x'.repeat(80001)]) {
    data.profile.photo = invalid; assert.throws(() => validateSnapshot(data));
  }
  delete data.profile.photo;
  assert.ok(validateSnapshot(data));
});
