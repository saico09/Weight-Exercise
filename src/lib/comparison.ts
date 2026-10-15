import { bmi, getStats, type AppData, type DailyRecord } from './model';

export interface ComparisonReference {
  id: string | null; date: string; weightKg: number; exercise?: boolean; healthy?: boolean; steps?: number;
}
export interface RecordComparison {
  record: DailyRecord; days: number; weightChangeKg: number; bmi: number; bmiChange: number;
  exerciseChange: number | null; healthyChange: number | null; stepsChange: number | null;
}
export function compareRecords(data: AppData, selectedIds: readonly string[]): { reference: ComparisonReference; rows: RecordComparison[]; usesInitial: boolean; summary: { from: ComparisonReference; to: DailyRecord; weightChangeKg: number } } | null {
  if (!data.profile) return null;
  const selected = new Set(selectedIds);
  const records = data.records.filter(record => selected.has(record.id)).sort((a, b) => a.date.localeCompare(b.date));
  if (!records.length) return null;
  const stats = getStats(data);
  const usesInitial = records.length === 1;
  const reference: ComparisonReference = usesInitial
    ? stats.initialRecord || { id: null, date: stats.startDate, weightKg: stats.initialWeight }
    : records[0];
  const initialBmi = bmi(reference.weightKg, data.profile.heightCm);
  const latest = records[records.length - 1];
  return { reference, usesInitial, summary: { from: reference, to: latest, weightChangeKg: latest.weightKg - reference.weightKg }, rows: records.map(record => ({
    record,
    days: Math.round((Date.parse(`${record.date}T12:00:00Z`) - Date.parse(`${reference.date}T12:00:00Z`)) / 86_400_000),
    weightChangeKg: record.weightKg - reference.weightKg,
    bmi: bmi(record.weightKg, data.profile!.heightCm),
    bmiChange: bmi(record.weightKg, data.profile!.heightCm) - initialBmi,
    exerciseChange: reference.exercise === undefined ? null : Number(record.exercise) - Number(reference.exercise),
    healthyChange: reference.healthy === undefined ? null : Number(record.healthy) - Number(reference.healthy),
    stepsChange: Number.isInteger(record.steps) && Number.isInteger(reference.steps) ? record.steps! - reference.steps! : null,
  })) };
}
