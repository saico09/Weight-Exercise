import { Capacitor, registerPlugin } from '@capacitor/core';
import { dateKey, shiftDate, type AppData } from './model';

export interface StepsStatus { available: boolean; granted: boolean; onDeviceCounting: boolean }
export interface StepDay { date: string; steps: number }
const HealthSteps = registerPlugin<{
  status(): Promise<StepsStatus>;
  requestAccess(): Promise<StepsStatus>;
  openSettings(): Promise<void>;
  readDays(options: { dates: string[] }): Promise<{ days: StepDay[] }>;
}>('HealthSteps');
const unavailable: StepsStatus = { available: false, granted: false, onDeviceCounting: false };
export const nativeSteps = () => Capacitor.getPlatform() === 'android';
export async function stepsStatus(): Promise<StepsStatus> { return nativeSteps() ? HealthSteps.status() : unavailable; }
export async function requestStepsAccess(): Promise<StepsStatus> { return nativeSteps() ? HealthSteps.requestAccess() : unavailable; }
export async function openStepsSettings(): Promise<void> { if (nativeSteps()) await HealthSteps.openSettings(); }

/** Health Connect's default read window; no history permission is requested. */
export function stepDates(data: AppData, today = dateKey()): string[] {
  const first = shiftDate(today, -29);
  return [...new Set(data.records.filter(record => record.date >= first && record.date <= today).map(record => record.date))].sort();
}
export async function readSteps(dates: string[]): Promise<StepDay[]> {
  if (!nativeSteps() || !dates.length) return [];
  const status = await stepsStatus();
  if (!status.available || !status.granted) throw new Error('Conecta Health Connect para sincronizar tus pasos.');
  return (await HealthSteps.readDays({ dates })).days;
}

/** Update existing weight entries only. No entry is ever manufactured for a step-only day. */
export function mergeSteps(data: AppData, days: StepDay[], syncedAt = new Date().toISOString()): AppData {
  const valid = new Map(days.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isInteger(day.steps) && day.steps >= 0 && day.steps <= 200000).map(day => [day.date, day.steps]));
  let changed = false;
  const records = data.records.map(record => {
    const steps = valid.get(record.date);
    if (steps === undefined || record.steps === steps && record.stepsSource === 'health-connect') return record;
    changed = true;
    return { ...record, steps, stepsSource: 'health-connect' as const, stepsSyncedAt: syncedAt };
  });
  return changed ? { ...data, records } : data;
}
