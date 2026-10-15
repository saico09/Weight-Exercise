import test from 'node:test';
import assert from 'node:assert/strict';
import { smtpConfig } from '../src/mailer.mjs';
import { nextEmailRun, summaryWindow, validateEmailSettings } from '../src/email-schedule.mjs';
import { parseUnsubscribe, summaryText, unsubscribeToken } from '../src/email-summary.mjs';
import { buildProgressWorkbook } from '../../shared/progress-workbook.mjs';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const settings = { enabled: true, consent: true, cadence: 'weekly', timezone: 'America/Santiago', time: '09:00', weekday: 1, monthDay: 1 };
test('compressed email XLSX preserves every XML entry and remains a smaller ZIP', () => {
  const data = { settings: { theme: 'dark' }, records: [{date:'2026-10-01',weightKg:80,exercise:true,healthy:true,note:'=DANGEROUS()',steps:1000}] };
  const options = { generatedAt:'2026-10-15T00:00:00Z' };
  const original = Buffer.from(buildProgressWorkbook(data,options));
  const compressed = Buffer.from(buildProgressWorkbook(data,options,bytes=>deflateRawSync(bytes))); assert.ok(compressed.length < original.length);
  let source = 0, target = 0, entries = 0;
  while (original.readUInt32LE(source) === 0x04034b50) {
    const nameLength = original.readUInt16LE(source + 26), size = original.readUInt32LE(source + 18), compressedSize = compressed.readUInt32LE(target + 18);
    const start = source + 30 + nameLength, compressedStart = target + 30 + nameLength;
    assert.equal(compressed.readUInt16LE(target + 8), 8);
    assert.deepEqual(inflateRawSync(compressed.subarray(compressedStart, compressedStart + compressedSize)), original.subarray(start, start + size));
    source = start + size; target = compressedStart + compressedSize; entries++;
  }
  assert.equal(compressed.readUInt32LE(target), 0x02014b50); assert.ok(entries >= 7);
});
test('Mailpit mode cannot accidentally deliver via prepared real credentials', () => {
  const config = smtpConfig({ SMTP_MODE: 'mailpit', SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'test@example.com', SMTP_PASS: 'never-used' });
  assert.equal(config.transport.host, 'mailpit'); assert.equal(config.transport.auth, undefined);
});
test('external SMTP enforces validated TLS and auth without debug or arbitrary sender headers', () => {
  const real = { SMTP_MODE: 'real', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'test', SMTP_PASS: 'dummy', SMTP_FROM: 'sender@example.com' };
  const config = smtpConfig(real);
  assert.equal(config.transport.tls.rejectUnauthorized, true); assert.equal(config.transport.logger, false);
  assert.equal(smtpConfig({ ...real, SMTP_FROM: 'Weight&Exercise <sender@example.com>' }).from.address, 'sender@example.com');
  assert.throws(() => smtpConfig({ ...real, SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_REQUIRE_TLS: 'false' }));
  assert.throws(() => smtpConfig({ ...real, SMTP_FROM: 'x@example.com\r\nBcc: victim@example.com' }));
  assert.throws(() => smtpConfig({ ...real, SMTP_PASS: '' }));
});
test('schedule requires explicit opt-in and valid timezone, day and time', () => {
  assert.equal(validateEmailSettings(settings).enabled, true);
  assert.throws(() => validateEmailSettings({ ...settings, consent: false }));
  assert.throws(() => validateEmailSettings({ ...settings, timezone: 'Fake/Place' }));
  assert.throws(() => validateEmailSettings({ ...settings, monthDay: 31 }));
  assert.deepEqual(validateEmailSettings({ enabled: false }), { enabled: false });
});
test('weekly and monthly schedules follow local wall time and never rerun same slot', () => {
  assert.equal(nextEmailRun(settings, new Date('2026-10-15T12:00:00Z')).toISOString(), '2026-10-19T12:00:00.000Z');
  assert.equal(nextEmailRun(settings, new Date('2026-10-19T12:00:00Z')).toISOString(), '2026-10-26T12:00:00.000Z');
  assert.equal(nextEmailRun({ ...settings, cadence: 'monthly' }, new Date('2026-10-15T12:00:00Z')).toISOString(), '2026-11-01T12:00:00.000Z');
});
test('nonexistent DST time advances safely; calendar summary windows preserve dates', () => {
  const spring = { ...settings, timezone: 'America/New_York', weekday: 0, time: '02:30' };
  assert.equal(nextEmailRun(spring, new Date('2026-03-07T12:00:00Z')).toISOString(), '2026-03-08T07:00:00.000Z');
  assert.deepEqual(summaryWindow(new Date('2026-10-19T12:00:00Z'), settings), { from: '2026-10-12', to: '2026-10-18' });
  assert.deepEqual(summaryWindow(new Date('2026-03-01T12:00:00Z'), { ...settings, cadence: 'monthly' }), { from: '2026-02-01', to: '2026-02-28' });
});
test('unsubscribe tokens are scoped and cannot be forged', () => {
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; const version = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const token = unsubscribeToken('test-secret', id, version);
  assert.deepEqual(parseUnsubscribe('test-secret', token), { id, version });
  assert.equal(parseUnsubscribe('other-secret', token), null); assert.equal(parseUnsubscribe('test-secret', token.replace('aaaa', 'cccc')), null);
});
test('summary reports change, habits, actual steps and saved backup freshness', () => {
  const snapshot = { settings: { language: 'es', weightUnit: 'kg' }, records: [{ date: '2026-10-11', weightKg: 80, exercise: false, healthy: false }, { date: '2026-10-17', weightKg: 79, exercise: true, healthy: true, steps: 8000 }] };
  const summary = summaryText(snapshot, settings, new Date('2026-10-19T12:00:00Z'), new Date('2026-10-18T15:00:00Z'), 'Test');
  assert.ok(summary.lines.some(line => line.includes('Cambio: -1,0 kg')));
  assert.ok(summary.lines.some(line => line.includes('8.000')));
  assert.ok(summary.lines.some(line => line.includes('2 registros')));
});
