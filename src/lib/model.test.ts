import { describe, expect, it } from 'vitest';
import {
  BMI_RANGES, bmi, bmiCategory, dateKey, defaultData, demoData,
  displayHeight, displayWeight, fromKg, getStats, shiftDate, toKg, validateData, ageFromBirthDate, profileAge,
} from './model';
import type { AppData, DailyRecord } from './model';

const today = new Date(2026, 9, 14, 12);

describe('birth dates and language migration', () => {
  it('changes age on the birthday and rejects impossible or future dates', () => {
    expect(ageFromBirthDate('2006-10-15', '2026-10-14')).toBe(19);
    expect(ageFromBirthDate('2006-10-14', '2026-10-14')).toBe(20);
    expect(ageFromBirthDate('2006-10-13', '2026-10-14')).toBe(20);
    expect(ageFromBirthDate('2024-02-29', '2026-02-28')).toBe(1);
    expect(ageFromBirthDate('2024-02-29', '2026-03-01')).toBe(2);
    expect(ageFromBirthDate('2001-02-29', '2026-10-14')).toBeNaN();
    expect(ageFromBirthDate('2027-01-01', '2026-10-14')).toBeNaN();
  });

  it('keeps legacy profiles intact and defaults missing language to Spanish', () => {
    const data = demoData(today);
    const { language: _, ...legacySettings } = data.settings;
    const migrated = validateData({ ...data, settings: legacySettings });
    expect(migrated?.settings.language).toBe('es');
    expect(migrated?.records).toEqual(data.records);
    expect(migrated?.profile?.birthDate).toBeUndefined();
    expect(profileAge(migrated!.profile!, '2026-10-14')).toBe(28);
    expect(validateData({ ...data, settings: { ...data.settings, language: 'en' } })?.settings.language).toBe('en');
  });

  it('uses birth date rather than stale saved age for BMI eligibility', () => {
    const data = demoData(today);
    data.profile = { ...data.profile!, age: 19, birthDate: '2006-10-14' };
    expect(getStats(data, new Date(2026, 9, 13, 12)).adultBmi).toBe(false);
    expect(getStats(data, today).adultBmi).toBe(true);
    expect(validateData(data)?.profile?.birthDate).toBe('2006-10-14');
  });

  it('uses the selected locale without changing canonical values', () => {
    expect(displayWeight(81.2, 'kg', 1, 'en-US')).toBe('81.2');
    expect(displayWeight(81.2, 'kg', 1, 'es-CL')).toBe('81,2');
    expect(displayHeight(170.5, 'cm', 'en-US')).toBe('170.5 cm');
  });
});

function record(date: string, weightKg: number, exercise = true): DailyRecord {
  return { id: `record-${date}`, date, weightKg, exercise, healthy: true, note: '' };
}

function sample(records: DailyRecord[], initialWeightKg = 90, goalWeightKg = 75): AppData {
  return {
    ...defaultData(),
    profile: { heightCm: 180, age: 30, initialDate: '2026-10-01', initialWeightKg, goalWeightKg },
    records,
  };
}

describe('measurement units and local dates', () => {
  it('round-trips pounds without changing stored measurements', () => {
    expect(toKg(100, 'lb')).toBeCloseTo(45.359237, 8);
    expect(fromKg(45.359237, 'lb')).toBeCloseTo(100, 8);
    expect(toKg(fromKg(81.23456, 'lb'), 'lb')).toBeCloseTo(81.23456, 10);
    expect(fromKg(81.2)).toBe(81.2);
    expect(displayWeight(81.2)).toBe('81,2');
  });

  it('displays complete feet/inches and carries rounded inches into feet', () => {
    expect(displayHeight(180)).toBe('180 cm');
    expect(displayHeight(180, 'ft')).toBe('5′ 11″');
    expect(displayHeight(182.8, 'ft')).toBe('6′ 0″');
  });

  it('uses the local day even close to midnight and crosses calendar boundaries', () => {
    expect(dateKey(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('does not skip a date during Chilean daylight-saving changes', () => {
    expect(shiftDate('2026-09-05', 1)).toBe('2026-09-06');
    expect(shiftDate('2026-09-06', 1)).toBe('2026-09-07');
    expect(shiftDate('2026-04-05', -1)).toBe('2026-04-04');
  });
});

describe('BMI is a screened adult measurement', () => {
  it('calculates from canonical units and rejects invalid inputs', () => {
    expect(bmi(81, 180)).toBe(25);
    expect(bmi(81, 0)).toBeNaN();
    expect(bmi(Infinity, 180)).toBeNaN();
    expect(bmi(-1, 180)).toBeNaN();
  });

  it('assigns exact category boundaries without display-rounding errors', () => {
    for (let index = 1; index < BMI_RANGES.length; index += 1) {
      const boundary = BMI_RANGES[index].min;
      expect(bmiCategory(boundary)?.label).toBe(BMI_RANGES[index].label);
      expect(bmiCategory(boundary - 0.00001)?.label).toBe(BMI_RANGES[index - 1].label);
    }
    expect(bmiCategory(24.99)?.label).toBe('Peso normal');
    expect(bmiCategory(65)?.label).toBe('Obesidad III');
  });

  it('does not apply adult categories to people younger than 20', () => {
    expect(bmiCategory(25, 19)).toBeNull();
    expect(bmiCategory(25, 20)?.label).toBe('Sobrepeso');
    expect(bmiCategory(NaN)).toBeNull();
    expect(bmiCategory(0)).toBeNull();
    expect(bmiCategory(25, NaN)).toBeNull();
    const data = sample([]);
    data.profile!.age = 19;
    expect(getStats(data, today).adultBmi).toBe(false);
  });
});

describe('history and goal statistics', () => {
  it('derives latest/min/max from chronological dates without mutating history', () => {
    const records = [record('2026-10-14', 83), record('2026-10-01', 90), record('2026-10-08', 85)];
    const data = sample(records);
    const stats = getStats(data, today);
    expect(stats.currentWeight).toBe(83);
    expect(stats.minWeight).toBe(83);
    expect(stats.maxWeight).toBe(90);
    expect(stats.change).toBe(-7);
    expect(stats.remaining).toBe(8);
    expect(stats.progress).toBeCloseTo((7 / 15) * 100);
    expect(data.records[0].date).toBe('2026-10-14');
  });

  it('respects a chosen baseline while retaining earlier history', () => {
    const data = sample([record('2026-10-01', 90), record('2026-10-08', 85), record('2026-10-14', 83)]);
    data.initialRecordId = 'record-2026-10-08';
    const stats = getStats(data, today);
    expect(stats.startDate).toBe('2026-10-08');
    expect(stats.initialWeight).toBe(85);
    expect(stats.change).toBe(-2);
    expect(stats.progress).toBe(20);
    expect(stats.maxWeight).toBe(85);
    expect(stats.totalDays).toBe(2);
    expect(stats.allRecords).toHaveLength(3);
  });

  it('supports weight gain, movement away from a goal, and goal overshoot', () => {
    const data = sample([record('2026-10-14', 65)], 60, 70);
    expect(getStats(data, today).progress).toBe(50);
    expect(getStats(data, today).remaining).toBe(5);
    data.records[0].weightKg = 58;
    expect(getStats(data, today).progress).toBe(0);
    expect(getStats(data, today).remaining).toBe(12);
    data.records[0].weightKg = 72;
    expect(getStats(data, today).progress).toBe(100);
    expect(getStats(data, today).remaining).toBe(0);
    const maintenance = sample([record('2026-10-14', 70)], 70, 70);
    expect(getStats(maintenance, today).progress).toBe(100);
    expect(getStats(maintenance, today).remaining).toBe(0);
    maintenance.records[0].weightKg = 72;
    expect(getStats(maintenance, today).remaining).toBe(2);
  });

  it('counts only recorded rest days and ignores future entries in metrics', () => {
    const stats = getStats(sample([
      record('2026-10-02', 89, false), record('2026-10-09', 85),
      record('2026-10-14', 83), record('2026-10-15', 70, false),
    ]), today);
    expect(stats.totalDays).toBe(3);
    expect(stats.exerciseDays).toBe(2);
    expect(stats.restDays).toBe(1);
    expect(stats.currentWeight).toBe(83);
    expect(stats.allRecords).toHaveLength(4);
  });

  it('computes weekly changes from rolling windows of recorded means', () => {
    const data = sample([
      record('2026-09-30', 100), // outside the previous window
      record('2026-10-02', 90), record('2026-10-07', 88),
      record('2026-10-08', 86), record('2026-10-14', 84),
    ]);
    data.profile!.initialDate = '2026-09-30';
    const stats = getStats(data, today);
    expect(stats.weekRecords.map((entry) => entry.date)).toEqual(['2026-10-08', '2026-10-14']);
    expect(stats.weeklyAverageWeight).toBe(85);
    expect(stats.weeklyChange).toBe(-4);
    expect(stats.weeklyLoss).toBe(4);
    expect(stats.weeks.map((week) => week.startDate)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(stats.weeklyExerciseAverage).toBeCloseTo(5 / 3);
  });

  it('does not invent a weekly trend when one window is missing', () => {
    const stats = getStats(sample([record('2026-10-14', 84)]), today);
    expect(stats.weeklyChange).toBeNull();
    expect(stats.weeklyLoss).toBeNull();
    expect(stats.weeklyAverageWeight).toBe(84);
  });

  it('ends a recording streak at the first gap and tolerates today still pending', () => {
    const data = sample([record('2026-10-10', 86), record('2026-10-12', 85), record('2026-10-13', 84)]);
    expect(getStats(data, today).streak).toBe(2);
    data.records.push(record('2026-10-14', 83));
    expect(getStats(data, today).streak).toBe(3);
    expect(getStats(data, new Date(2026, 9, 16, 12)).streak).toBe(0);
  });

  it('keeps empty state finite and supplies no fabricated history', () => {
    const stats = getStats(defaultData(), today);
    expect(stats.records).toEqual([]);
    expect(stats.currentBmi).toBeNull();
    expect(stats.minWeight).toBe(0);
    expect(stats.maxWeight).toBe(0);
    expect(stats.weeklyAverageWeight).toBeNull();
    expect(stats.weeklyExerciseAverage).toBe(0);
  });
});

describe('persisted schema validation', () => {
  it('round-trips valid JSON and discards unknown properties', () => {
    const data = demoData(today);
    expect(validateData(JSON.stringify(data))).toEqual(data);
    expect(validateData({ ...data, attacker: true })).not.toHaveProperty('attacker');
    expect(validateData(defaultData())).toEqual(defaultData());
  });

  it('rejects invalid root schemas, future versions, and malformed profile measurements', () => {
    for (const value of [null, [], '', 'bad JSON', { version: 2 }, { version: 1, records: 'bad' }]) {
      expect(validateData(value)).toBeNull();
    }
    const data = demoData(today);
    expect(validateData({ ...data, profile: { ...data.profile, age: 19.5 } })).toBeNull();
    expect(validateData({ ...data, profile: { ...data.profile, heightCm: Infinity } })).toBeNull();
    expect(validateData({ ...data, profile: { ...data.profile, initialDate: '2026-02-29' } })).toBeNull();
    expect(validateData({ ...data, profile: { ...data.profile, goalWeightKg: '75' } })).toBeNull();
  });

  it('omits malformed records instead of coercing incorrect boolean and numeric values', () => {
    const valid = record('2026-10-14', 81);
    const raw = {
      ...sample([]),
      records: [valid, { ...valid, date: '2026-02-30' }, { ...valid, exercise: 'false' },
        { ...valid, weightKg: NaN }, { ...valid, id: '' }, { ...valid, healthy: null }],
    };
    expect(validateData(raw)?.records).toEqual([valid]);
  });

  it('retains the last valid record for duplicate dates or duplicate IDs', () => {
    const first = record('2026-10-12', 85);
    const last = { ...first, id: 'new-id', weightKg: 84 };
    const duplicateId = { ...record('2026-10-13', 83), id: 'new-id' };
    const result = validateData(sample([first, last, duplicateId]));
    expect(result?.records).toEqual([first, duplicateId]);
    expect(validateData(sample([first, last]))?.records).toEqual([last]);
  });

  it('repairs optional settings, caps notes, and drops dangling initial IDs', () => {
    const result = validateData({
      ...sample([{ ...record('2026-10-14', 83), note: 'a'.repeat(3000) }]),
      initialRecordId: 'missing', lastPromptDate: '2026-13-01',
      settings: { theme: 'unknown', weightUnit: 'stones', heightUnit: 'ft', notifications: {
        enabled: true, time: '25:80', days: [0, 1, 1, 7, -1, '2', 4.5],
      } },
    });
    expect(result?.settings).toEqual({
      theme: 'dark', accentColor: null, language: 'es', weightUnit: 'kg', heightUnit: 'ft',
      notifications: { enabled: true, time: '20:00', days: [0, 1] },
      recap: { enabled: false, period: 'weekly', time: '19:00' },
      motivation: { message: 'Hazlo por él', image: null },
    });
    expect(result?.initialRecordId).toBeNull();
    expect(result?.lastPromptDate).toBeNull();
    expect(result?.records[0].note).toHaveLength(2000);
  });

  it('disables an impossible reminder with no scheduled weekdays', () => {
    const data = defaultData();
    data.settings.notifications = { enabled: true, time: '08:00', days: [] };
    expect(validateData(data)?.settings.notifications.enabled).toBe(false);
  });

  it('migrates optional appearance and celebration fields without altering records', () => {
    const original = sample([record('2026-10-14', 81)]);
    const legacy = { ...original, celebratedAchievementIds: undefined, settings: { ...original.settings, accentColor: undefined } };
    expect(validateData(legacy)?.settings.accentColor).toBeNull();
    expect(validateData(legacy)?.celebratedAchievementIds).toEqual([]);
    const result = validateData({ ...original, settings: { ...original.settings, accentColor: '#bb9bff' }, celebratedAchievementIds: ['records-iron', 'records-iron', 2, '<bad>'] });
    expect(result?.settings.accentColor).toBeNull();
    expect(result?.celebratedAchievementIds).toEqual(['records-iron']);
    expect(result?.records).toEqual(original.records);
    expect(validateData({ ...original, settings: { ...original.settings, accentColor: 'red' } })?.settings.accentColor).toBeNull();
  });

  it('returns independent defaults and explicit 30-day preview data', () => {
    const one = defaultData();
    one.settings.notifications.days.pop();
    expect(defaultData().settings.notifications.days).toHaveLength(7);
    const preview = demoData(today);
    expect(preview.records).toHaveLength(30);
    expect(preview.records[0].date).toBe('2026-09-15');
    expect(preview.records.at(-1)?.date).toBe('2026-10-14');
    expect(preview.initialRecordId).toBe(preview.records[0].id);
    expect(defaultData().records).toHaveLength(0);
  });
});
