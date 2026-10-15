import { Capacitor, registerPlugin } from '@capacitor/core';
import { cloud, CloudError } from './cloud';

export interface ProLicenseStatus {
  mode: 'development' | 'required'; configured: boolean; valid: boolean;
  deviceKeyHash?: string; accountId?: string; expiresAt?: string; reason?: string;
}
interface ProLicensePlugin {
  getStatus(): Promise<ProLicenseStatus>;
  getDevice(): Promise<{ devicePublicKey: string; deviceKeyHash: string }>;
  requestProof(options: { requestHash: string; cloudProjectNumber: string }): Promise<{ integrityToken: string; deviceSignature: string; proofNonce: string }>;
  setLicense(options: { ticket: string }): Promise<ProLicenseStatus>;
  clearLicense(): Promise<void>;
}
const nativeLicense = registerPlugin<ProLicensePlugin>('ProLicense');
export const LICENSE_CHANGED = 'we-license-changed';
let licenseEpoch = 0;

/** Development builds are previews. A release APK asks the native verifier;
 * localStorage, a URL parameter or an email session cannot grant a license. */
export async function getProLicenseStatus(): Promise<ProLicenseStatus> {
  if (Capacitor.isNativePlatform()) return nativeLicense.getStatus();
  const local = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return import.meta.env.DEV && local
    ? { mode: 'development', configured: false, valid: false }
    : { mode: 'required', configured: false, valid: false, reason: 'android_required' };
}

export function canAccessPro(status: ProLicenseStatus | null, accountId: string | null): boolean {
  if (!status) return false;
  if (status.mode === 'development') return true;
  return status.mode === 'required' && status.configured === true && status.valid === true
    && typeof status.accountId === 'string' && (!accountId || status.accountId === accountId)
    && Number.isFinite(Date.parse(status.expiresAt || '')) && Date.parse(status.expiresAt!) > Date.now();
}

export async function clearProLicense(): Promise<void> {
  licenseEpoch++;
  if (Capacitor.isNativePlatform()) await nativeLicense.clearLicense();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LICENSE_CHANGED));
}

export async function activateProLicense(accountId: string, stillCurrent: () => boolean = () => true): Promise<ProLicenseStatus> {
  if (!Capacitor.isNativePlatform()) throw new CloudError('license_unconfigured');
  const epoch = licenseEpoch;
  const current = () => epoch === licenseEpoch && stillCurrent();
  const checkAccount = () => { if (!current()) throw new CloudError('account_changed'); };
  checkAccount();
  const configuration = await cloud.licenseConfig(accountId);
  checkAccount();
  if (!configuration.configured) throw new CloudError('license_unconfigured');
  const device = await nativeLicense.getDevice();
  checkAccount();
  const challenge = await cloud.licenseChallenge(device.devicePublicKey, accountId);
  checkAccount();
  const proof = await nativeLicense.requestProof({ requestHash: challenge.requestHash, cloudProjectNumber: challenge.cloudProjectNumber });
  checkAccount();
  const result = await cloud.licenseVerify({ challengeId: challenge.challengeId, ...proof }, accountId);
  checkAccount();
  await nativeLicense.setLicense({ ticket: result.ticket });
  if (!current()) { await clearProLicense(); throw new CloudError('account_changed'); }
  const status = await nativeLicense.getStatus();
  if (!current()) { await clearProLicense(); throw new CloudError('account_changed'); }
  if (!canAccessPro(status, accountId) || status.mode !== 'required') throw new CloudError('license_invalid');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LICENSE_CHANGED));
  return status;
}
