import { input } from './security.mjs';

const formatters = new Map();
function formatter(timezone) {
  let value = formatters.get(timezone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    if (formatters.size >= 32) formatters.delete(formatters.keys().next().value);
    formatters.set(timezone, value);
  }
  return value;
}
export function localParts(instant, timezone) {
  return Object.fromEntries(formatter(timezone).formatToParts(instant).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}
export function validTimezone(value) {
  if (typeof value !== 'string' || value.length > 80) return false;
  try { formatter(value).format(new Date()); return true; } catch { return false; }
}
export function validateEmailSettings(value) {
  input(value && typeof value.enabled === 'boolean');
  if (!value.enabled) return { enabled: false };
  input(value.consent === true, 'Confirma que quieres recibir tu resumen por correo.');
  input(['weekly', 'monthly'].includes(value.cadence));
  input(validTimezone(value.timezone), 'Elige una zona horaria válida.');
  input(typeof value.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time));
  input(Number.isInteger(value.weekday) && value.weekday >= 0 && value.weekday <= 6);
  input(Number.isInteger(value.monthDay) && value.monthDay >= 1 && value.monthDay <= 28);
  return { enabled: true, cadence: value.cadence, timezone: value.timezone, time: value.time, weekday: value.weekday, monthDay: value.monthDay };
}
function wallToUtc(year, month, day, hour, minute, timezone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // A nonexistent DST wall time advances to the next valid minute (at most 2h).
  for (let shift = 0; shift <= 120; shift++) {
    const target = wall + shift * 60000;
    let guess = target;
    for (let round = 0; round < 5; round++) {
      const p = localParts(new Date(guess), timezone);
      const rendered = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
      if (rendered === target) return new Date(guess);
      guess += target - rendered;
    }
  }
  throw new Error('Could not resolve schedule timezone.');
}
export function nextEmailRun(settings, after = new Date()) {
  const p = localParts(after, settings.timezone);
  const [hour, minute] = settings.time.split(':').map(Number);
  for (let days = 0; days <= 62; days++) {
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
    if (settings.cadence === 'weekly' ? day.getUTCDay() !== settings.weekday : day.getUTCDate() !== settings.monthDay) continue;
    const candidate = wallToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, minute, settings.timezone);
    if (candidate > after) return candidate;
  }
  throw new Error('Could not calculate next schedule.');
}
export function summaryWindow(scheduledFor, settings) {
  const p = localParts(scheduledFor, settings.timezone);
  const end = new Date(Date.UTC(p.year, p.month - 1, p.day - 1));
  let start;
  if (settings.cadence === 'weekly') start = new Date(Date.UTC(p.year, p.month - 1, p.day - 7));
  else start = new Date(Date.UTC(p.year, p.month - 2, Math.min(p.day, new Date(Date.UTC(p.year, p.month - 1, 0)).getUTCDate())));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
