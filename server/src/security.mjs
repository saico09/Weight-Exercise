import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function input(condition, message = 'Revisa los datos ingresados.') {
  if (!condition) throw new ApiError(400, 'invalid_input', message);
}
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function email(value) {
  input(typeof value === 'string');
  const normalized = value.trim().toLowerCase();
  input(normalized.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(normalized), 'Escribe un correo válido.');
  return normalized;
}
export function username(value) {
  input(typeof value === 'string' && /^[\p{L}\p{N}_-]{3,30}$/u.test(value), 'El nombre debe tener de 3 a 30 letras, números, guiones o guiones bajos.');
  return value;
}
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900) return false;
  const parsed = new Date(value + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function validateSnapshot(data) {
  input(object(data) && data.version === 1 && object(data.settings) && Array.isArray(data.records));
  input(JSON.stringify(data).length <= 2_000_000, 'El respaldo excede 2 MB. Reduce el tamaño de la foto.');
  input(data.records.length <= 36600, 'El respaldo excede 100 años de registros diarios.');
  if (data.profile !== null) {
    const p = data.profile;
    input(object(p) && p.heightCm >= 50 && p.heightCm <= 300 && Number.isFinite(p.heightCm));
    input(p.initialWeightKg >= 10 && p.initialWeightKg <= 650 && Number.isFinite(p.initialWeightKg));
    input(p.goalWeightKg >= 10 && p.goalWeightKg <= 650 && Number.isFinite(p.goalWeightKg));
    input(Number.isInteger(p.age) && p.age >= 5 && p.age <= 120 && date(p.initialDate));
    input(p.birthDate === undefined || date(p.birthDate));
  }
  const ids = new Set(); const dates = new Set();
  for (const record of data.records) {
    input(object(record) && typeof record.id === 'string' && record.id.trim().length > 0 && record.id.length <= 200);
    input(date(record.date) && Number.isFinite(record.weightKg) && record.weightKg >= 10 && record.weightKg <= 650);
    input(typeof record.exercise === 'boolean' && typeof record.healthy === 'boolean');
    input(typeof record.note === 'string' && record.note.length <= 2000);
    input(record.steps === undefined || (Number.isInteger(record.steps) && record.steps >= 0 && record.steps <= 200000));
    input(!ids.has(record.id) && !dates.has(record.date), 'Hay registros repetidos en el respaldo.');
    ids.add(record.id); dates.add(record.date);
  }
  input(data.initialRecordId === null || (typeof data.initialRecordId === 'string' && ids.has(data.initialRecordId)));
  input(data.lastPromptDate === null || date(data.lastPromptDate));
  input(['dark', 'light', 'aurora', 'sand'].includes(data.settings.theme) && ['es', 'en'].includes(data.settings.language));
  input(['kg', 'lb'].includes(data.settings.weightUnit) && ['cm', 'ft'].includes(data.settings.heightUnit));
  input(data.settings.chartStyle === undefined || ['area','line','bars','depth'].includes(data.settings.chartStyle));
  input(data.settings.goalChartStyle === undefined || ['ring','depth'].includes(data.settings.goalChartStyle));
  input(data.settings.stepGoal === undefined || data.settings.stepGoal === null || (Number.isInteger(data.settings.stepGoal) && data.settings.stepGoal >= 100 && data.settings.stepGoal <= 50000));
  const { settings, profile, records, ...metadata } = data;
  return { settings, profile, records, metadata };
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const makeToken = () => randomBytes(32).toString('base64url');
export const makeCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');
export const keyedHash = (secret, ...values) => createHmac('sha256', secret).update(JSON.stringify(values)).digest('hex');
export function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
export function sessionToken(request) {
  const part = request.headers.cookie?.split(';').find(p => p.trim().startsWith('we_session='));
  const token = part?.trim().slice('we_session='.length);
  return token && /^[\w-]{43}$/.test(token) ? token : null;
}
export const sessionCookie = token => `we_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800`;
export const expiredCookie = 'we_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0';
