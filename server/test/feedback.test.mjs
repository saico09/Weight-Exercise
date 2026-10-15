import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createFeedbackService, feedbackRecipient, validateFeedback } from '../src/feedback.mjs';

const sample = () => ({ challengeId: randomUUID(), challengeToken: `${randomBytes(32).toString('base64url')}.${'a'.repeat(64)}`, answer: '9', message: 'Me gustaría organizar mis registros por semana.', email: 'reply@example.test', website: '', edition: 'basic', appVersion: '0.8.6' });
test('feedback accepts only normalized text and one optional reply address', () => {
  const payload = sample(); payload.email = ' Reply@Example.Test ';
  const value = validateFeedback(payload);
  assert.equal(value.replyEmail, 'reply@example.test');
  assert.equal(value.message, payload.message);
  assert.equal(validateFeedback({ ...payload, email: '' }).replyEmail, null);
  delete payload.email; assert.equal(validateFeedback(payload).replyEmail, null);
  assert.equal(validateFeedback({ ...payload, answer: 9 }).answer, '9');
  assert.equal(validateFeedback({ ...payload, answer: ' 09 ' }).answer, '9');
});
test('feedback refuses recipients, attachments, health payloads and unknown fields', () => {
  for (const [key, value] of Object.entries({ to: 'attacker@example.test', cc: 'attacker@example.test', attachments: [], records: [], settings: {}, user: {}, html: '<b>test</b>' })) {
    assert.throws(() => validateFeedback({ ...sample(), [key]: value }), { code: 'invalid_input' });
  }
  for (const value of [null, [], 'text', 1]) assert.throws(() => validateFeedback(value), { code: 'invalid_input' });
});
test('feedback bounds and validates every public field', () => {
  const bad = { message: ['', 'x'.repeat(19), 'x'.repeat(2001), '  '.repeat(20), 'This contains bad\u0000 data'],
    email: ['a@example.test\r\nBcc:bad@example.test', ['a@example.test'], 'a@example.test,b@example.test'],
    edition: ['enterprise', undefined, {}], appVersion: ['0.8.6\r\nSubject:bad', 'version1', 'a'.repeat(33)],
    challengeId: ['', 'not-uuid'], challengeToken: ['', 'a'.repeat(108)],
    answer: ['', '-1', '1e1', '100', true, {}, 9.5], website: [[], 'a'.repeat(201)] };
  for (const [key, values] of Object.entries(bad)) for (const value of values) assert.throws(() => validateFeedback({ ...sample(), [key]: value }), { code: 'invalid_input' }, key);
});
test('honeypot is discarded quietly and never requires personal data', () => {
  assert.deepEqual(validateFeedback({ website: 'spam.example' }), { honeypot: true });
});
test('feedback needs explicit fixed recipient and a server secret', async () => {
  assert.equal(feedbackRecipient({}), null);
  assert.equal(feedbackRecipient({ FEEDBACK_TO: ' Admin@Example.Test ' }), 'admin@example.test');
  assert.throws(() => feedbackRecipient({ FEEDBACK_TO: 'a@example.test,b@example.test' }), /one valid recipient/);
  assert.throws(() => createFeedbackService({ secret: 'short' }), /server authentication secret/);
  const fail = () => { throw new Error('Must not access a database or mail transport'); };
  const service = createFeedbackService({ secret: 'x'.repeat(64), recipient: null, pool: { query: fail }, transaction: fail, mailer: { send: fail }, limit: fail });
  assert.equal(service.configured, false);
  await assert.rejects(service.challenge('127.0.0.1'), { status: 503, code: 'feedback_unavailable' });
  await assert.rejects(service.send('127.0.0.1', sample()), { status: 503, code: 'feedback_unavailable' });
});
