import { Capacitor } from '@capacitor/core';
import { APP_VERSION, EDITION } from './edition';

export interface FeedbackChallenge { id: string; token: string; question: string; expiresAt: string; minWaitMs: number }
export interface FeedbackDraft { message: string; email: string; answer: string; website: string }
export class FeedbackError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'FeedbackError'; this.code = code; }
}

/** Both settings name an API base (https://api.example.com/api), never a mail address. */
export function resolveFeedbackBase({ feedbackUrl, apiUrl, native, development, hostname }: { feedbackUrl?: string; apiUrl?: string; native: boolean; development: boolean; hostname?: string }): string | null {
  const configured = feedbackUrl?.trim() || apiUrl?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
      return url.href.replace(/\/+$/, '');
    } catch { return null; }
  }
  return !native && development && ['localhost', '127.0.0.1', '[::1]'].includes(hostname || '') ? '/api' : null;
}

const base = () => resolveFeedbackBase({ feedbackUrl: import.meta.env.VITE_FEEDBACK_API_URL, apiUrl: import.meta.env.VITE_API_URL, native: Capacitor.isNativePlatform(), development: import.meta.env.DEV, hostname: typeof location === 'undefined' ? undefined : location.hostname });
export const feedbackAvailable = () => base() !== null;

export function validateFeedbackDraft(draft: FeedbackDraft): FeedbackDraft {
  const message = draft.message.trim();
  const email = draft.email.trim();
  const answer = draft.answer.trim();
  if (message.length < 20 || message.length > 2000) throw new FeedbackError('feedback_message');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email))) throw new FeedbackError('feedback_email');
  if (!/^\d{1,2}$/.test(answer)) throw new FeedbackError('feedback_answer');
  return { message, email, answer, website: draft.website.slice(0, 200) };
}

async function request(path: string, payload?: unknown, externalSignal?: AbortSignal): Promise<Record<string, unknown>> {
  const api = base();
  if (!api) throw new FeedbackError('feedback_unconfigured');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`${api}/feedback${path}`, { method: payload === undefined ? 'GET' : 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json', ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new FeedbackError(typeof data?.error?.code === 'string' ? data.error.code : 'feedback_unavailable');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new FeedbackError('feedback_unavailable');
    return data;
  } catch (error) {
    if (error instanceof FeedbackError) throw error;
    throw new FeedbackError('feedback_unavailable');
  } finally { clearTimeout(timeout); externalSignal?.removeEventListener('abort', abort); }
}

export async function getFeedbackChallenge(signal?: AbortSignal): Promise<FeedbackChallenge> {
  const value = await request('/challenge', undefined, signal);
  if (typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.id) || typeof value.token !== 'string' || value.token.length < 20 || value.token.length > 4096 || typeof value.question !== 'string' || value.question.length > 80 || !value.question.trim() || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)) || !Number.isInteger(value.minWaitMs) || (value.minWaitMs as number) < 0 || (value.minWaitMs as number) > 5000) throw new FeedbackError('feedback_unavailable');
  return value as unknown as FeedbackChallenge;
}

export async function submitFeedback(draft: FeedbackDraft, challenge: FeedbackChallenge): Promise<void> {
  const clean = validateFeedbackDraft(draft);
  // An explicit allowlist prevents accidental attachment of app/user/health data.
  const response = await request('', { challengeId: challenge.id, challengeToken: challenge.token, answer: clean.answer, message: clean.message, ...(clean.email ? { email: clean.email } : {}), website: clean.website, edition: EDITION.toLowerCase(), appVersion: APP_VERSION });
  if (response.ok !== true) throw new FeedbackError('feedback_unavailable');
}

export function feedbackErrorMessage(error: unknown): string {
  const code = error instanceof FeedbackError ? error.code : '';
  const messages: Record<string, string> = {
    feedback_unconfigured: 'El envío de sugerencias aún no está disponible en esta versión. No se ha enviado ningún mensaje.',
    feedback_message: 'Escribe entre 20 y 2.000 caracteres para contarnos tu idea.',
    feedback_email: 'Revisa el correo o déjalo vacío si no necesitas respuesta.',
    feedback_answer: 'Revisa la respuesta y solicita una nueva comprobación.',
    feedback_challenge: 'La comprobación expiró o ya se usó. Solicita una nueva.',
    feedback_too_fast: 'Espera un momento y solicita una nueva comprobación.',
    feedback_duplicate: 'Esta sugerencia ya se recibió. Gracias por compartirla.',
    rate_limited: 'Has enviado varias solicitudes. Inténtalo más tarde.',
    invalid_input: 'Revisa tu mensaje y la comprobación antes de enviarlo.',
  };
  return messages[code] || 'No pudimos enviar tu sugerencia. Tu texto sigue aquí; puedes intentarlo de nuevo.';
}
