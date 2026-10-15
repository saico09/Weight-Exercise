import { describe, expect, it } from 'vitest';
import { defaultData, getStats, shiftDate, type AppData, type DailyRecord } from './model';
import { compactMetricPoints, metricGeometry, metricSeries } from './metricSeries';

const now = new Date(2026, 9, 15, 12);

function record(date: string, weightKg: number, exercise = true): DailyRecord {
  return { id: date, date, weightKg, exercise, healthy: false, note: '' };
}
function sample(records: DailyRecord[]): AppData {
  return { ...defaultData(), profile: { initialDate: '2026-10-01', initialWeightKg: 90, goalWeightKg: 75, heightCm: 180, age: 30 }, records };
}

describe('statistic mini charts', () => {
  it('matches selected baseline, current change and running extrema while excluding earlier/future entries', () => {
    const data = sample([record('2026-09-30', 200), record('2026-10-02', 89), record('2026-10-03', 92), record('2026-10-14', 88), record('2026-10-16', 150)]);
    data.initialRecordId = '2026-10-02';
    const stats = getStats(data, now);
    const charts = metricSeries(stats);
    expect(charts.current.points.map(point => point.value)).toEqual([89, 92, 88]);
    expect(charts.current.points.at(-1)?.value).toBe(stats.currentWeight);
    expect(charts.change.points.at(-1)?.value).toBe(stats.change);
    expect(charts.min.points.map(point => point.value)).toEqual([89, 89, 88]);
    expect(charts.max.points.map(point => point.value)).toEqual([89, 92, 92]);
    expect(charts.min.points.at(-1)?.value).toBe(stats.minWeight);
    expect(charts.max.points.at(-1)?.value).toBe(stats.maxWeight);
  });

  it('shows one honest starting point before recording', () => {
    const charts = metricSeries(getStats(sample([]), now));
    expect(charts.current.points).toEqual([{ date: '2026-10-01', value: 90 }]);
    expect(metricGeometry(charts.current)?.points[0].x).toBe(50);
    expect(Number.isFinite(metricGeometry(charts.current)!.points[0].y)).toBe(true);
    expect(metricGeometry({ ...charts.current, points: [] })).toBeNull();
  });

  it('keeps endpoints and local extrema when a long history is reduced for rendering', () => {
    const points = Array.from({ length: 10000 }, (_, index) => ({ date: shiftDate('2000-01-01', index), value: index === 231 ? 45 : index === 410 ? 120 : 80 + Math.sin(index) }));
    const compact = compactMetricPoints(points);
    expect(compact.length).toBeLessThanOrEqual(64);
    expect(compact[0]).toBe(points[0]);
    expect(compact.at(-1)).toBe(points.at(-1));
    expect(Math.min(...compact.map(point => point.value))).toBe(45);
    expect(Math.max(...compact.map(point => point.value))).toBe(120);
    expect(compact).toEqual([...compact].sort((a, b) => a.date.localeCompare(b.date)));
  });

  it('draws date gaps proportionally and keeps the scale separate from real extrema', () => {
    const geometry = metricGeometry({ points: [{ date: '2026-10-01', value: 3 }, { date: '2026-10-02', value: 5 }, { date: '2026-10-11', value: 4 }], kind: 'bars', description: '', valueKind: 'days' })!;
    expect(geometry.points.map(point => point.x)).toEqual([5, 14, 95]);
    expect(geometry.min).toBe(3);
    expect(geometry.max).toBe(5);
    expect(geometry.zeroY).toBe(46);
  });
});
