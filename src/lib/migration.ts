import { getAchievements } from './achievements';
import { ageFromBirthDate, dateKey, defaultData, type AppData, type DailyRecord, type Profile } from './model';
import { validMotivationImage } from './motivation';
import { validProfilePhoto } from './profilePhoto';
import { canUseTheme } from './rewardThemes';

export const MAX_BASIC_TRANSFER_BYTES = 4 * 1024 * 1024;
export const BASIC_TRANSFER_FORMAT = 'weight-exercise.basic-transfer';
export type BasicTransferErrorCode = 'too-large' | 'invalid' | 'unsupported-version' | 'no-profile';

export class BasicTransferError extends Error {
  constructor(public readonly code: BasicTransferErrorCode, message: string) {
    super(message);
    this.name = 'BasicTransferError';
  }
}

function invalid(): never {
  throw new BasicTransferError('invalid', 'Los datos de Basic no son válidos o están incompletos. No se ha cambiado nada.');
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1900 && value <= dateKey() && dateKey(new Date(year, month - 1, day, 12)) === value;
}
function time(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) return invalid();
  return value as T;
}
const knownAchievements = new Set(getAchievements(defaultData()).map(achievement => achievement.id));

/** Strict transfer parsing: one invalid record rejects the entire import, never silently drops a day. */
export function parseBasicTransfer(text: string): AppData {
  if (typeof text !== 'string') return invalid();
  if (text.length > MAX_BASIC_TRANSFER_BYTES || new TextEncoder().encode(text).byteLength > MAX_BASIC_TRANSFER_BYTES) {
    throw new BasicTransferError('too-large', 'La transferencia supera el límite de 4 MB.');
  }
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return invalid(); }
  const envelope = object(raw);
  if (envelope.format !== BASIC_TRANSFER_FORMAT) return invalid();
  if (envelope.version !== 1) throw new BasicTransferError('unsupported-version', 'Esta transferencia necesita otra versión de Pro. Actualiza ambas aplicaciones.');
  if (typeof envelope.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(envelope.createdAt)
    || !Number.isFinite(Date.parse(envelope.createdAt)) || Date.parse(envelope.createdAt) > Date.now() + 300_000) return invalid();
  const snapshot = object(envelope.snapshot);
  if (snapshot.profile === null) throw new BasicTransferError('no-profile', 'Primero completa tu perfil en Basic.');
  const rawProfile = object(snapshot.profile);
  if (!finite(rawProfile.heightCm, 50, 300) || !finite(rawProfile.initialWeightKg, 10, 650)
    || !finite(rawProfile.goalWeightKg, 10, 650) || !finite(rawProfile.age, 5, 120)
    || !Number.isInteger(rawProfile.age) || !date(rawProfile.initialDate)) return invalid();
  const profile: Profile = {
    heightCm: rawProfile.heightCm, initialWeightKg: rawProfile.initialWeightKg,
    goalWeightKg: rawProfile.goalWeightKg, age: rawProfile.age, initialDate: rawProfile.initialDate,
  };
  if (rawProfile.photo !== undefined) {
    if (!validProfilePhoto(rawProfile.photo)) return invalid();
    profile.photo = rawProfile.photo;
  }
  if (rawProfile.birthDate !== undefined) {
    if (!date(rawProfile.birthDate) || !finite(ageFromBirthDate(rawProfile.birthDate), 5, 120)) return invalid();
    profile.birthDate = rawProfile.birthDate;
  }
  if (!Array.isArray(snapshot.records)) return invalid();
  const ids = new Set<string>();
  const dates = new Set<string>();
  const records: DailyRecord[] = snapshot.records.map(rawRecord => {
    const record = object(rawRecord);
    if (typeof record.id !== 'string' || !record.id.trim() || record.id.length > 200 || ids.has(record.id)
      || !date(record.date) || dates.has(record.date) || !finite(record.weightKg, 10, 650)
      || typeof record.exercise !== 'boolean' || typeof record.healthy !== 'boolean'
      || typeof record.note !== 'string' || record.note.length > 2000) return invalid();
    ids.add(record.id); dates.add(record.date);
    // Explicit fields: a transfer cannot fabricate Health Connect readings or import account/session fields.
    return { id: record.id, date: record.date, weightKg: record.weightKg, exercise: record.exercise, healthy: record.healthy, note: record.note };
  });
  records.sort((a, b) => a.date.localeCompare(b.date));
  if (snapshot.initialRecordId !== null && (typeof snapshot.initialRecordId !== 'string' || !ids.has(snapshot.initialRecordId))) return invalid();
  const rawSettings = object(snapshot.settings);
  const notifications = object(rawSettings.notifications);
  if (notifications.enabled !== false || !time(notifications.time) || !Array.isArray(notifications.days)
    || notifications.days.some(day => !finite(day, 0, 6) || !Number.isInteger(day))
    || new Set(notifications.days).size !== notifications.days.length) return invalid();
  const motivation = object(rawSettings.motivation);
  if (typeof motivation.message !== 'string' || !motivation.message.trim() || motivation.message.length > 180
    || (motivation.image !== null && !validMotivationImage(motivation.image))) return invalid();
  if (!Array.isArray(snapshot.celebratedAchievementIds)
    || snapshot.celebratedAchievementIds.length > 500
    || snapshot.celebratedAchievementIds.some(id => typeof id !== 'string')) return invalid();
  const result = defaultData();
  result.profile = profile;
  result.records = records;
  result.initialRecordId = snapshot.initialRecordId as string | null;
  result.settings.theme = choice(rawSettings.theme, ['dark', 'light', 'gold', 'platinum']);
  result.settings.language = choice(rawSettings.language, ['es', 'en']);
  result.settings.weightUnit = choice(rawSettings.weightUnit, ['kg', 'lb']);
  result.settings.heightUnit = choice(rawSettings.heightUnit, ['cm', 'ft']);
  result.settings.notifications = { enabled: false, time: notifications.time, days: [...notifications.days] as number[] };
  result.settings.motivation = { message: motivation.message, image: motivation.image as string | null };
  result.celebratedAchievementIds = [...new Set(snapshot.celebratedAchievementIds as string[])].filter(id => knownAchievements.has(id));
  const initial = records.find(record => record.id === result.initialRecordId);
  if (initial) {
    // The selected baseline record is authoritative, as it is when edited in the app.
    result.profile.initialWeightKg = initial.weightKg;
    result.profile.initialDate = initial.date;
  }
  if (!canUseTheme(result.settings.theme, result)) result.settings.theme = 'dark';
  // Whether today's record exists determines prompting; no permission/prompt state is transferred.
  result.lastPromptDate = records.some(record => record.date === dateKey()) ? dateKey() : null;
  return result;
}

function sameDayValues(a: DailyRecord, b: DailyRecord): boolean {
  return a.weightKg === b.weightKg && a.exercise === b.exercise && a.healthy === b.healthy && a.note === b.note;
}

export interface BasicTransferSummary {
  incomingRecords: number;
  newRecords: number;
  conflicts: number;
  identicalRecords: number;
}

/** Notes count as a conflict too; Pro-only step readings never cause a conflict. */
export function summarizeBasicTransfer(current: AppData, incoming: AppData): BasicTransferSummary {
  const byDate = new Map(current.records.map(record => [record.date, record]));
  const summary: BasicTransferSummary = { incomingRecords: incoming.records.length, newRecords: 0, conflicts: 0, identicalRecords: 0 };
  for (const record of incoming.records) {
    const existing = byDate.get(record.date);
    if (!existing) summary.newRecords += 1;
    else if (sameDayValues(existing, record)) summary.identicalRecords += 1;
    else summary.conflicts += 1;
  }
  return summary;
}

/** Merge only a parsed transfer. Both inputs remain untouched; repeated imports are idempotent by date. */
export function mergeBasicTransfer(current: AppData, incoming: AppData, policy: 'keep-pro' | 'use-basic' = 'keep-pro'): AppData {
  const hasProfile = current.profile !== null;
  const source = hasProfile ? current : incoming;
  const result: AppData = {
    ...current,
    profile: source.profile ? { ...source.profile } : null,
    settings: {
      ...source.settings,
      notifications: { ...source.settings.notifications, days: [...source.settings.notifications.days] },
      recap: { ...source.settings.recap }, motivation: { ...source.settings.motivation }, steps: { ...source.settings.steps },
    },
    records: current.records.map(record => ({ ...record })),
    celebratedAchievementIds: [...new Set([...current.celebratedAchievementIds, ...incoming.celebratedAchievementIds])].filter(id => knownAchievements.has(id)),
  };
  if (!hasProfile) {
    result.settings.notifications.enabled = false;
    result.settings.recap.enabled = false;
    result.settings.steps.enabled = false;
  }
  const byDate = new Map(result.records.map(record => [record.date, record]));
  const usedIds = new Set(result.records.map(record => record.id));
  for (const record of incoming.records) {
    const existing = byDate.get(record.date);
    if (existing) {
      if (policy === 'use-basic') {
        // Preserve native steps and Pro ID. Basic owns only weight, exercise, healthy and note values.
        existing.weightKg = record.weightKg; existing.exercise = record.exercise;
        existing.healthy = record.healthy; existing.note = record.note;
      }
      continue;
    }
    let id = record.id;
    let suffix = 0;
    while (usedIds.has(id)) id = `basic-${record.date}-${++suffix}`;
    usedIds.add(id);
    const added: DailyRecord = { id, date: record.date, weightKg: record.weightKg, exercise: record.exercise, healthy: record.healthy, note: record.note };
    result.records.push(added); byDate.set(added.date, added);
  }
  result.records.sort((a, b) => a.date.localeCompare(b.date));
  if (!hasProfile) {
    const initial = incoming.records.find(record => record.id === incoming.initialRecordId);
    result.initialRecordId = initial ? byDate.get(initial.date)!.id : null;
  }
  const initial = result.records.find(record => record.id === result.initialRecordId);
  if (initial && result.profile) {
    result.profile.initialWeightKg = initial.weightKg;
    result.profile.initialDate = initial.date;
  }
  if (!canUseTheme(result.settings.theme, result)) result.settings.theme = 'dark';
  if (result.records.some(record => record.date === dateKey())) result.lastPromptDate = dateKey();
  return result;
}
