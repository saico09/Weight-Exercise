import { CUP_LEVELS, getAchievements, getCupProgress } from './achievements';
import type { AppData, Theme } from './model';

export const REWARD_THEMES = ['gold', 'platinum'] as const;
export type RewardTheme = typeof REWARD_THEMES[number];
export function isRewardTheme(theme: string): theme is RewardTheme {
  return REWARD_THEMES.some(reward => reward === theme);
}

/** Only known achievement IDs preserve an earned reward after the history is edited. */
export function getLifetimeAchievements(data: AppData, now = new Date()) {
  const acknowledged = new Set(data.celebratedAchievementIds);
  return getAchievements(data, now).map(achievement => ({ ...achievement, earned: achievement.earned || acknowledged.has(achievement.id) }));
}

export function getLifetimeCupProgress(data: AppData, now = new Date()) {
  return getCupProgress(getLifetimeAchievements(data, now));
}

export function getRewardThemes(data: AppData, now = new Date()) {
  const cup = getLifetimeCupProgress(data, now);
  return REWARD_THEMES.map(theme => {
    const target = CUP_LEVELS.find(level => level.tier === theme)!.target;
    return { theme, target, earned: cup.earned, remaining: Math.max(0, target - cup.earned), progress: Math.min(1, cup.earned / target), unlocked: cup.earned >= target };
  });
}

export function canUseTheme(theme: Theme, data: AppData, now = new Date()): boolean {
  return !isRewardTheme(theme) || isRewardThemeUnlocked(data, theme, now);
}

export function isRewardThemeUnlocked(data: AppData, theme: RewardTheme, now = new Date()): boolean {
  return getRewardThemes(data, now).some(reward => reward.theme === theme && reward.unlocked);
}

export function unlockedRewardThemes(data: AppData, now = new Date()): RewardTheme[] {
  return getRewardThemes(data, now).filter(reward => reward.unlocked).map(reward => reward.theme);
}
