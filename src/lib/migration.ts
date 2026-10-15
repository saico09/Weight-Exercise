import { getAchievements } from './achievements';
import { dateKey, validateData, type AppData } from './model';
import { canUseTheme } from './rewardThemes';

export const MAX_BASIC_TRANSFER_BYTES = 4 * 1024 * 1024;
export const BASIC_TRANSFER_FORMAT = 'weight-exercise.basic-transfer';

/** A narrow snapshot for Pro. This edition contains no importer, account code or Pro implementation. */
export function buildBasicTransfer(data: AppData): string {
  if (!data.profile) throw new Error('Primero completa tu perfil en Basic.');
  const valid = validateData(data);
  const byId = new Map(valid?.records.map(record => [record.id, record]));
  // Never hide discarded/changed records behind an apparently successful export.
  if (!valid || valid.records.length !== data.records.length || valid.initialRecordId !== data.initialRecordId
    || valid.profile?.photo !== data.profile.photo || valid.profile?.birthDate !== data.profile.birthDate
    || valid.profile!.initialDate > dateKey() || data.records.some(record => {
    const checked = byId.get(record.id);
    return !checked || checked.date !== record.date || record.date > dateKey() || checked.weightKg !== record.weightKg || checked.exercise !== record.exercise
      || checked.healthy !== record.healthy || checked.note !== record.note;
  })) throw new Error('No pudimos preparar tus datos. Revisa los registros de Basic.');
  const known = new Set(getAchievements(valid).map(achievement => achievement.id));
  const profile = valid.profile!;
  const settings = valid.settings;
  const snapshot = {
    profile: {
      heightCm: profile.heightCm, initialWeightKg: profile.initialWeightKg, goalWeightKg: profile.goalWeightKg,
      age: profile.age, initialDate: profile.initialDate,
      ...(profile.birthDate ? { birthDate: profile.birthDate } : {}),
      ...(profile.photo ? { photo: profile.photo } : {}),
    },
    records: valid.records.map(record => ({ id: record.id, date: record.date, weightKg: record.weightKg, exercise: record.exercise, healthy: record.healthy, note: record.note })),
    settings: {
      theme: canUseTheme(settings.theme, valid) ? settings.theme : 'dark',
      language: settings.language, weightUnit: settings.weightUnit, heightUnit: settings.heightUnit,
      notifications: { enabled: false, time: settings.notifications.time, days: [...settings.notifications.days] },
      motivation: { message: settings.motivation.message, image: settings.motivation.image },
    },
    initialRecordId: valid.initialRecordId,
    celebratedAchievementIds: valid.celebratedAchievementIds.filter(id => known.has(id)),
  };
  const text = JSON.stringify({ format: BASIC_TRANSFER_FORMAT, version: 1, createdAt: new Date().toISOString(), snapshot });
  if (new TextEncoder().encode(text).byteLength > MAX_BASIC_TRANSFER_BYTES) throw new Error('La transferencia supera el límite de 4 MB.');
  return text;
}
