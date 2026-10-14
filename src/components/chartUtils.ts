export type ChartWindow = { start: number; end: number };

/** Dates are calendar ordinals so daylight-saving changes never distort spacing. */
export const chartDay = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86_400_000;

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
