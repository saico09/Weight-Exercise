// Test helper: refuses real delivery, even if a caller forgets which SMTP mode is active.
import pg from 'pg';
import { createMailer } from './mailer.mjs';
import { createSummaryService } from './email-summary.mjs';
const mailer = createMailer();
if (mailer.mode !== 'mailpit') throw new Error('Scheduler test helper only runs with Mailpit.');
const pool = new pg.Pool({ max: 1 });
async function transaction(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
  catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
try { await createSummaryService({ pool, transaction, mailer, secret: process.env.AUTH_SECRET, appUrl: process.env.PUBLIC_APP_URL || 'http://127.0.0.1:5173' }).runOnce(); console.log('Local summary scheduler tick complete.'); }
catch { console.error('Local summary scheduler tick failed.'); process.exitCode = 1; }
finally { mailer.close(); await pool.end(); }
