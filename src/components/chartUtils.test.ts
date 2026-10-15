import { describe, expect, it } from 'vitest';
import { chartDay, chartPeriod, clampChartWindow, sampleChartPoints, weightChartDomain, zoomChartWindow } from './chartUtils';
import { demoData, fromKg, shiftDate } from '../lib/model';

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
    expect(chartPeriod(base.records, 0, today).records).toEqual(base.records);
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

describe('readable weight goals', () => {
  it('keeps a distant goal outside the scale instead of flattening the recorded trend', () => {
    const nearby = weightChartDomain([79.8, 80.2], 80);
    const distant = weightChartDomain([79.8, 80.2], 60);
    expect(nearby.showGoal).toBe(true);
    expect(distant.showGoal).toBe(false);
    expect({ min: nearby.min, max: nearby.max }).toEqual({ min: distant.min, max: distant.max });
  });
  it('preserves the goal position and visibility when changing measurement units', () => {
    const kg = weightChartDomain([76], 76.4);
    const lb = weightChartDomain([fromKg(76, 'lb')], fromKg(76.4, 'lb'), fromKg(1, 'lb'));
    expect(lb.showGoal).toBe(kg.showGoal);
    expect((lb.max - fromKg(76.4, 'lb')) / (lb.max - lb.min)).toBeCloseTo((kg.max - 76.4) / (kg.max - kg.min));
  });
  it('supports a single point and never adds a goal marker to an empty history', () => {
    expect(weightChartDomain([], 0).showGoal).toBe(false);
    expect(weightChartDomain([76], 76)).toEqual({ min: 75.5, max: 76.5, showGoal: true });
  });
});
