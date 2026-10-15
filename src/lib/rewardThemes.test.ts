import { describe, expect, it } from 'vitest';
import { getAchievements } from './achievements';
import { defaultData, shiftDate } from './model';
import { canUseTheme, getLifetimeCupProgress, getRewardThemes } from './rewardThemes';

const now = new Date(2026, 9, 15, 12);
const ids = getAchievements(defaultData(), now).map(achievement => achievement.id);

describe('earned themes', () => {
  it('keeps both themes locked until their exact cup threshold', () => {
    const data = defaultData();
    for (const [earned, gold, platinum] of [[0, false, false], [19, false, false], [20, true, false], [29, true, false], [30, true, true]] as const) {
      data.celebratedAchievementIds = ids.slice(0, earned);
      expect(getRewardThemes(data, now).map(theme => theme.unlocked)).toEqual([gold, platinum]);
      expect(canUseTheme('gold', data, now)).toBe(gold);
      expect(canUseTheme('platinum', data, now)).toBe(platinum);
    }
  });

  it('never counts duplicate or unknown acknowledgment IDs', () => {
    const data = defaultData();
    data.celebratedAchievementIds = [...ids.slice(0, 19), ...ids.slice(0, 19), 'gold', 'records-unknown', 'fake'];
    expect(getLifetimeCupProgress(data, now).earned).toBe(19);
    expect(canUseTheme('gold', data, now)).toBe(false);
    expect(getRewardThemes(data, now)[0]).toMatchObject({ remaining: 1, target: 20, progress: .95 });
  });

  it('unions currently earned milestones with acknowledged ones without double counting', () => {
    const data = defaultData();
    data.records = [{ id: 'today', date: '2026-10-15', weightKg: 80, exercise: true, healthy: true, note: '' }];
    data.celebratedAchievementIds = ids.slice(0, 19);
    const expected = new Set([...data.celebratedAchievementIds, ...getAchievements(data, now).filter(achievement => achievement.earned).map(achievement => achievement.id)]);
    expect(getLifetimeCupProgress(data, now).earned).toBe(expected.size);
  });

  it('unlocks from real lifetime records before the celebration has been acknowledged', () => {
    const data = defaultData();
    data.records = Array.from({ length: 365 }, (_, index) => ({ id: String(index), date: shiftDate('2025-10-16', index), weightKg: 80, exercise: true, healthy: true, note: '' }));
    expect(getRewardThemes(data, now).every(theme => theme.unlocked && theme.remaining === 0 && theme.progress === 1)).toBe(true);
    data.celebratedAchievementIds = getAchievements(data, now).filter(achievement => achievement.earned).map(achievement => achievement.id);
    data.records = [];
    expect(canUseTheme('platinum', data, now)).toBe(true);
  });

  it('does not award themes for future records and never restricts ordinary themes', () => {
    const data = defaultData();
    data.records = Array.from({ length: 365 }, (_, index) => ({ id: String(index), date: shiftDate('2026-10-16', index), weightKg: 80, exercise: true, healthy: true, note: '' }));
    expect(getLifetimeCupProgress(data, now).earned).toBe(0);
    expect(canUseTheme('dark', data, now)).toBe(true);
    expect(canUseTheme('light', data, now)).toBe(true);
  });
});
