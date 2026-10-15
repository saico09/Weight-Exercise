import nodemailer from 'nodemailer';

/** No URL config, optional TLS, debug logging or filesystem attachments. */
export function smtpConfig(env = process.env) {
  const mode = env.SMTP_MODE || 'mailpit';
  if (!['mailpit', 'real'].includes(mode)) throw new Error('SMTP_MODE must be mailpit or real.');
  const base = { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, dnsTimeout: 10000, disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false, maxRecipients: 1 };
  // Explicit local mode ignores any separately prepared real SMTP credentials.
  if (mode === 'mailpit') return { mode, from: { name: 'Weight&Exercise', address: 'access@weight-exercise.local' }, transport: { ...base, host: 'mailpit', port: 1025, secure: false, ignoreTLS: true } };
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT || 465);
  const secure = env.SMTP_SECURE === 'true';
  const requireTLS = env.SMTP_REQUIRE_TLS !== 'false';
  const sender = env.SMTP_FROM?.trim();
  // Accept a conventional single display-name address, but use our fixed brand name.
  const from = sender?.match(/^[^<>\r\n]*<([^<>\r\n]+)>$/)?.[1].trim() || sender;
  if (!host || !/^[a-z0-9.-]+$/i.test(host) || ['mailpit','localhost','127.0.0.1'].includes(host)) throw new Error('Real SMTP requires a valid provider hostname.');
  if (!Number.isInteger(port) || port < 1 || port > 65535 || (!secure && !requireTLS)) throw new Error('External SMTP requires TLS or enforced STARTTLS.');
  if (port === 465 && !secure) throw new Error('Port 465 requires implicit TLS.');
  if (!env.SMTP_USER || !env.SMTP_PASS || !from || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(from)) throw new Error('Configure private SMTP credentials and a single verified sender address.');
  return { mode, from: { name: 'Weight&Exercise', address: from }, transport: { ...base, host, port, secure, requireTLS: !secure && requireTLS, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: host } } };
}

export function createMailer(env = process.env) {
  const config = smtpConfig(env);
  const transport = nodemailer.createTransport(config.transport);
  return {
    mode: config.mode,
    // Deliberately expose no credentials or transport options in health endpoints.
    async verify() { try { await transport.verify(); return true; } catch { throw new Error('SMTP connection or authentication failed. Check private configuration.'); } },
    send: message => transport.sendMail({ ...message, from: config.from }),
    close: () => transport.close(),
  };
}
