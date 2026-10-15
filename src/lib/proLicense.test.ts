import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProLicenseStatus } from './proLicense';

const mocks = vi.hoisted(() => ({
  native: { getStatus: vi.fn(), getDevice: vi.fn(), requestProof: vi.fn(), setLicense: vi.fn(), clearLicense: vi.fn() },
  cloud: { licenseConfig: vi.fn(), licenseChallenge: vi.fn(), licenseVerify: vi.fn() },
  isNative: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.isNative }, registerPlugin: () => mocks.native }));
vi.mock('./cloud', async importOriginal => ({ ...await importOriginal<typeof import('./cloud')>(), cloud: mocks.cloud }));

const NOW = Date.parse('2026-10-15T12:00:00Z');
const ACCOUNT = '8b9354cd-75cd-478b-b7a3-c4bacdb8d490';
const OTHER_ACCOUNT = '4e796dd9-de5f-45f2-af6b-546e3a12230b';
const validStatus = (): ProLicenseStatus => ({ mode: 'required', configured: true, valid: true, accountId: ACCOUNT, deviceKeyHash: 'device-key-hash', expiresAt: new Date(NOW + 86_400_000).toISOString() });
const config = { configured: true, cloudProjectNumber: '123456789', packageName: 'cl.forma.weightexercise', offlineDays: 7 };
const device = { devicePublicKey: 'public-key', deviceKeyHash: 'device-key-hash' };
const challenge = { challengeId: 'single-use-id', requestHash: 'server-challenge-hash', cloudProjectNumber: '123456789' };
const proof = { integrityToken: 'opaque-play-token', deviceSignature: 'keystore-signature', proofNonce: 'native-one-use-nonce' };
const result = { ticket: 'signed-server-ticket' };
let license: typeof import('./proLicense');
let dispatch: ReturnType<typeof vi.fn>;

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.stubEnv('DEV', true);
  vi.stubGlobal('location', { hostname: '127.0.0.1' });
  dispatch = vi.fn().mockReturnValue(true);
  vi.stubGlobal('window', { dispatchEvent: dispatch });
  mocks.isNative.mockReturnValue(true);
  mocks.native.getStatus.mockImplementation(async () => validStatus());
  mocks.native.getDevice.mockResolvedValue(device);
  mocks.native.requestProof.mockResolvedValue(proof);
  mocks.native.setLicense.mockImplementation(async () => validStatus());
  mocks.native.clearLicense.mockResolvedValue(undefined);
  mocks.cloud.licenseConfig.mockResolvedValue(config);
  mocks.cloud.licenseChallenge.mockResolvedValue(challenge);
  mocks.cloud.licenseVerify.mockResolvedValue(result);
  license = await import('./proLicense');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Pro access decisions', () => {
  it('accepts a valid native license for its account and while legitimately offline', () => {
    expect(license.canAccessPro(validStatus(), ACCOUNT)).toBe(true);
    expect(license.canAccessPro(validStatus(), null)).toBe(true);
    expect(license.canAccessPro(validStatus(), OTHER_ACCOUNT)).toBe(false);
  });

  it('fails closed for missing, invalid, unconfigured or expired status', () => {
    expect(license.canAccessPro(null, ACCOUNT)).toBe(false);
    for (const patch of [
      { valid: false }, { configured: false }, { accountId: undefined },
      { expiresAt: undefined }, { expiresAt: 'not-a-date' },
      { expiresAt: new Date(NOW).toISOString() }, { expiresAt: new Date(NOW - 1).toISOString() },
      { mode: 'unknown' },
    ]) expect(license.canAccessPro({ ...validStatus(), ...patch } as ProLicenseStatus, ACCOUNT)).toBe(false);
  });

  it('trusts the native verifier and propagates its failures without a fallback license', async () => {
    mocks.native.getStatus.mockResolvedValue({ ...validStatus(), valid: false, reason: 'LICENSE_SIGNATURE_INVALID' });
    const status = await license.getProLicenseStatus();
    expect(license.canAccessPro(status, ACCOUNT)).toBe(false);
    mocks.native.getStatus.mockRejectedValue(new Error('Native bridge unavailable'));
    await expect(license.getProLicenseStatus()).rejects.toThrow('Native bridge unavailable');
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])('allows only the local development browser preview: %s', async hostname => {
    mocks.isNative.mockReturnValue(false);
    vi.stubGlobal('location', { hostname });
    const status = await license.getProLicenseStatus();
    expect(status.mode).toBe('development');
    expect(license.canAccessPro(status, null)).toBe(true);
    expect(mocks.native.getStatus).not.toHaveBeenCalled();
  });

  it.each(['example.com', 'localhost.attacker.test', '192.168.1.8'])('does not grant web access on %s', async hostname => {
    mocks.isNative.mockReturnValue(false);
    vi.stubGlobal('location', { hostname });
    const status = await license.getProLicenseStatus();
    expect(license.canAccessPro(status, null)).toBe(false);
    expect(status.reason).toBe('android_required');
  });

  it('does not grant even localhost access in a production web bundle', async () => {
    mocks.isNative.mockReturnValue(false);
    vi.stubEnv('DEV', false);
    expect(license.canAccessPro(await license.getProLicenseStatus(), null)).toBe(false);
  });
});

describe('Pro activation', () => {
  it('binds each server operation to the visible account and requires final native verification', async () => {
    await expect(license.activateProLicense(ACCOUNT)).resolves.toEqual(validStatus());
    expect(mocks.cloud.licenseConfig).toHaveBeenCalledWith(ACCOUNT);
    expect(mocks.cloud.licenseChallenge).toHaveBeenCalledWith(device.devicePublicKey, ACCOUNT);
    expect(mocks.native.requestProof).toHaveBeenCalledWith({ requestHash: challenge.requestHash, cloudProjectNumber: challenge.cloudProjectNumber });
    expect(mocks.cloud.licenseVerify).toHaveBeenCalledWith({ challengeId: challenge.challengeId, ...proof }, ACCOUNT);
    expect(mocks.native.setLicense).toHaveBeenCalledWith({ ticket: result.ticket });
    expect(mocks.native.getStatus).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls.at(-1)?.[0].type).toBe(license.LICENSE_CHANGED);
  });

  it('never asks Google or writes a ticket when server licensing is unconfigured', async () => {
    mocks.cloud.licenseConfig.mockResolvedValue({ ...config, configured: false });
    await expect(license.activateProLicense(ACCOUNT)).rejects.toMatchObject({ code: 'license_unconfigured' });
    expect(mocks.native.getDevice).not.toHaveBeenCalled();
    expect(mocks.native.setLicense).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('cannot activate a web browser even in development', async () => {
    mocks.isNative.mockReturnValue(false);
    await expect(license.activateProLicense(ACCOUNT)).rejects.toMatchObject({ code: 'license_unconfigured' });
    expect(mocks.cloud.licenseConfig).not.toHaveBeenCalled();
  });

  it('does not store a ticket after a rejected server verdict', async () => {
    const { CloudError } = await import('./cloud');
    mocks.cloud.licenseVerify.mockRejectedValue(new CloudError('license_denied'));
    await expect(license.activateProLicense(ACCOUNT)).rejects.toMatchObject({ code: 'license_denied' });
    expect(mocks.native.setLicense).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not continue after Play or Android Keystore refuses proof', async () => {
    mocks.native.requestProof.mockRejectedValue(new Error('PLAY_INTEGRITY_UNAVAILABLE'));
    await expect(license.activateProLicense(ACCOUNT)).rejects.toThrow('PLAY_INTEGRITY_UNAVAILABLE');
    expect(mocks.cloud.licenseVerify).not.toHaveBeenCalled();
    expect(mocks.native.setLicense).not.toHaveBeenCalled();
  });

  it('does not report activation when native signature validation or persistence fails', async () => {
    mocks.native.setLicense.mockRejectedValue(new Error('LICENSE_SIGNATURE_INVALID'));
    await expect(license.activateProLicense(ACCOUNT)).rejects.toThrow('LICENSE_SIGNATURE_INVALID');
    expect(mocks.native.getStatus).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each([
    ['another account', { accountId: OTHER_ACCOUNT }],
    ['expired ticket', { expiresAt: new Date(NOW).toISOString() }],
    ['invalid signature', { valid: false }],
    ['development bypass', { mode: 'development' }],
  ])('rejects final native verification reporting %s', async (_name, patch) => {
    mocks.native.getStatus.mockResolvedValue({ ...validStatus(), ...patch });
    await expect(license.activateProLicense(ACCOUNT)).rejects.toMatchObject({ code: 'license_invalid' });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('logout and account-change races', () => {
  it('does not start an activation for an account that is no longer current', async () => {
    await expect(license.activateProLicense(ACCOUNT, () => false)).rejects.toMatchObject({ code: 'account_changed' });
    expect(mocks.cloud.licenseConfig).not.toHaveBeenCalled();
  });

  const stages = [
    ['configuration', () => mocks.cloud.licenseConfig, config],
    ['device key', () => mocks.native.getDevice, device],
    ['server challenge', () => mocks.cloud.licenseChallenge, challenge],
    ['Play proof', () => mocks.native.requestProof, proof],
    ['server verification', () => mocks.cloud.licenseVerify, result],
    ['native storage', () => mocks.native.setLicense, validStatus()],
    ['final native check', () => mocks.native.getStatus, validStatus()],
  ] as const;

  it.each(stages)('logout during %s prevents stale activation even without a caller guard', async (_name, stage, response) => {
    const waiting = deferred();
    stage().mockImplementationOnce(() => waiting.promise);
    const activation = license.activateProLicense(ACCOUNT);
    const rejected = expect(activation).rejects.toMatchObject({ code: 'account_changed' });
    await vi.waitFor(() => expect(stage()).toHaveBeenCalled());
    await license.clearProLicense();
    waiting.resolve(response);
    await rejected;
    expect(mocks.native.clearLicense).toHaveBeenCalled();
    if (stage() !== mocks.native.setLicense && stage() !== mocks.native.getStatus) expect(mocks.native.setLicense).not.toHaveBeenCalled();
  });

  it.each(stages)('a changed account during %s prevents accepting the old account ticket', async (_name, stage, response) => {
    const waiting = deferred();
    let current = true;
    stage().mockImplementationOnce(() => waiting.promise);
    const activation = license.activateProLicense(ACCOUNT, () => current);
    const rejected = expect(activation).rejects.toMatchObject({ code: 'account_changed' });
    await vi.waitFor(() => expect(stage()).toHaveBeenCalled());
    current = false;
    waiting.resolve(response);
    await rejected;
    if (stage() === mocks.native.setLicense || stage() === mocks.native.getStatus) expect(mocks.native.clearLicense).toHaveBeenCalled();
    else expect(mocks.native.setLicense).not.toHaveBeenCalled();
  });

  it('clears native access and emits its invalidation event after logout', async () => {
    await license.clearProLicense();
    expect(mocks.native.clearLicense).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0].type).toBe(license.LICENSE_CHANGED);
  });

  it('invalidates in-flight activation even when native clearing fails', async () => {
    const waiting = deferred();
    mocks.cloud.licenseVerify.mockImplementationOnce(() => waiting.promise);
    const activation = license.activateProLicense(ACCOUNT);
    const rejected = expect(activation).rejects.toMatchObject({ code: 'account_changed' });
    await vi.waitFor(() => expect(mocks.cloud.licenseVerify).toHaveBeenCalled());
    mocks.native.clearLicense.mockRejectedValue(new Error('LICENSE_STORAGE_FAILED'));
    await expect(license.clearProLicense()).rejects.toThrow('LICENSE_STORAGE_FAILED');
    waiting.resolve(result);
    await rejected;
    expect(mocks.native.setLicense).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
