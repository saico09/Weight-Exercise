import { normalizeMotivation } from './motivation';
import { validProfilePhoto } from './profilePhoto';
/** All stored measurements use kg and cm; units only affect presentation. */
export type Theme = 'dark' | 'light' | 'gold' | 'platinum';
export type Language = 'es' | 'en';
export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ft';

export interface Profile {
  photo?: string;
  heightCm: number;
  initialWeightKg: number;
  goalWeightKg: number;
  age: number;
  birthDate?: string;
  initialDate: string;
}

export interface DailyRecord {
  id: string;
  date: string;
  weightKg: number;
  exercise: boolean;
  healthy: boolean;
  note: string;
}

export interface Settings {
  theme: Theme;
  accentColor: string | null;
  language: Language;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  notifications: { enabled: boolean; time: string; days: number[] };
  recap: { enabled: boolean; period: 'weekly' | 'monthly'; time: string };
  motivation: { message: string; image: string | null };
}

export interface AppData {
  version: 1;
  profile: Profile | null;
  records: DailyRecord[];
  settings: Settings;
  initialRecordId: string | null;
  lastPromptDate: string | null;
  celebratedAchievementIds: string[];
}

export function defaultData(): AppData {
  return {
    version: 1,
    profile: null,
    records: [],
    settings: {
      theme: 'dark',
      accentColor: null,
      language: 'es',
      weightUnit: 'kg',
      heightUnit: 'cm',
      notifications: { enabled: false, time: '20:00', days: [0, 1, 2, 3, 4, 5, 6] },
      recap: { enabled: false, period: 'weekly', time: '19:00' },
      motivation: { message: 'Hazlo por él', image: null },
    },
    initialRecordId: null,
    lastPromptDate: null,
    celebratedAchievementIds: [],
  };
}

/** Local calendar date, deliberately not UTC/toISOString(). */
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Calendar arithmetic at noon avoids midnight daylight-saving transitions. */
export function shiftDate(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** Completed calendar years; returns NaN for impossible/future dates. */
export function ageFromBirthDate(birthDate: string, asOf = dateKey()): number {
  if (!validDate(birthDate) || !validDate(asOf) || birthDate > asOf) return NaN;
  const [year, month, day] = birthDate.split('-').map(Number);
  const [nowYear, nowMonth, nowDay] = asOf.split('-').map(Number);
  return nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0);
}

export function profileAge(profile: Profile, asOf = dateKey()): number {
  return profile.birthDate ? ageFromBirthDate(profile.birthDate, asOf) : profile.age;
}

const KG_PER_LB = 0.45359237;

export function fromKg(kg: number, unit: WeightUnit = 'kg'): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

export function toKg(weight: number, unit: WeightUnit = 'kg'): number {
  return unit === 'lb' ? weight * KG_PER_LB : weight;
}

/** Formatted numeric value only; the caller supplies its unit label. */
export function displayWeight(kg: number, unit: WeightUnit = 'kg', digits = 1, locale = 'es-CL'): string {
  return fromKg(kg, unit).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function displayHeight(cm: number, unit: HeightUnit = 'cm', locale = 'es-CL'): string {
  if (unit === 'cm') return `${cm.toLocaleString(locale, { maximumFractionDigits: 1 })} cm`;
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′ ${inches % 12}″`;
}

export function bmi(weightKg: number, heightCm: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) return NaN;
  return weightKg / (heightCm / 100) ** 2;
}

export interface BmiRange {
  label: string;
  min: number;
  max: number;
  color: string;
}

/**
 * Screening categories, not diagnoses. All min values inclusive, max exclusive.
 * CDC adult categories apply from age 20, independent of adult age or sex:
 * https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html
 * WHO thinness subclasses: <16, 16–<17, 17–<18.5:
 * https://iris.who.int/bitstream/handle/10665/119533/dsa55.pdf?sequence=1
 * Younger people need BMI-for-age assessment, which this app does not provide.
 */
export const BMI_RANGES: readonly BmiRange[] = [
  { label: 'Bajo peso severo', min: 0, max: 16, color: '#6088d2' },
  { label: 'Bajo peso moderado', min: 16, max: 17, color: '#73b3dd' },
  { label: 'Bajo peso leve', min: 17, max: 18.5, color: '#91d4de' },
  { label: 'Peso normal', min: 18.5, max: 25, color: '#42ff85' },
  { label: 'Sobrepeso', min: 25, max: 30, color: '#dfd77b' },
  { label: 'Obesidad I', min: 30, max: 35, color: '#efa76a' },
  { label: 'Obesidad II', min: 35, max: 40, color: '#e77f75' },
  { label: 'Obesidad III', min: 40, max: Infinity, color: '#d76a8a' },
];

export function bmiCategory(value: number, age = 20): BmiRange | null {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(age) || age < 20) return null;
  return BMI_RANGES.find((range) => value >= range.min && value < range.max) ?? null;
}

export interface WeekSummary {
  /** Monday of a calendar week, in local YYYY-MM-DD format. */
  startDate: string;
  records: DailyRecord[];
  averageWeight: number;
  exerciseDays: number;
  healthyDays: number;
}

export interface Stats {
  /** Records on/after the selected baseline, sorted chronologically, through today. */
  records: DailyRecord[];
  /** All records sorted chronologically, including records before the baseline. */
  allRecords: DailyRecord[];
  initialRecord: DailyRecord | null;
  latestRecord: DailyRecord | null;
  startDate: string;
  initialWeight: number;
  currentWeight: number;
  goalWeight: number;
  minWeight: number;
  maxWeight: number;
  /** Current weight minus baseline weight; negative means weight loss. */
  change: number;
  /** Baseline minus current; negative means weight gain. */
  lost: number;
  /** Distance still required in the goal direction; zero after reaching the goal. */
  remaining: number;
  /** Goal progress percentage clamped to [0, 100]; supports loss, gain and maintenance. */
  progress: number;
  exerciseDays: number;
  /** Explicit exercise=false records only. Missing dates are never counted as rest. */
  restDays: number;
  healthyDays: number;
  /** Number of recorded days, not elapsed days. */
  totalDays: number;
  /** Consecutive recording dates ending today or yesterday. */
  streak: number;
  /** Rolling 7 calendar days including today, within the selected baseline. */
  weekRecords: DailyRecord[];
  weeklyAverageWeight: number | null;
  /** Current rolling 7-day mean minus previous 7-day mean; null if either has no data. */
  weeklyChange: number | null;
  weeklyLoss: number | null;
  /** Exercise days per calendar week with at least one recorded day. */
  weeklyExerciseAverage: number;
  weeks: WeekSummary[];
  currentBmi: number | null;
  adultBmi: boolean;
}

function average(records: DailyRecord[]): number | null {
  return records.length ? records.reduce((sum, record) => sum + record.weightKg, 0) / records.length : null;
}

function mondayOf(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const weekday = new Date(year, month - 1, day, 12).getDay();
  return shiftDate(key, -((weekday + 6) % 7));
}

/** Pure derived metrics. Pass `now` for deterministic tests or previews. */
export function getStats(data: AppData, now = new Date()): Stats {
  const today = dateKey(now);
  const allRecords = [...data.records].sort((a, b) => a.date.localeCompare(b.date));
  const initialRecord = allRecords.find((record) => record.id === data.initialRecordId && record.date <= today) ?? null;
  const startDate = initialRecord?.date ?? data.profile?.initialDate ?? today;
  const initialWeight = initialRecord?.weightKg ?? data.profile?.initialWeightKg ?? 0;
  const records = allRecords.filter((record) => record.date >= startDate && record.date <= today);
  const latestRecord = records.at(-1) ?? null;
  const currentWeight = latestRecord?.weightKg ?? initialWeight;
  const goalWeight = data.profile?.goalWeightKg ?? initialWeight;
  const distance = goalWeight - initialWeight;
  const change = currentWeight - initialWeight;
  const progress = distance === 0 ? (Math.abs(change) < 0.05 ? 100 : 0) : Math.min(100, Math.max(0, (change / distance) * 100));
  const remaining = distance === 0 ? Math.abs(change) : Math.max(0, (goalWeight - currentWeight) * Math.sign(distance));
  const weights = [initialWeight, ...records.map((record) => record.weightKg)].filter((weight) => weight > 0);
  const weekStart = shiftDate(today, -6);
  const previousStart = shiftDate(today, -13);
  const weekRecords = records.filter((record) => record.date >= weekStart);
  const previousWeek = records.filter((record) => record.date >= previousStart && record.date < weekStart);
  const weeklyAverageWeight = average(weekRecords);
  const previousAverage = average(previousWeek);
  const weeklyChange = weeklyAverageWeight !== null && previousAverage !== null ? weeklyAverageWeight - previousAverage : null;

  const grouped = new Map<string, DailyRecord[]>();
  for (const record of records) {
    const start = mondayOf(record.date);
    grouped.set(start, [...(grouped.get(start) ?? []), record]);
  }
  const weeks: WeekSummary[] = Array.from(grouped, ([start, entries]) => ({
    startDate: start,
    records: entries,
    averageWeight: average(entries)!,
    exerciseDays: entries.filter((entry) => entry.exercise).length,
    healthyDays: entries.filter((entry) => entry.healthy).length,
  }));
  const exerciseDays = records.filter((record) => record.exercise).length;
  const dates = new Set(records.map((record) => record.date));
  let streak = 0;
  let cursor = dates.has(today) ? today : shiftDate(today, -1);
  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return {
    records, allRecords, initialRecord, latestRecord, startDate,
    initialWeight, currentWeight, goalWeight,
    minWeight: weights.length ? Math.min(...weights) : 0,
    maxWeight: weights.length ? Math.max(...weights) : 0,
    change, lost: -change, remaining, progress,
    exerciseDays, restDays: records.length - exerciseDays,
    healthyDays: records.filter((record) => record.healthy).length,
    totalDays: records.length, streak, weekRecords, weeklyAverageWeight, weeklyChange,
    weeklyLoss: weeklyChange === null ? null : -weeklyChange,
    weeklyExerciseAverage: weeks.length ? exerciseDays / weeks.length : 0,
    weeks,
    currentBmi: data.profile ? bmi(currentWeight, data.profile.heightCm) : null,
    adultBmi: !!data.profile && profileAge(data.profile, today) >= 20,
  };
}

/** Explicit, disposable preview data; never added to a new user's real history. */
export function demoData(now = new Date()): AppData {
  const data = defaultData();
  const today = dateKey(now);
  const first = shiftDate(today, -364);
  data.profile = { heightCm: 178, initialWeightKg: 86.4, goalWeightKg: 76, age: 28, initialDate: first };
  data.records = Array.from({ length: 365 }, (_, index) => ({
    id: `demo-${index + 1}`,
    date: shiftDate(first, index),
    weightKg: index === 0 ? 86.4 : index === 364 ? 76 : Math.round((86.4 - index * (10.4 / 364) + Math.sin(index * 1.7) * 0.27) * 10) / 10,
    exercise: ![2, 5].includes(index % 7),
    healthy: index % 6 !== 4,
    note: index === 364 ? 'Un año de constancia. Meta cumplida.' : '',
  }));
  data.initialRecordId = data.records[0].id;
  data.lastPromptDate = today;
  return data;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function finiteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1900 && year <= 9999 && dateKey(new Date(year, month - 1, day, 12)) === value;
}

/**
 * Parse local persisted data without trusting its shape. Malformed root/profile or
 * unknown versions return null. Invalid records are omitted; optional settings
 * fall back individually. Last valid duplicate date/ID wins. Unknown fields are
 * dropped so callers never receive unsanitized values.
 */
export function validateData(raw: unknown): AppData | null {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  const input = object(raw);
  if (!input || input.version !== 1 || !Array.isArray(input.records)) return null;
  const result = defaultData();
  if (input.profile !== null) {
    const profile = object(input.profile);
    if (!profile || !finiteIn(profile.heightCm, 50, 300)
      || !finiteIn(profile.initialWeightKg, 10, 650) || !finiteIn(profile.goalWeightKg, 10, 650)
      || !finiteIn(profile.age, 5, 120) || !Number.isInteger(profile.age) || !validDate(profile.initialDate)) return null;
    result.profile = {
      heightCm: profile.heightCm, initialWeightKg: profile.initialWeightKg,
      goalWeightKg: profile.goalWeightKg, age: profile.age, initialDate: profile.initialDate,
    };
    if (validProfilePhoto(profile.photo)) result.profile.photo = profile.photo;
    // Optional migration: old age-only profiles remain valid. Never invent a birthday.
    if (validDate(profile.birthDate) && ageFromBirthDate(profile.birthDate) >= 5 && ageFromBirthDate(profile.birthDate) <= 120) {
      result.profile.birthDate = profile.birthDate;
    }
  }

  const seenDates = new Set<string>();
  const seenIds = new Set<string>();
  for (let index = input.records.length - 1; index >= 0; index -= 1) {
    const record = object(input.records[index]);
    if (!record || typeof record.id !== 'string' || !record.id.trim() || record.id.length > 200
      || !validDate(record.date) || !finiteIn(record.weightKg, 10, 650)
      || typeof record.exercise !== 'boolean' || typeof record.healthy !== 'boolean'
      || seenDates.has(record.date) || seenIds.has(record.id)) continue;
    seenDates.add(record.date);
    seenIds.add(record.id);
    result.records.push({
      id: record.id, date: record.date, weightKg: record.weightKg,
      exercise: record.exercise, healthy: record.healthy,
      note: typeof record.note === 'string' ? record.note.slice(0, 2000) : '',
    });
  }
  result.records.sort((a, b) => a.date.localeCompare(b.date));
  const settings = object(input.settings);
  if (settings) {
    result.settings.motivation = normalizeMotivation(settings.motivation);
    // Legacy Pro preferences are ignored by this Basic build.
    if (settings.theme === 'dark' || settings.theme === 'light' || settings.theme === 'gold' || settings.theme === 'platinum') result.settings.theme = settings.theme;
    if (settings.language === 'es' || settings.language === 'en') result.settings.language = settings.language;
    if (settings.weightUnit === 'kg' || settings.weightUnit === 'lb') result.settings.weightUnit = settings.weightUnit;
    if (settings.heightUnit === 'cm' || settings.heightUnit === 'ft') result.settings.heightUnit = settings.heightUnit;
    const notifications = object(settings.notifications);
    if (notifications) {
      if (typeof notifications.enabled === 'boolean') result.settings.notifications.enabled = notifications.enabled;
      if (typeof notifications.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(notifications.time)) result.settings.notifications.time = notifications.time;
      if (Array.isArray(notifications.days)) {
        result.settings.notifications.days = [...new Set(notifications.days.filter((day): day is number => finiteIn(day, 0, 6) && Number.isInteger(day)))].sort();
      }
      if (!result.settings.notifications.days.length) result.settings.notifications.enabled = false;
    }
  }
  result.initialRecordId = typeof input.initialRecordId === 'string' && result.records.some((record) => record.id === input.initialRecordId) ? input.initialRecordId : null;
  result.lastPromptDate = validDate(input.lastPromptDate) ? input.lastPromptDate : null;
  if (Array.isArray(input.celebratedAchievementIds)) result.celebratedAchievementIds = [...new Set(input.celebratedAchievementIds.filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id)))].slice(0, 500);
  return result;
}
