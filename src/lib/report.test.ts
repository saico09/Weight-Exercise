import { describe, expect, it } from 'vitest';
import { defaultData } from './model';
import { buildProgressReport, createProgressPdf, reportRange } from './report';

const today = '2026-10-15';
function fixture() {
  const data = defaultData();
  data.profile = { heightCm: 175, age: 30, goalWeightKg: 75, initialWeightKg: 80, initialDate: '2026-10-10' };
  data.records = [
    { id: 'b', date: '2026-10-15', weightKg: 82, exercise: false, healthy: true, note: '' },
    { id: 'a', date: '2026-10-01', weightKg: 80, exercise: true, healthy: true, note: '' },
    { id: 'c', date: '2026-10-10', weightKg: 81, exercise: false, healthy: false, note: '' },
  ];
  return data;
}

describe('Pro reports', () => {
  it('includes records before the selected goal baseline and counts only recorded days', () => {
    const report = buildProgressReport(fixture(), { start: '2026-10-01', end: today }, today);
    expect(report.records.map(record => record.id)).toEqual(['a', 'c', 'b']);
    expect(report.changeKg).toBe(2);
    expect(report.averageKg).toBe(81);
    expect(report.exerciseDays).toBe(1);
    expect(report.healthyPercent).toBeCloseTo(200 / 3);
  });
  it('uses inclusive calendar ranges and gives no inferred change from one entry', () => {
    const report = buildProgressReport(fixture(), { start: today, end: today }, today);
    expect(report.records).toHaveLength(1);
    expect(report.changeKg).toBeNull();
    expect(report.healthyPercent).toBe(100);
    expect(reportRange(fixture(), 30, today)).toEqual({ start: '2026-09-16', end: today });
  });
  it('rejects reversed, impossible, future or empty date ranges', () => {
    for (const range of [{ start: today, end: '2026-10-01' }, { start: '2026-02-30', end: today }, { start: today, end: '2026-10-16' }, { start: '', end: today }]) {
      expect(() => buildProgressReport(fixture(), range, today)).toThrow();
    }
  });
  it('has explicit empty-state metrics and never invents weights', () => {
    const report = buildProgressReport(fixture(), { start: '2026-09-01', end: '2026-09-30' }, today);
    expect(report.first).toBeNull(); expect(report.averageKg).toBeNull(); expect(report.changeKg).toBeNull(); expect(report.exercisePercent).toBe(0);
  });
  it('generates actual PDF pages with all entries and unit-aware values', async () => {
    const data = fixture(); data.settings.weightUnit = 'lb'; data.settings.language = 'en'; data.settings.theme = 'light'; data.settings.accentColor = '#EFC93E';
    const pdf = await createProgressPdf(data, { start: '2026-10-01', end: today });
    expect(pdf.getNumberOfPages()).toBe(2);
    expect(pdf.output().startsWith('%PDF-')).toBe(true);
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(3000);
  });
});
