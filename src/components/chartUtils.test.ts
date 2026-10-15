import { describe, expect, it } from 'vitest';
import { chartDay, chartPeriod, clampChartWindow, nextChartStyle, sampleChartPoints, signedChartValue, weightChartDomain, zoomChartWindow } from './chartUtils';
import { demoData, shiftDate } from '../lib/model';

describe('calendar chart periods', () => {
  const today = '2026-10-14';
  const base = demoData(new Date(`${today}T12:00:00`));
  const records = [91, 89, 30, 29, 6, 0, -1].map(days => ({ ...base.records[0], id: String(days), date: shiftDate(today, -days) }));
  it('uses inclusive 7/30/90-day windows and never includes future records', () => {
    expect(chartPeriod(records, 7, today).records.map(r => r.id)).toEqual(['6', '0']);
    expect(chartPeriod(records, 30, today).records.map(r => r.id)).toEqual(['29', '6', '0']);
    expect(chartPeriod(records, 90, today).records.map(r => r.id)).toEqual(['89', '30', '29', '6', '0']);
    expect(chartPeriod(records, 0, today).records.map(r => r.id)).toEqual(['91', '89', '30', '29', '6', '0']);
  });
  it('keeps explicit ranges when the same sparse records appear in every period', () => {
    const one = records.filter(r => r.date === today);
    expect(chartPeriod(one, 30, today).bounds).toEqual({ start: chartDay('2026-09-15'), end: chartDay(today) });
    expect(chartPeriod(one, 90, today).bounds.start).toBe(chartDay('2026-07-17'));
    expect(chartPeriod([], 30, today).records).toEqual([]);
    expect(chartPeriod(one, 0, today).bounds.end - chartPeriod(one, 0, today).bounds.start).toBeGreaterThan(0);
  });
  it('lets all show the full history independently of a newer chosen initial record', () => {
    base.initialRecordId = base.records.at(-1)!.id;
    expect(chartPeriod(base.records, 0, today).records).toHaveLength(30);
  });
});

describe('interactive chart window', () => {
  const bounds = { start: 0, end: 365 };
  it('keeps the visible span when panning against either edge', () => {
    expect(clampChartWindow({ start: -5, end: 25 }, bounds)).toEqual({ start: 0, end: 30 });
    expect(clampChartWindow({ start: 355, end: 385 }, bounds)).toEqual({ start: 335, end: 365 });
  });
  it('zooms around the touch or mouse anchor', () => {
    expect(zoomChartWindow({ start: 20, end: 120 }, bounds, .5, .2)).toEqual({ start: 30, end: 80 });
  });
  it('limits close zoom and returns to the complete range', () => {
    expect(zoomChartWindow({ start: 20, end: 23 }, bounds, .01)).toEqual({ start: 20, end: 23 });
    expect(zoomChartWindow({ start: 20, end: 120 }, bounds, 20)).toEqual(bounds);
    expect(zoomChartWindow({ start: 0, end: 1 }, { start: 0, end: 1 }, .1)).toEqual({ start: 0, end: 1 });
  });
  it('uses equal calendar-day spacing across daylight-saving boundaries', () => {
    expect(chartDay('2026-09-07') - chartDay('2026-09-06')).toBe(1);
    expect(chartDay('2026-09-06') - chartDay('2026-09-05')).toBe(1);
  });
});

describe('dense chart downsampling', () => {
  it('retains endpoints, an isolated peak and trough, and chronological order', () => {
    const records = Array.from({ length: 10000 }, (_, x) => ({ x, value: x === 4901 ? 140 : x === 4902 ? 40 : 80 }));
    const sampled = sampleChartPoints(records, 180);
    expect(sampled.length).toBeLessThanOrEqual(362);
    expect(sampled[0]).toBe(records[0]);
    expect(sampled[sampled.length - 1]).toBe(records[9999]);
    expect(sampled).toContain(records[4901]);
    expect(sampled).toContain(records[4902]);
    expect(sampled.every((point, index) => !index || sampled[index - 1].x < point.x)).toBe(true);
  });
  it('keeps sparse series and one point intact', () => {
    const records = [{ x: 5, value: 81 }];
    expect(sampleChartPoints(records, 180)).toBe(records);
    expect(sampleChartPoints([], 180)).toEqual([]);
  });
});

describe('truthful chart styles', () => {
  it('never suggests a positive or negative difference when the displayed tick rounds to zero', () => {
    expect(signedChartValue(-.03, 'en-US')).toBe('0');
    expect(signedChartValue(.03, 'en-US')).toBe('0');
    expect(signedChartValue(-.15, 'es-CL')).toBe('−0,2');
    expect(signedChartValue(.14, 'en-US')).toBe('+0.1');
  });
  it('shows small differences as signed changes around an explicit zero-change reference', () => {
    const domain = weightChartDomain([79.8, 80, 80.2], 60, 'bars', 80);
    expect(domain.min).toBeLessThan(79.8);
    expect(domain.max).toBeGreaterThan(80.2);
    expect(domain.max - domain.min).toBeLessThan(1);
    expect(domain.min - 80).toBeLessThan(0);
    expect(domain.max - 80).toBeGreaterThan(0);
  });
  it('retains the same reference baseline when zooming into later lower or higher weights', () => {
    for (const values of [[78, 78.5], [82, 82.5]]) {
      const domain = weightChartDomain(values, 60, 'bars', 80);
      expect(domain.min).toBeLessThanOrEqual(Math.min(...values, 80));
      expect(domain.max).toBeGreaterThanOrEqual(Math.max(...values, 80));
    }
    const flat = weightChartDomain([80, 80], 60, 'bars', 80);
    expect(flat.min).toBeLessThan(80);
    expect(flat.max).toBeGreaterThan(80);
  });
  it('retains a readable bounded line view and cycles through all styles', () => {
    expect(weightChartDomain([79.8, 80.2], 60, 'line').min).toBeGreaterThan(70);
    expect(weightChartDomain([79.8, 80.2], 60, 'line').showGoal).toBe(false);
    expect(['area', 'line', 'bars'].map(style => nextChartStyle(style as 'area'))).toEqual(['line', 'bars', 'area']);
  });
});
