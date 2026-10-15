import { validateData, type AppData } from './model';
import { Capacitor } from '@capacitor/core';

// Future deployment: VITE_API_URL=https://api.example.com/api. Local web uses Vite's proxy.
const configuredApi = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, '') || '';
const validConfiguredApi = configuredApi.startsWith('https://') ? configuredApi : '';
export const CLOUD_NATIVE_UNAVAILABLE = Capacitor.isNativePlatform() && !validConfiguredApi;

export interface CloudUser { id: string; email: string; username: string }
export interface CloudAccountState { user: CloudUser | null; localDevelopment: boolean }
export interface CloudBackup { revision: number; updatedAt: string | null; data: AppData | null }

export class CloudError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 0) {
    super(code); this.name = 'CloudError'; this.code = code; this.status = status;
  }
}

/** Session credentials live in the API's HttpOnly cookie, never in app storage. */
async function request<T>(path: string, method = 'GET', body?: unknown, accountId?: string): Promise<T> {
  if (CLOUD_NATIVE_UNAVAILABLE) throw new CloudError('native_unconfigured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${validConfiguredApi || '/api'}${path}`, {
      method, credentials: 'include', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(accountId ? { 'X-WE-Account': accountId } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    if (!response.ok) throw new CloudError(payload?.error?.code || 'unavailable', response.status);
    if (payload === null) throw new CloudError('unavailable');
    return payload as T;
  } catch (error) {
    if (error instanceof CloudError) throw error;
    throw new CloudError('unavailable');
  } finally { clearTimeout(timeout); }
}

export const cloud = {
  account: () => request<CloudAccountState>('/account'),
  requestCode: (email: string) => request('/auth/request-code', 'POST', { email: email.trim() }),
  verifyCode: (email: string, code: string, username?: string) => request<{ user: CloudUser }>('/auth/verify-code', 'POST', { email: email.trim(), code, ...(username?.trim() ? { username: username.trim() } : {}) }),
  rename: (username: string, accountId: string) => request<{ user: CloudUser }>('/account', 'PATCH', { username: username.trim() }, accountId),
  requestEmailChange: (email: string, accountId: string) => request('/account/email/request', 'POST', { email: email.trim() }, accountId),
  verifyEmailChange: (email: string, currentCode: string, newCode: string, accountId: string) => request<{ user: CloudUser }>('/account/email/verify', 'POST', { email: email.trim(), currentCode, newCode }, accountId),
  logout: (accountId: string) => request('/auth/logout', 'POST', {}, accountId),
  deleteAccount: (accountId: string) => request('/account', 'DELETE', { confirmation: 'DELETE' }, accountId),
  async backup(accountId: string): Promise<CloudBackup> {
    const result = await request<CloudBackup>('/backup', 'GET', undefined, accountId);
    if (!Number.isInteger(result.revision) || result.revision < 0) throw new CloudError('invalid_backup');
    if (result.data === null) return result;
    const valid = validateData(result.data);
    // A truncated/corrupt snapshot must not silently discard records on restore.
    if (!valid || !Array.isArray(result.data.records) || valid.records.length !== result.data.records.length) throw new CloudError('invalid_backup');
    return { ...result, data: valid };
  },
  saveBackup: (revision: number, data: AppData, accountId: string) => request<{ revision: number; updatedAt: string }>('/backup', 'PUT', { revision, data }, accountId),
};

export function cloudErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'StorageError') return error.message;
  const code = error instanceof CloudError ? error.code : 'unavailable';
  return ({
    invalid_input: 'Revisa el correo, el código y el nombre de usuario.',
    unauthorized: 'Tu sesión terminó. Vuelve a entrar con un código.',
    forbidden: 'No pudimos verificar esta solicitud. Vuelve a iniciar sesión.',
    invalid_code: 'El código no es válido o venció. Revisa el correo o pide otro.',
    rate_limited: 'Espera un momento antes de intentarlo otra vez.',
    conflict: 'La información cambió. Actualiza y revisa antes de continuar.',
    account_changed: 'La sesión cambió en otra ventana. Revisa la cuenta antes de continuar; no se modificó ningún respaldo.',
    invalid_backup: 'El respaldo no es compatible o está incompleto. Tus datos locales siguen intactos.',
    unavailable: 'El servidor local no está disponible. Puedes seguir usando la app sin conexión.',
    native_unconfigured: 'La cuenta y el respaldo están disponibles en la vista previa del PC. La conexión segura del teléfono se habilitará cuando configuremos el servidor.',
  } as Record<string, string>)[code] || 'No pudimos completar la solicitud. Inténtalo nuevamente.';
}
