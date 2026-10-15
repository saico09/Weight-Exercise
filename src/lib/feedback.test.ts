import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackError, feedbackAvailable, feedbackErrorMessage, getFeedbackChallenge, resolveFeedbackBase, submitFeedback, validateFeedbackDraft } from './feedback';
import { APP_VERSION, EDITION } from './edition';

const native = vi.hoisted(() => vi.fn());
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: native } }));
const challenge = { id: '8b9354cd-75cd-478b-b7a3-c4bacdb8d490', token: 'opaque-server-challenge-token-123456789', question: '3 + 5 = ?', expiresAt: '2026-10-15T23:30:00Z', minWaitMs: 2000 };
const draft = { message: 'Me gustaría poder elegir un recordatorio distinto.', email: '', answer: '8', website: '' };

beforeEach(() => {
  native.mockReturnValue(false);
  vi.stubGlobal('location', { hostname: '127.0.0.1' });
  vi.stubEnv('DEV', true);
  vi.stubEnv('VITE_API_URL', '');
  vi.stubEnv('VITE_FEEDBACK_API_URL', '');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('feedback service address', () => {
  it('uses a dedicated HTTPS API base before the general API', () => {
    expect(resolveFeedbackBase({ feedbackUrl: ' https://feedback.example.test/api/ ', apiUrl: 'https://other.test/api', native: true, development: false })).toBe('https://feedback.example.test/api');
    expect(resolveFeedbackBase({ apiUrl: 'https://api.example.test/api', native: true, development: false })).toBe('https://api.example.test/api');
  });

  it.each(['http://api.example.test/api', 'https://person:secret@example.test/api', 'https://example.test/api?key=secret', 'https://example.test/api#key', '//example.test/api', '/api', 'not-a-url', 'javascript:alert(1)'])('rejects unsafe or ambiguous configuration %s without silently falling back', feedbackUrl => {
    expect(resolveFeedbackBase({ feedbackUrl, apiUrl: 'https://safe.example.test/api', native: false, development: true, hostname: 'localhost' })).toBeNull();
  });

  it('allows the local proxy only for a local browser development session', () => {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) expect(resolveFeedbackBase({ native: false, development: true, hostname })).toBe('/api');
    expect(resolveFeedbackBase({ native: true, development: true, hostname: 'localhost' })).toBeNull();
    expect(resolveFeedbackBase({ native: false, development: false, hostname: 'localhost' })).toBeNull();
    expect(resolveFeedbackBase({ native: false, development: true, hostname: 'localhost.other.test' })).toBeNull();
  });

  it('does not claim native delivery is available without an explicit service', async () => {
    native.mockReturnValue(true);
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(feedbackAvailable()).toBe(false);
    await expect(getFeedbackChallenge()).rejects.toMatchObject({ code: 'feedback_unconfigured' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('feedback privacy and validation', () => {
  it('trims the user message, optional reply address and human answer', () => {
    expect(validateFeedbackDraft({ ...draft, message: `  ${draft.message}  `, email: ' hello@example.test ', answer: ' 8 ' })).toEqual({ ...draft, email: 'hello@example.test' });
  });

  it.each(['short', ' '.repeat(40), 'a'.repeat(2001)])('rejects an out-of-range message before making a request', async message => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(submitFeedback({ ...draft, message }, challenge)).rejects.toMatchObject({ code: 'feedback_message' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['bad-address', 'a@example.test\nBcc:another@example.test', `${'a'.repeat(250)}@x.test`])('rejects invalid reply email %s', email => {
    expect(() => validateFeedbackDraft({ ...draft, email })).toThrow(FeedbackError);
  });

  it.each(['', '-1', '8.0', 'answer', '1000'])('rejects a malformed verification answer %s', answer => {
    expect(() => validateFeedbackDraft({ ...draft, answer })).toThrow(FeedbackError);
  });

  it('posts only a fixed allowlist, never cookies, auth headers, app records or profile data', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true })); vi.stubGlobal('fetch', fetcher);
    const extra = { ...draft, email: 'reply@example.test', records: [{ weightKg: 80 }], profile: { photo: 'private-photo' }, accountId: 'private-account', token: 'private-session' };
    await submitFeedback(extra, challenge);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('/api/feedback');
    expect(options).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store' });
    expect(options.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ challengeId: challenge.id, challengeToken: challenge.token, answer: '8', message: draft.message, email: 'reply@example.test', website: '', edition: EDITION.toLowerCase(), appVersion: APP_VERSION });
  });

  it('omits an empty reply address and requires a positive server acknowledgement', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: false })); vi.stubGlobal('fetch', fetcher);
    await expect(submitFeedback(draft, challenge)).rejects.toMatchObject({ code: 'feedback_unavailable' });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty('email');
  });

  it('loads a server challenge without any session credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(challenge)); vi.stubGlobal('fetch', fetcher);
    await expect(getFeedbackChallenge()).resolves.toEqual(challenge);
    expect(fetcher).toHaveBeenCalledWith('/api/feedback/challenge', expect.objectContaining({ method: 'GET', credentials: 'omit', cache: 'no-store' }));
  });

  it('fails closed on malformed challenge responses', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const patch of [{ token: 'x' }, { id: 'x' }, { question: '' }, { expiresAt: 'invalid' }, { minWaitMs: -1 }, { minWaitMs: 5001 }]) {
      fetcher.mockResolvedValueOnce(Response.json({ ...challenge, ...patch }));
      await expect(getFeedbackChallenge()).rejects.toMatchObject({ code: 'feedback_unavailable' });
    }
  });

  it('retains server antispam errors and never automatically retries a submission', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: { code: 'rate_limited' } }, { status: 429 })); vi.stubGlobal('fetch', fetcher);
    await expect(submitFeedback(draft, challenge)).rejects.toMatchObject({ code: 'rate_limited' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('does not display upstream HTML or server details when the service is unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<html>private upstream details</html>', { status: 503 })); vi.stubGlobal('fetch', fetcher);
    await expect(getFeedbackChallenge()).rejects.toMatchObject({ code: 'feedback_unavailable' });
    expect(feedbackErrorMessage(new Error('private upstream details'))).not.toContain('private');
  });
});
