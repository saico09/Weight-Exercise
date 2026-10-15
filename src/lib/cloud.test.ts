import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloud, CloudError, cloudErrorMessage } from './cloud';
import { defaultData } from './model';

afterEach(() => vi.unstubAllGlobals());

describe('cloud requests', () => {
  it('uses the HttpOnly-cookie session and trims the email without storing a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await cloud.requestCode('  person@example.com  ');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/request-code', expect.objectContaining({
      method: 'POST', credentials: 'include', cache: 'no-store',
      body: JSON.stringify({ email: 'person@example.com' }),
    }));
  });

  it('retains revision conflicts and never automatically retries a write', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'conflict' } }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(cloud.saveBackup(7, defaultData(), 'user-a')).rejects.toMatchObject({ code: 'conflict', status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/backup', expect.objectContaining({ headers: expect.objectContaining({ 'X-WE-Account': 'user-a' }) }));
  });

  it('rejects a backup containing invalid records instead of silently dropping them', async () => {
    const data = { ...defaultData(), records: [{ id: 'bad', date: '2026-01-01', weightKg: -20, exercise: false, healthy: false }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ revision: 1, updatedAt: null, data }))));
    await expect(cloud.backup('user-a')).rejects.toMatchObject({ code: 'invalid_backup' });
  });

  it('accepts a missing backup but rejects malformed revision metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ revision: 0, updatedAt: null, data: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: -1, updatedAt: null, data: null })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(cloud.backup('user-a')).resolves.toEqual({ revision: 0, updatedAt: null, data: null });
    await expect(cloud.backup('user-a')).rejects.toBeInstanceOf(CloudError);
  });

  it('handles a stopped local API without leaking HTML errors into the interface', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Proxy failed</html>', { status: 502 })));
    await expect(cloud.account()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('accepts no-content logout responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(cloud.logout('user-a')).resolves.toBeUndefined();
  });

  it('distinguishes a local storage failure from an unavailable remote API', () => {
    const error = new Error('No hay espacio para guardar.'); error.name = 'StorageError';
    expect(cloudErrorMessage(error)).toBe(error.message);
  });

  it('binds every authenticated mutation to the account visible in the interface', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ user: { id: 'user-a' }, revision: 0, updatedAt: null, data: null }))));
    vi.stubGlobal('fetch', fetchMock);
    await cloud.rename('new_name', 'user-a');
    await cloud.requestEmailChange('new@example.test', 'user-a');
    await cloud.verifyEmailChange('new@example.test', '123456', '654321', 'user-a');
    await cloud.backup('user-a');
    await cloud.logout('user-a');
    await cloud.deleteAccount('user-a');
    for (const [, options] of fetchMock.mock.calls) expect(options.headers['X-WE-Account']).toBe('user-a');
  });
});
