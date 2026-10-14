import { describe, expect, it } from 'vitest';
import { chartDay, clampChartWindow, sampleChartPoints, zoomChartWindow } from './chartUtils';

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
