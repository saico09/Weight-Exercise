import type { Stats } from './model';

export interface MetricPoint { date: string; value: number }
export interface MetricSeries {
  points: MetricPoint[];
  description: string;
  kind?: 'line' | 'bars';
  reference?: number;
  valueKind: 'weight' | 'days';
}

/** Uses exactly the baseline and recorded-day windows already selected by getStats. */
export function metricSeries(stats: Stats): Record<'current' | 'change' | 'min' | 'max', MetricSeries> {
  const baseline = { date: stats.startDate, value: stats.initialWeight };
  const weights = [baseline, ...stats.records.map(record => ({ date: record.date, value: record.weightKg }))];
  // A baseline identical to the first record is one observation, not two.
  if (weights.length > 1 && weights[1].date === baseline.date && weights[1].value === baseline.value) weights.shift();
  let minimum = stats.initialWeight;
  let maximum = stats.initialWeight;
  const min = weights.map(point => ({ ...point, value: minimum = Math.min(minimum, point.value) }));
  const max = weights.map(point => ({ ...point, value: maximum = Math.max(maximum, point.value) }));
  return {
    current: { points: weights, description: 'Pesos desde tu inicio elegido', valueKind: 'weight' },
    change: { points: weights.map(point => ({ ...point, value: point.value - stats.initialWeight })), reference: 0, description: 'Diferencia de peso respecto a tu inicio', valueKind: 'weight' },
    min: { points: min, description: 'Tu mínimo acumulado en cada fecha', valueKind: 'weight' },
    max: { points: max, description: 'Tu máximo acumulado en cada fecha', valueKind: 'weight' },
  };
}

/** Preserve endpoints and local extremes while keeping a long history inexpensive to draw. */
export function compactMetricPoints(points: MetricPoint[], maxPoints = 64): MetricPoint[] {
  if (points.length <= maxPoints) return points;
  const result = [points[0]];
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const bucketSize = (points.length - 2) / bucketCount;
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor(bucket * bucketSize);
    const end = 1 + Math.floor((bucket + 1) * bucketSize);
    let min = start;
    let max = start;
    for (let index = start + 1; index < end; index += 1) {
      if (points[index].value < points[min].value) min = index;
      if (points[index].value > points[max].value) max = index;
    }
    for (const index of [...new Set([min, max])].sort((a, b) => a - b)) result.push(points[index]);
  }
  result.push(points[points.length - 1]);
  return result;
}

export function metricGeometry(series: MetricSeries) {
  const points = compactMetricPoints(series.points.filter(point => Number.isFinite(point.value)));
  if (!points.length) return null;
  const values = points.map(point => point.value);
  if (series.reference !== undefined) values.push(series.reference);
  const min = series.kind === 'bars' ? Math.min(0, ...values) : Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * .12, series.valueKind === 'days' ? .5 : .1);
  const lower = series.kind === 'bars' ? min : min - padding;
  const upper = max + padding;
  const y = (value: number) => 46 - (value - lower) / (upper - lower) * 40;
  const firstTime = Date.parse(`${points[0].date}T12:00:00Z`);
  const duration = Date.parse(`${points.at(-1)!.date}T12:00:00Z`) - firstTime;
  const plotted = points.map(point => ({
    ...point,
    x: duration === 0 ? 50 : 5 + (Date.parse(`${point.date}T12:00:00Z`) - firstTime) / duration * 90,
    y: y(point.value),
  }));
  return { points: plotted, min: Math.min(...points.map(point => point.value)), max: Math.max(...points.map(point => point.value)), zeroY: y(0), referenceY: series.reference === undefined ? undefined : y(series.reference) };
}
