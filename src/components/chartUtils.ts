import { shiftDate, type DailyRecord } from '../lib/model';

export type ChartWindow = { start: number; end: number };
export type WeightChartStyle = 'area' | 'line' | 'bars';
export const WEIGHT_CHART_STYLES: readonly WeightChartStyle[] = ['area', 'line', 'bars'];
export function nextChartStyle(style: WeightChartStyle): WeightChartStyle { return WEIGHT_CHART_STYLES[(WEIGHT_CHART_STYLES.indexOf(style) + 1) % WEIGHT_CHART_STYLES.length]; }
export function signedChartValue(value: number, locale: string): string {
  const rounded = Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toLocaleString(locale, { maximumFractionDigits: 1 })}`;
}
/** Columns measure signed change from an explicit reference, never cropped absolute weight. */
export function weightChartDomain(values: number[], goal: number, style: WeightChartStyle, reference?: number, unitScale = 1) {
  const finite = values.filter(Number.isFinite);
  const low = finite.length ? Math.min(...finite) : 0, high = finite.length ? Math.max(...finite) : 1;
  const spread = high - low;
  const scale = Number.isFinite(unitScale) && unitScale > 0 ? unitScale : 1;
  if (style === 'bars') {
    const baseline = Number.isFinite(reference) ? reference! : finite[0] ?? 0;
    const bottom = Math.min(low, baseline), top = Math.max(high, baseline);
    const padding = Math.max(.1 * scale, (top - bottom) * .16);
    const min = bottom - padding, max = top + padding;
    return { min, max, showGoal: finite.length > 0 && Number.isFinite(goal) && goal >= min && goal <= max };
  }
  // A distant goal stays in the fixed legend; it must never flatten recorded changes.
  const padding = Math.max(.5 * scale, spread * .2);
  const min = low - padding, max = high + padding;
  return { min, max, showGoal: finite.length > 0 && Number.isFinite(goal) && goal >= min && goal <= max };
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
