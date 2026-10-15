import type { Plugin } from 'vite';

type PublicEnvironment = Record<string, string | undefined>;

/** A deployment setting may name an API, but cannot relax the policy itself. */
export function apiOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return undefined;
    // URL accepts some host characters that have special meaning in a CSP or
    // HTML attribute. Public DNS/IDN (normalized to ASCII) and IPv6 need none.
    if (!/^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])$/i.test(url.hostname)) return undefined;
    return url.origin;
  } catch { return undefined; }
}

export function contentSecurityPolicy(environment: PublicEnvironment): string {
  const origins = [...new Set([
    apiOrigin(environment.VITE_API_URL), apiOrigin(environment.VITE_FEEDBACK_API_URL),
  ].filter((origin): origin is string => Boolean(origin)))];
  return [
    "default-src 'self'",
    "script-src 'self'",
    // React and Ionic set inline styles for themes, chart geometry and overlays.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    ["connect-src 'self'", ...origins].join(' '),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join('; ');
}

export function injectSecurityPolicy(html: string, environment: PublicEnvironment): string {
  // Put the policy before every app resource. Capacitor's trusted native bridge
  // is inserted immediately after <head> by JSInjector, before this meta tag.
  const charset = /<meta\s+charset\s*=\s*["']?[^>]+>/i;
  if (!charset.test(html)) throw new Error('The app HTML needs its charset before the security policy.');
  if (/http-equiv\s*=\s*["']Content-Security-Policy/i.test(html)) throw new Error('The app HTML already defines a security policy.');
  const policy = contentSecurityPolicy(environment);
  return html.replace(charset, match => `${match}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="no-referrer" />`);
}

/** Dev remains compatible with Vite's inline refresh script and WebSocket. */
export function productionSecurityPolicy(): Plugin {
  let environment: PublicEnvironment = {};
  return {
    name: 'weight-exercise-production-security-policy',
    apply: 'build',
    configResolved(config) { environment = config.env; },
    transformIndexHtml: { order: 'post', handler(html) { return injectSecurityPolicy(html, environment); } },
  };
}
