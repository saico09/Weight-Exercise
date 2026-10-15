import { dateKey, shiftDate, type AppData, type DailyRecord } from './model';

export type AchievementTier = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementFamily = 'records' | 'streak' | 'exercise' | 'healthy' | 'balance' | 'weeks';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  family: AchievementFamily;
  tier: AchievementTier;
  current: number;
  target: number;
  earned: boolean;
}

export const ACHIEVEMENT_TIERS: readonly AchievementTier[] = ['iron', 'bronze', 'silver', 'gold', 'platinum'];
export const TIER_LABELS: Record<AchievementTier, string> = {
  iron: 'Hierro', bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino',
};
export const FAMILY_LABELS: Record<AchievementFamily, string> = {
  records: 'Tu historia', streak: 'Constancia', exercise: 'Movimiento',
  healthy: 'Alimentación', balance: 'En sintonía', weeks: 'A largo plazo',
};
export const FAMILY_DESCRIPTIONS: Record<AchievementFamily, string> = {
  records: 'Días registrados, a tu ritmo.',
  streak: 'Tu mejor racha de registros, aunque ya haya terminado.',
  exercise: 'Días de ejercicio acumulados. Descansar también cuenta en tu camino.',
  healthy: 'Días en los que elegiste comer sano.',
  balance: 'Días registrados con ejercicio y alimentación sana.',
  weeks: 'Semanas distintas con al menos un registro, de lunes a domingo.',
};

interface AchievementTrack {
  family: AchievementFamily;
  targets: readonly number[];
  names: readonly string[];
  description: string;
  firstDescription?: string;
}

const TRACKS: readonly AchievementTrack[] = [
  {
    family: 'records', targets: [1, 7, 30, 90, 365],
    names: ['El primer paso', 'Páginas que suman', 'Un hábito que crece', 'Tu propia historia', 'Un año para recordar'],
    description: '{target} días registrados en total.',
    firstDescription: 'Guarda tu primer registro.',
  },
  {
    family: 'streak', targets: [3, 7, 14, 30, 60],
    names: ['Encontrando tu ritmo', 'Una semana contigo', 'Constancia que inspira', 'Presente cada día', 'Un vínculo contigo'],
    description: 'Registra tu día durante {target} días seguidos, al menos una vez.',
  },
  {
    family: 'exercise', targets: [1, 10, 30, 75, 150],
    names: ['A moverse', 'En movimiento', 'Energía que suma', 'Tu fuerza crece', 'Movimiento que perdura'],
    description: '{target} días de ejercicio en total, sin necesidad de que sean seguidos.',
    firstDescription: 'Registra tu primer día de ejercicio.',
  },
  {
    family: 'healthy', targets: [1, 10, 30, 75, 150],
    names: ['Una buena elección', 'Nutriendo el hábito', 'Cuidarte se siente bien', 'Bienestar que suma', 'Cuidado que perdura'],
    description: '{target} días de comer sano en total.',
    firstDescription: 'Registra tu primer día de comer sano.',
  },
  {
    family: 'balance', targets: [1, 7, 21, 60, 120],
    names: ['Todo en sintonía', 'Dos hábitos, un camino', 'Tu ritmo, tu equilibrio', 'Cuidarte por completo', 'Armonía que perdura'],
    description: '{target} días con ejercicio y alimentación sana en el mismo registro.',
    firstDescription: 'Registra un día con ejercicio y alimentación sana.',
  },
  {
    family: 'weeks', targets: [1, 4, 12, 26, 52],
    names: ['Esta semana es tuya', 'Volver a ti', 'Una nueva estación', 'Medio año presente', 'Siempre a tu ritmo'],
    description: 'Al menos un registro en {target} semanas distintas. No necesitan ser consecutivas.',
    firstDescription: 'Guarda al menos un registro en una semana.',
  },
];

/** Milestones intentionally use lifetime history, independent of the chosen weight baseline. */
export function getAchievements(data: AppData, now = new Date()): Achievement[] {
  const today = dateKey(now);
  // Storage validates dates and uniqueness; deduplicate defensively for imported in-memory data.
  const byDate = new Map<string, DailyRecord>();
  for (const record of data.records) if (record.date <= today) byDate.set(record.date, record);
  const records = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  let longestStreak = 0;
  let streak = 0;
  let previous: string | null = null;
  const weeks = new Set<string>();
  for (const record of records) {
    streak = previous && shiftDate(previous, 1) === record.date ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    previous = record.date;
    const [year, month, day] = record.date.split('-').map(Number);
    const weekday = new Date(year, month - 1, day, 12).getDay();
    weeks.add(shiftDate(record.date, -((weekday + 6) % 7)));
  }
  const counts: Record<AchievementFamily, number> = {
    records: records.length,
    streak: longestStreak,
    exercise: records.filter(record => record.exercise).length,
    healthy: records.filter(record => record.healthy).length,
    balance: records.filter(record => record.exercise && record.healthy).length,
    weeks: weeks.size,
  };
  return TRACKS.flatMap(track => track.targets.map((target, index) => ({
    id: `${track.family}-${ACHIEVEMENT_TIERS[index]}`,
    name: track.names[index], description: target === 1 && track.firstDescription ? track.firstDescription : track.description,
    family: track.family, tier: ACHIEVEMENT_TIERS[index],
    current: counts[track.family], target, earned: counts[track.family] >= target,
  })));
}

/** Acknowledged IDs prevent repeated congratulations after edits, relaunches or re-earning. */
export function getNewlyEarnedAchievements(achievements: readonly Achievement[], celebratedIds: readonly string[]): Achievement[] {
  const celebrated = new Set(celebratedIds);
  return achievements.filter(achievement => achievement.earned && !celebrated.has(achievement.id));
}

export const CUP_LEVELS: readonly { tier: AchievementTier; target: number }[] = [
  { tier: 'iron', target: 1 }, { tier: 'bronze', target: 6 }, { tier: 'silver', target: 12 },
  { tier: 'gold', target: 20 }, { tier: 'platinum', target: 30 },
];

export function getCupProgress(achievements: readonly Achievement[]) {
  const total = achievements.length;
  const earned = achievements.filter(achievement => achievement.earned).length;
  const current = [...CUP_LEVELS].reverse().find(level => earned >= level.target) ?? null;
  const next = CUP_LEVELS.find(level => earned < level.target) ?? null;
  return {
    earned, total, current, next,
    percentage: total ? Math.round(earned / total * 100) : 0,
    remaining: next ? next.target - earned : 0,
  };
}
