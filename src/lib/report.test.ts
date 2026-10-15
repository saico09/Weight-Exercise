import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultData, shiftDate } from './model';
import { buildProgressReport, buildReportOverview, createProgressPdf, previousReportRange, reportDayCount, reportRange, reportFontFiles } from './report';

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
    expect(pdf.getNumberOfPages()).toBe(3);
    expect(pdf.output().startsWith('%PDF-')).toBe(true);
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(3000);
  });
  it('opens with all history even when selected details cover a single date', () => {
    const report = buildReportOverview(fixture(), { start: today, end: today }, today);
    expect(report.global.records).toHaveLength(3);
    expect(report.global.changeKg).toBe(2);
    expect(report.selected.records).toHaveLength(1);
    expect(report.previous.range).toEqual({ start: '2026-10-14', end: '2026-10-14' });
    expect(report.averageChangeKg).toBeNull();
    expect(report.exerciseChangePoints).toBeNull();
  });
  it('compares equal calendar windows across month boundaries and leap years', () => {
    const range = { start: '2024-03-01', end: '2024-03-31' };
    const previous = previousReportRange(range);
    expect(previous).toEqual({ start: '2024-01-30', end: '2024-02-29' });
    expect(reportDayCount(previous)).toBe(31);
    expect(reportDayCount(range)).toBe(31);
  });
  it('reports signed mean changes, percentage point differences and coverage', () => {
    const data = fixture();
    data.records.push({ id: 'old', date: '2026-10-05', weightKg: 85, exercise: true, healthy: false, note: '' });
    const report = buildReportOverview(data, { start: '2026-10-10', end: today }, today);
    expect(report.previous.records).toHaveLength(1);
    expect(report.selected.records).toHaveLength(2);
    expect(report.averageChangeKg).toBe(-3.5);
    expect(report.exerciseChangePoints).toBe(-100);
    expect(report.healthyChangePoints).toBe(50);
    expect(report.selected.coveragePercent).toBeCloseTo(100 / 3);
  });
  it('distinguishes missing step counts from real zeros and averages only known days', () => {
    const data = fixture(); data.records[0].steps = 0; data.records[1].steps = 6000;
    const report = buildReportOverview(data, { start: '2026-10-01', end: today }, today);
    expect(report.global.stepsDays).toBe(2);
    expect(report.global.totalSteps).toBe(6000);
    expect(report.global.averageSteps).toBe(3000);
    expect(report.previous.averageSteps).toBeNull();
    expect(report.averageStepsChange).toBeNull();
  });
  it('keeps the overview when selected dates have no entries', async () => {
    const data = fixture();
    const report = buildReportOverview(data, { start: '2026-09-01', end: '2026-09-30' }, today);
    expect(report.global.records).toHaveLength(3);
    expect(report.selected.records).toHaveLength(0);
    expect(report.averageChangeKg).toBeNull();
    const pdf = await createProgressPdf(data, report.selected.range);
    expect(pdf.getNumberOfPages()).toBe(3);
  });
  it('selects existing bundled typography for all six themes', () => {
    expect(reportFontFiles('dark').heading).toContain('barlow-condensed');
    expect(reportFontFiles('light').body).toContain('manrope');
    expect(reportFontFiles('aurora').body).toContain('space-grotesk');
    expect(reportFontFiles('sand').heading).toContain('fraunces');
    for (const theme of ['dark','light','aurora','sand','gold','platinum'] as const) {
      for (const path of Object.values(reportFontFiles(theme))) expect(existsSync('public' + path), path).toBe(true);
    }
  });
  it('does not create an invented report when no history exists', async () => {
    await expect(createProgressPdf(defaultData(), { start: today, end: today })).rejects.toThrow('No hay registros');
  });
  it('fits a full 31-day month on one detail page and continues longer histories', async () => {
    const data = fixture();
    data.records = Array.from({ length: 32 }, (_, index) => ({ id: String(index), date: shiftDate(today, index - 31), weightKg: 80, exercise: true, healthy: false, note: '' }));
    expect((await createProgressPdf(data, { start: shiftDate(today, -30), end: today })).getNumberOfPages()).toBe(3);
    expect((await createProgressPdf(data, { start: shiftDate(today, -31), end: today })).getNumberOfPages()).toBe(4);
  });
});
