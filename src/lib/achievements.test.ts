import { describe, expect, it } from 'vitest';
import { defaultData, shiftDate, type AppData, type DailyRecord } from './model';
import { getAchievements, getCupProgress, getNewlyEarnedAchievements } from './achievements';

const now = new Date(2026, 9, 14, 12);
const record = (date: string, exercise = false, healthy = false): DailyRecord => ({ id: date, date, weightKg: 80, exercise, healthy, note: '' });
const sample = (records: DailyRecord[]): AppData => ({ ...defaultData(), records });

describe('lifetime achievements', () => {
  it('offers 30 stable unique achievements and does not award a cup to an empty history', () => {
    const achievements = getAchievements(defaultData(), now);
    expect(achievements).toHaveLength(30);
    expect(new Set(achievements.map(item => item.id)).size).toBe(30);
    expect(achievements.every(item => !item.earned && item.current === 0)).toBe(true);
    expect(getCupProgress(achievements)).toMatchObject({ current: null, earned: 0, next: { tier: 'iron', target: 1 }, percentage: 0 });
  });

  it('keeps exercise, healthy and combined days independent, and ignores future dates', () => {
    const achievements = getAchievements(sample([
      record('2026-10-10', true), record('2026-10-11', false, true),
      record('2026-10-12', true, true), record('2026-10-14'), record('2026-10-15', true, true),
    ]), now);
    expect(achievements.find(item => item.id === 'records-iron')?.current).toBe(4);
    expect(achievements.find(item => item.id === 'exercise-iron')?.current).toBe(2);
    expect(achievements.find(item => item.id === 'healthy-iron')?.current).toBe(2);
    expect(achievements.find(item => item.id === 'balance-iron')?.current).toBe(1);
  });

  it('uses the best historical recording streak, not the current streak, and respects gaps', () => {
    const data = sample([record('2026-09-04'), record('2026-09-01'), record('2026-09-02'), record('2026-09-03'), record('2026-10-14')]);
    const achievements = getAchievements(data, now);
    expect(achievements.find(item => item.id === 'streak-iron')).toMatchObject({ current: 4, target: 3, earned: true });
    expect(achievements.find(item => item.id === 'streak-bronze')?.earned).toBe(false);
  });

  it('survives changing a baseline and units without counting the profile as a recorded day', () => {
    const data = sample([record('2026-10-01'), record('2026-10-14')]);
    const original = getAchievements(data, now);
    data.initialRecordId = '2026-10-14';
    data.profile = { age: 28, heightCm: 170, initialWeightKg: 80, goalWeightKg: 70, initialDate: '2026-10-14' };
    data.settings.weightUnit = 'lb';
    expect(getAchievements(data, now)).toEqual(original);
    expect(getAchievements({ ...data, records: [] }, now).every(item => item.current === 0)).toBe(true);
  });

  it('counts distinct calendar weeks, with Sunday and Monday in different weeks', () => {
    const achievements = getAchievements(sample([
      record('2026-09-01'), record('2026-09-06'), record('2026-09-07'), record('2026-10-14'),
    ]), now);
    expect(achievements.find(item => item.id === 'weeks-iron')?.current).toBe(3);
  });

  it('deduplicates dates before counting days or breaking a streak', () => {
    const achievements = getAchievements(sample([record('2026-10-12'), record('2026-10-12'), record('2026-10-13'), record('2026-10-14')]), now);
    expect(achievements.find(item => item.id === 'records-iron')?.current).toBe(3);
    expect(achievements.find(item => item.id === 'streak-iron')?.current).toBe(3);
  });

  it('unlocks a threshold exactly on its target and batches only unacknowledged achievements', () => {
    const data = sample(Array.from({ length: 7 }, (_, index) => record(shiftDate('2026-10-08', index), true, true)));
    const before = getAchievements({ ...data, records: data.records.slice(0, -1) }, now);
    const after = getAchievements(data, now);
    const newAchievements = getNewlyEarnedAchievements(after, before.filter(item => item.earned).map(item => item.id));
    expect(newAchievements.map(item => item.id)).toEqual(['records-bronze', 'streak-bronze', 'balance-bronze']);
    expect(getNewlyEarnedAchievements(after, after.map(item => item.id))).toEqual([]);
  });

  it('does not celebrate a milestone again after deleting and re-adding a record', () => {
    const earned = getAchievements(sample([record('2026-10-14')]), now);
    const seen = earned.filter(item => item.earned).map(item => item.id);
    expect(getNewlyEarnedAchievements(getAchievements(defaultData(), now), seen)).toEqual([]);
    expect(getNewlyEarnedAchievements(earned, seen)).toEqual([]);
  });

  it('awards platinum only when all 30 milestones are earned', () => {
    const data = sample(Array.from({ length: 365 }, (_, index) => record(shiftDate('2025-10-15', index), true, true)));
    const achievements = getAchievements(data, now);
    expect(getCupProgress(achievements)).toMatchObject({ earned: 30, percentage: 100, current: { tier: 'platinum' }, next: null, remaining: 0 });
  });

  it('advances the global cup exactly at 1, 6, 12, 20 and 30 achievements', () => {
    const base = getAchievements(defaultData(), now);
    const progress = (earned: number) => getCupProgress(base.map((achievement, index) => ({ ...achievement, earned: index < earned })));
    expect(progress(1).current?.tier).toBe('iron');
    expect(progress(5)).toMatchObject({ current: { tier: 'iron' }, next: { tier: 'bronze' }, remaining: 1 });
    expect(progress(6).current?.tier).toBe('bronze');
    expect(progress(11).current?.tier).toBe('bronze');
    expect(progress(12).current?.tier).toBe('silver');
    expect(progress(19).current?.tier).toBe('silver');
    expect(progress(20).current?.tier).toBe('gold');
    expect(progress(29).current?.tier).toBe('gold');
    expect(progress(30)).toMatchObject({ current: { tier: 'platinum' }, next: null });
  });
});
