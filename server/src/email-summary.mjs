import { randomUUID } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { buildProgressWorkbook } from '../../shared/progress-workbook.mjs';
import { ApiError, keyedHash, safeEqual } from './security.mjs';
import { nextEmailRun, summaryWindow, validateEmailSettings } from './email-schedule.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const settingsFrom = row => ({ enabled: row.enabled, cadence: row.cadence, timezone: row.timezone, time: row.send_time, weekday: row.weekday, monthDay: row.month_day });
export function unsubscribeToken(secret, id, version) { return `${id}.${version}.${keyedHash(secret, 'email-unsubscribe', id, version)}`; }
export function parseUnsubscribe(secret, token) {
  if (typeof token !== 'string' || !/^[a-f0-9-]{36}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token)) return null;
  const [id, version, digest] = token.split('.');
  return safeEqual(digest, keyedHash(secret, 'email-unsubscribe', id, version)) ? { id, version } : null;
}
export function summaryText(snapshot, settings, scheduledFor, backupDate, username) {
  const english = snapshot.settings.language === 'en';
  const window = summaryWindow(scheduledFor, settings);
  const records = snapshot.records.filter(record => record.date <= window.to);
  const recent = records.filter(record => record.date >= window.from);
  const before = records.filter(record => record.date <= window.from).at(-1) || recent[0];
  const latest = records.at(-1);
  const unit = snapshot.settings.weightUnit === 'lb' ? 'lb' : 'kg';
  const number = value => (unit === 'lb' ? value / 0.45359237 : value).toLocaleString(english ? 'en-US' : 'es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const lines = [english ? `Hi ${username}, here is your progress.` : `Hola ${username}, este es tu progreso.`, `${window.from} → ${window.to}`];
  if (before && latest) {
    lines.push(english ? `Then (${before.date}): ${number(before.weightKg)} ${unit}. Latest (${latest.date}): ${number(latest.weightKg)} ${unit}.` : `Antes (${before.date}): ${number(before.weightKg)} ${unit}. Último registro (${latest.date}): ${number(latest.weightKg)} ${unit}.`);
    const delta = latest.weightKg - before.weightKg;
    lines.push(`${english ? 'Change' : 'Cambio'}: ${delta > 0 ? '+' : ''}${number(delta)} ${unit}.`);
  }
  lines.push(english ? `${recent.length} recorded days · ${recent.filter(r => r.exercise).length} exercise days · ${recent.filter(r => r.healthy).length} healthy eating days.` : `${recent.length} días registrados · ${recent.filter(r => r.exercise).length} días de ejercicio · ${recent.filter(r => r.healthy).length} días de comer sano.`);
  const steps = recent.filter(record => Number.isInteger(record.steps));
  if (steps.length) lines.push(`${english ? 'Recorded steps' : 'Pasos registrados'}: ${steps.reduce((sum, record) => sum + record.steps, 0).toLocaleString(english ? 'en-US' : 'es-CL')}.`);
  if (!recent.length) lines.push(english ? 'No new records in this period. Your cloud backup may need updating.' : 'No hay registros nuevos en este período. Puede que debas actualizar tu respaldo.');
  lines.push(english ? `The attached spreadsheet contains all ${snapshot.records.length} records from your saved backup (${backupDate.toISOString().slice(0, 10)}). New records on your phone are included after you save another backup.` : `El Excel adjunto contiene los ${snapshot.records.length} registros de tu respaldo guardado (${backupDate.toISOString().slice(0, 10)}). Los registros nuevos del teléfono se incluyen cuando vuelves a respaldar.`);
  return { english, lines, window };
}

export function createSummaryService({ pool, transaction, mailer, secret, appUrl, canUsePro = async () => true }) {
  const parsedUrl = new URL(appUrl);
  if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && ['127.0.0.1','localhost'].includes(parsedUrl.hostname))) throw new Error('PUBLIC_APP_URL must use HTTPS or a loopback development host.');
  const publicUrl = appUrl.replace(/\/+$/, '');
  let running = false;
  async function read(userId) {
    const { rows } = await pool.query(`SELECT e.*,p.updated_at AS backup_updated_at,(SELECT count(*)::integer FROM weight_records WHERE user_id=$1) AS record_count
      FROM users u LEFT JOIN email_preferences e ON e.user_id=u.id LEFT JOIN user_preferences p ON p.user_id=u.id WHERE u.id=$1`, [userId]);
    const row = rows[0];
    if (!row) throw new ApiError(401, 'unauthorized', 'Inicia sesión para continuar.');
    return { ...(row.user_id ? settingsFrom(row) : { enabled: false, cadence: 'weekly', timezone: 'UTC', time: '09:00', weekday: 1, monthDay: 1 }), nextSendAt: row.next_send_at || null, lastSentAt: row.last_sent_at || null, backupUpdatedAt: row.backup_updated_at || null, recordCount: row.record_count, mailMode: mailer.mode };
  }
  async function update(userId, payload) {
    const settings = validateEmailSettings(payload);
    await transaction(async client => {
      await client.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE', [userId]);
      if (!settings.enabled) {
        await client.query('UPDATE email_preferences SET enabled=false,next_send_at=NULL,updated_at=now() WHERE user_id=$1', [userId]);
        await client.query("UPDATE email_deliveries SET status='cancelled',locked_until=NULL WHERE user_id=$1 AND status IN ('pending','sending')", [userId]);
        return;
      }
      const saved = (await client.query('SELECT user_id FROM user_preferences WHERE user_id=$1 AND EXISTS(SELECT 1 FROM weight_records WHERE user_id=$1)', [userId])).rowCount;
      if (!saved) throw new ApiError(409, 'backup_required', 'Guarda primero un respaldo con registros en Ajustes.');
      const next = nextEmailRun(settings);
      await client.query(`INSERT INTO email_preferences(user_id,enabled,cadence,timezone,send_time,weekday,month_day,next_send_at,consent_at,unsubscribe_version)
        VALUES($1,true,$2,$3,$4,$5,$6,$7,now(),$8)
        ON CONFLICT(user_id) DO UPDATE SET enabled=true,cadence=EXCLUDED.cadence,timezone=EXCLUDED.timezone,send_time=EXCLUDED.send_time,weekday=EXCLUDED.weekday,month_day=EXCLUDED.month_day,next_send_at=EXCLUDED.next_send_at,consent_at=now(),unsubscribe_version=EXCLUDED.unsubscribe_version,updated_at=now()`,
      [userId, settings.cadence, settings.timezone, settings.time, settings.weekday, settings.monthDay, next, randomUUID()]);
      await client.query("UPDATE email_deliveries SET status='cancelled',locked_until=NULL WHERE user_id=$1 AND status IN ('pending','sending')", [userId]);
    });
    return read(userId);
  }
  async function unsubscribe(token, confirm = false) {
    const parsed = parseUnsubscribe(secret, token);
    if (!parsed) return false;
    if (!confirm) return (await pool.query('SELECT user_id FROM email_preferences WHERE user_id=$1 AND unsubscribe_version=$2', [parsed.id, parsed.version])).rowCount > 0;
    return transaction(async client => {
      // Same lock order as preference updates. Compare the version after acquiring
      // the account lock, so an old link cannot race a new opt-in and disable it.
      await client.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE', [parsed.id]);
      const current = await client.query('SELECT user_id FROM email_preferences WHERE user_id=$1 AND unsubscribe_version=$2 FOR UPDATE', [parsed.id, parsed.version]);
      if (!current.rowCount) return false;
      await client.query('UPDATE email_preferences SET enabled=false,next_send_at=NULL,updated_at=now() WHERE user_id=$1', [parsed.id]);
      await client.query("UPDATE email_deliveries SET status='cancelled',locked_until=NULL WHERE user_id=$1 AND status IN ('pending','sending')", [parsed.id]);
      return true;
    });
  }
  async function queueDue(now) {
    await transaction(async client => {
      const candidates = (await client.query('SELECT user_id FROM email_preferences WHERE enabled AND next_send_at <= $1 ORDER BY next_send_at LIMIT 10', [now])).rows;
      for (const candidate of candidates) {
        // Lock users before preferences everywhere, including queue creation.
        // This avoids FK-lock cycles with unsubscribe, opt-in changes or deletion.
        if (!(await client.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE SKIP LOCKED', [candidate.user_id])).rowCount) continue;
        const row = (await client.query('SELECT * FROM email_preferences WHERE user_id=$1 AND enabled AND next_send_at <= $2 FOR UPDATE SKIP LOCKED', [candidate.user_id, now])).rows[0];
        if (!row) continue;
        await client.query("INSERT INTO email_deliveries(id,user_id,scheduled_for,next_attempt_at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,scheduled_for) DO NOTHING", [randomUUID(), row.user_id, row.next_send_at, now]);
        // One catch-up after downtime, never a backlog of dozens of old emails.
        await client.query('UPDATE email_preferences SET next_send_at=$1 WHERE user_id=$2', [nextEmailRun(settingsFrom(row), now), row.user_id]);
      }
    });
  }
  async function claim(now) {
    return transaction(async client => {
      const { rows } = await client.query(`SELECT d.* FROM email_deliveries d JOIN email_preferences e ON e.user_id=d.user_id
        WHERE e.enabled AND d.status IN ('pending','sending') AND d.attempts < 5 AND d.next_attempt_at <= $1 AND (d.locked_until IS NULL OR d.locked_until < $1)
        ORDER BY d.next_attempt_at FOR UPDATE OF d SKIP LOCKED LIMIT 1`, [now]);
      const job = rows[0]; if (!job) return null;
      await client.query("UPDATE email_deliveries SET status='sending',attempts=attempts+1,locked_until=$2::timestamptz+interval '2 minutes' WHERE id=$1", [job.id, now]);
      return { ...job, attempts: job.attempts + 1 };
    });
  }
  async function deliver(job) {
    if (!await canUsePro(job.user_id)) {
      await pool.query("UPDATE email_deliveries SET status='cancelled',locked_until=NULL WHERE id=$1", [job.id]); return;
    }
    const stored = await transaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const row = (await client.query(`SELECT u.email,u.username,e.*,p.preferences,p.profile,p.metadata,p.updated_at AS backup_updated_at
        FROM users u JOIN email_preferences e ON e.user_id=u.id JOIN user_preferences p ON p.user_id=u.id WHERE u.id=$1 AND e.enabled`, [job.user_id])).rows[0];
      if (!row) return null;
      const records = (await client.query(`SELECT id,to_char(date,'YYYY-MM-DD') AS date,weight_kg AS "weightKg",exercise,healthy,note,steps FROM weight_records WHERE user_id=$1 ORDER BY date`, [job.user_id])).rows.map(record => { if (record.steps === null) delete record.steps; return record; });
      return { row, snapshot: { ...row.metadata, settings: row.preferences, profile: row.profile, records } };
    });
    if (!stored?.snapshot.records.length) {
      await pool.query("UPDATE email_deliveries SET status='cancelled',locked_until=NULL WHERE id=$1", [job.id]); return;
    }
    const { row, snapshot } = stored;
    const settings = settingsFrom(row);
    const content = summaryText(snapshot, settings, new Date(job.scheduled_for), row.backup_updated_at, row.username);
    const attachment = buildProgressWorkbook(snapshot, { generatedAt: new Date(), locale: content.english ? 'en-US' : 'es-CL', title: content.english ? 'Your complete progress' : 'Todo tu progreso', scopeLabel: content.english ? 'All cloud records' : 'Todos los registros respaldados' }, bytes => deflateRawSync(bytes, { level: 6 }));
    const token = unsubscribeToken(secret, row.user_id, row.unsubscribe_version);
    const url = `${publicUrl}/api/email-summary/unsubscribe?token=${encodeURIComponent(token)}`;
    const cancelText = content.english ? 'To stop these emails, turn off Email summary in Statistics → Pro reports, or open:' : 'Para dejar de recibirlos, desactiva Resumen por correo en Estadísticas → Informes Pro, o abre:';
    const accent = /^#[a-f0-9]{6}$/i.test(snapshot.settings.accentColor || '') ? snapshot.settings.accentColor : '#42FF85';
    const footer = mailer.mode === 'mailpit' ? (content.english ? 'Local preview: this message stays in Mailpit.' : 'Prueba local: este correo permanece en Mailpit.') : '';
    // Recheck opt-in after generating the workbook; account deletion or opt-out cancels queued work.
    const allowed = (await pool.query("SELECT d.id FROM email_deliveries d JOIN email_preferences e ON e.user_id=d.user_id JOIN users u ON u.id=d.user_id WHERE d.id=$1 AND d.status='sending' AND e.enabled AND u.email=$2 AND e.unsubscribe_version=$3", [job.id, row.email, row.unsubscribe_version])).rowCount;
    if (!allowed || !await canUsePro(job.user_id)) return;
    await mailer.send({ to: { address: row.email }, messageId: `<summary-${job.id}@weight-exercise.local>`, subject: content.english ? 'Weight&Exercise · Your progress summary' : 'Weight&Exercise · Tu resumen de progreso',
      text: [...content.lines, '', cancelText, url, '', footer].join('\n\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#111715;color:#f6faf7;padding:28px;border-top:5px solid ${accent};border-radius:20px"><h1 style="font-size:24px">Weight&amp;Exercise</h1>${content.lines.map(line => `<p style="line-height:1.6">${escape(line)}</p>`).join('')}<p style="font-size:12px;color:#c6d0ca">${escape(cancelText)} <a style="color:${accent}" href="${escape(url)}">${content.english ? 'Unsubscribe' : 'Cancelar suscripción'}</a></p><small>${escape(footer)}</small></div>`,
      headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      attachments: [{ filename: `WeightExercise-${content.window.to}.xlsx`, content: Buffer.from(attachment.buffer, attachment.byteOffset, attachment.byteLength), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
    });
    await transaction(async client => {
      if (!(await client.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE', [job.user_id])).rowCount) return;
      await client.query('SELECT user_id FROM email_preferences WHERE user_id=$1 FOR UPDATE', [job.user_id]);
      await client.query("UPDATE email_deliveries SET status='sent',sent_at=now(),locked_until=NULL,last_error=NULL WHERE id=$1", [job.id]);
      await client.query('UPDATE email_preferences SET last_sent_at=now() WHERE user_id=$1', [job.user_id]);
    });
  }
  async function runOnce() {
    if (running) return;
    running = true;
    try {
      await pool.query("UPDATE email_deliveries SET status='failed',locked_until=NULL,last_error='attempts_exhausted' WHERE status='sending' AND attempts >= 5 AND locked_until < now()");
      await queueDue(new Date());
      // One workbook at a time, maximum five deliveries per minute tick.
      for (let count = 0; count < 5; count++) {
        const job = await claim(new Date()); if (!job) break;
        try { await deliver(job); }
        catch {
          const delayMinutes = [1, 5, 30, 120, 240][Math.min(job.attempts - 1, 4)];
          await pool.query("UPDATE email_deliveries SET status=$2,next_attempt_at=now()+($3 * interval '1 minute'),locked_until=NULL,last_error='delivery_failed' WHERE id=$1 AND status='sending'", [job.id, job.attempts >= 5 ? 'failed' : 'pending', delayMinutes]);
          console.error('Progress summary delivery deferred.');
        }
      }
      await pool.query("DELETE FROM email_deliveries WHERE created_at < now()-interval '90 days' AND status IN ('sent','failed','cancelled')");
    } finally { running = false; }
  }
  return { read, update, unsubscribe, runOnce };
}
