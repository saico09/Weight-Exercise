import { createMailer } from './mailer.mjs';
const mailer = createMailer();
try { await mailer.verify(); console.log(`SMTP ${mailer.mode}: connection and authentication verified; no message sent.`); }
catch { console.error('SMTP verification failed. Check the private configuration.'); process.exitCode = 1; }
finally { mailer.close(); }
