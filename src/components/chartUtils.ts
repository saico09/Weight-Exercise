import { shiftDate, type DailyRecord } from '../lib/model';

export type ChartWindow = { start: number; end: number };
export type WeightChartStyle = 'area' | 'line' | 'bars' | 'depth';
export const WEIGHT_CHART_STYLES: readonly WeightChartStyle[] = ['area', 'line', 'bars', 'depth'];
export function nextChartStyle(style: WeightChartStyle): WeightChartStyle { return WEIGHT_CHART_STYLES[(WEIGHT_CHART_STYLES.indexOf(style) + 1) % WEIGHT_CHART_STYLES.length]; }
/** Columns always start at zero; line views retain a readable local range. */
export function weightChartDomain(values: number[], goal: number, style: WeightChartStyle) {
  const finite = values.filter(Number.isFinite);
  const low = finite.length ? Math.min(...finite) : 0, high = finite.length ? Math.max(...finite) : 1;
  const spread = high - low;
  const showGoal = Number.isFinite(goal) && Math.abs(goal - (finite.at(-1) ?? 0)) < Math.max(spread * 1.7, 3);
  if (style === 'bars' || style === 'depth') return { min: 0, max: Math.max(high, showGoal ? goal : 0, 1) * 1.12, showGoal };
  return { min: Math.min(low, showGoal ? goal : Infinity) - Math.max(.5, spread * .2), max: Math.max(high, showGoal ? goal : -Infinity) + Math.max(.5, spread * .2), showGoal };
}

/** Dates are calendar ordinals so daylight-saving changes never distort spacing. */
export const chartDay = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86_400_000;

/** Explicit calendar bounds keep sparse 1M/3M views distinct. All includes history before a reselected baseline. */
export function chartPeriod(records: DailyRecord[], days: number, today: string) {
  const history = records.filter(record => record.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const startDate = days > 0 ? shiftDate(today, -(days - 1)) : history[0]?.date || today;
  const start = chartDay(startDate), end = chartDay(today);
  return {
    records: history.filter(record => record.date >= startDate),
    bounds: { start: start === end ? start - 1 : start, end },
  };
}

export function clampChartWindow(window: ChartWindow, bounds: ChartWindow, minimumSpan = 3): ChartWindow {
  const total = Math.max(0, bounds.end - bounds.start);
  const span = Math.min(total, Math.max(Math.min(minimumSpan, total), window.end - window.start));
  const start = Math.max(bounds.start, Math.min(bounds.end - span, window.start));
  return { start, end: start + span };
}

export function zoomChartWindow(window: ChartWindow, bounds: ChartWindow, factor: number, anchor = .5): ChartWindow {
  const total = bounds.end - bounds.start;
  const span = Math.min(total, Math.max(Math.min(3, total), (window.end - window.start) * factor));
  const start = window.start + (window.end - window.start - span) * Math.max(0, Math.min(1, anchor));
  return clampChartWindow({ start, end: start + span }, bounds);
}

/** Preserve both extrema in each pixel bucket instead of hiding a short-lived peak. */
export function sampleChartPoints<T extends { x: number; value: number }>(points: T[], pixelBuckets: number): T[] {
  if (points.length <= pixelBuckets * 2 || pixelBuckets < 1) return points;
  const first = points[0].x, span = points[points.length - 1].x - first || 1;
  const buckets = new Map<number, { min: number; max: number }>();
  points.forEach((point, index) => {
    const bucket = Math.min(pixelBuckets - 1, Math.floor((point.x - first) / span * pixelBuckets));
    const current = buckets.get(bucket);
    if (!current) buckets.set(bucket, { min: index, max: index });
    else {
      if (point.value < points[current.min].value) current.min = index;
      if (point.value > points[current.max].value) current.max = index;
    }
  });
  const indices = new Set([0, points.length - 1]);
  buckets.forEach(({ min, max }) => { indices.add(min); indices.add(max); });
  return Array.from(indices).sort((a, b) => a - b).map(index => points[index]);
}
