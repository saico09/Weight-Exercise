import { dateKey, displayWeight, shiftDate, type AppData } from './model';

/** A dated snapshot avoids describing old measurements as today's weight. */
export function progressRecap(data: AppData): string | null {
  const records = [...data.records].sort((a, b) => a.date.localeCompare(b.date));
  const last = records.at(-1);
  if (!last) return null;
  const cutoff = shiftDate(last.date, data.settings.recap.period === 'weekly' ? -7 : -30);
  const first = records.find(record => record.date >= cutoff);
  if (!first || first.id === last.id) return null;
  const english = data.settings.language === 'en';
  const locale = english ? 'en-US' : 'es-CL';
  const date = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const weight = (kg: number) => `${displayWeight(kg, data.settings.weightUnit, 1, locale)} ${data.settings.weightUnit}`;
  const difference = last.weightKg - first.weightKg;
  const change = Math.abs(difference) < .05 ? (english ? 'No change' : 'Sin cambio') : `${english ? (difference < 0 ? 'Down' : 'Up') : (difference < 0 ? 'Bajaste' : 'Subiste')} ${weight(Math.abs(difference))}`;
  const period = records.filter(record => record.date >= first.date && record.date <= last.date);
  return `${date(first.date)}: ${weight(first.weightKg)} → ${date(last.date)}: ${weight(last.weightKg)}. ${change}. ${period.filter(r => r.exercise).length} ${english ? 'active days' : 'días de ejercicio'} · ${period.filter(r => r.healthy).length} ${english ? 'healthy eating days' : 'días de comer sano'}.`;
}

export function nextRecapDate(period: 'weekly' | 'monthly', time: string, now = new Date()): Date {
  const [hour, minute] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (period === 'monthly') {
    next.setDate(1);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + (7 - next.getDay()) % 7);
    if (next <= now) next.setDate(next.getDate() + 7);
  }
  // Retain local calendar time across DST, never add fixed milliseconds.
  return new Date(`${dateKey(next)}T${time}:00`);
}
