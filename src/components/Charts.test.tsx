import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DailyRecord } from '../lib/model';
import { I18nProvider } from '../lib/i18n';
import { chartDay } from './chartUtils';
import { WeightChart } from './Charts';

const records: DailyRecord[] = [80, 79, 78].map((weightKg, index) => ({ id: String(index), date: `2026-10-${12 + index}`, weightKg, exercise: false, healthy: false, note: '' }));
const periodBounds = { start: chartDay('2026-10-12'), end: chartDay('2026-10-14') };

describe('fixed weight-goal legend', () => {
  it('keeps the goal marker outside data and at the actual goal height', () => {
    const html = renderToStaticMarkup(<WeightChart records={records} unit="kg" goal={79} periodBounds={periodBounds} />);
    expect(html).toContain('aria-label="Meta: 79,0 kg"');
    expect(html).not.toContain('>META<');
    const marker = html.match(/class="chart-goal-marker"[^>]*transform="translate\(([^ ]+) ([^)]+)\)"/)!;
    const goalLine = html.match(/class="chart-goal-line"[^>]*x2="([^"]+)"[^>]*y1="([^"]+)"/)!;
    expect(marker).not.toBeNull(); expect(goalLine).not.toBeNull();
    expect(Number(marker[1]) - Number(goalLine[1])).toBeGreaterThan(14);
    expect(Number(marker[2])).toBeCloseTo(Number(goalLine[2]));
  });

  it('keeps a far-away goal visible without drawing a fake edge marker', () => {
    const html = renderToStaticMarkup(<WeightChart records={records} unit="kg" goal={60} periodBounds={periodBounds} />);
    expect(html).toContain('aria-label="Meta: 60,0 kg"');
    expect(html).not.toContain('chart-goal-marker');
  });

  it('shows the goal for empty histories and converts its value and label into pounds', () => {
    const html = renderToStaticMarkup(<I18nProvider language="en"><WeightChart records={[]} unit="lb" goal={76} periodBounds={periodBounds} /></I18nProvider>);
    expect(html).toContain('aria-label="Goal: 167.6 lb"');
    expect(html).not.toContain('chart-goal-marker');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('accepts a visual style action without implementing premium chart styles', () => {
    const html = renderToStaticMarkup(<WeightChart records={[]} unit="kg" goal={76} periodBounds={periodBounds} styleAction={<button type="button">PRO</button>} />);
    expect(html).toMatch(/class="chart-range-line"[^]*?<button type="button">PRO<\/button><\/div>/);
  });
});
