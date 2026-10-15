import { describe, expect, it } from 'vitest';
import { defaultData, validateData, type AppData } from './model';
import { mergeSteps, stepDates } from './steps';
import { accentStyle, contrastRatio } from './accent';
import { themeInfo } from './themes';

const sample = (): AppData => ({ ...defaultData(), records: [
  { id: 'a', date: '2026-10-14', weightKg: 75, exercise: false, healthy: true, note: 'Original' },
  { id: 'b', date: '2026-10-15', weightKg: 74.9, exercise: true, healthy: false, note: '' },
] });

describe('Health Connect daily association', () => {
  it('updates existing dates, never creates a weight record', () => {
    const data = sample();
    const result = mergeSteps(data, [{ date: '2026-10-14', steps: 8200 }, { date: '2026-10-16', steps: 2500 }]);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({ ...data.records[0], steps: 8200, stepsSource: 'health-connect' });
    expect(result.records[1]).toBe(data.records[1]);
    expect(data.records[0].steps).toBeUndefined();
  });
  it('keeps a genuine zero distinct from absent data and rejects invalid counts', () => {
    const result = mergeSteps(sample(), [{ date: '2026-10-14', steps: 0 }, { date: '2026-10-15', steps: NaN }]);
    expect(result.records[0].steps).toBe(0);
    expect(result.records[1].steps).toBeUndefined();
    expect(mergeSteps(result, [{ date: '2026-10-15', steps: -2 }, { date: '2026-10-15', steps: 200001 }, { date: '2026-10-15', steps: 1.2 }])).toBe(result);
  });
  it('does not overwrite existing steps if Health Connect returns no data', () => {
    const data = mergeSteps(sample(), [{ date: '2026-10-14', steps: 123 }]);
    expect(mergeSteps(data, [])).toBe(data);
  });
  it('requests only existing entries in the last 30 calendar days', () => {
    const data = sample();
    data.records.push({ ...data.records[0], id: 'old', date: '2026-09-15' }, { ...data.records[0], id: 'edge', date: '2026-09-16' }, { ...data.records[0], id: 'future', date: '2026-10-16' });
    expect(stepDates(data, '2026-10-15')).toEqual(['2026-09-16', '2026-10-14', '2026-10-15']);
    expect(stepDates(defaultData(), '2026-10-15')).toEqual([]);
  });
  it('migrates old storage and round-trips new fields without losing measurements', () => {
    const data = mergeSteps(sample(), [{ date: '2026-10-14', steps: 4500 }]);
    data.settings.theme = 'aurora'; data.settings.chartStyle = 'bars'; data.settings.goalChartStyle = 'depth'; data.settings.steps.enabled = true;
    expect(validateData(data)).toEqual(data);
    const old = JSON.parse(JSON.stringify(sample())); delete old.settings.steps; delete old.settings.chartStyle;
    expect(validateData(old)?.settings.steps.enabled).toBe(false);
    expect(validateData(old)?.settings.chartStyle).toBe('area');
  });
});

describe('new themes', () => {
  it.each(['aurora', 'sand'] as const)('%s preserves a readable custom accent and distinct original palette', theme => {
    for (const accent of ['#000000', '#ffffff', '#777777', '#ffee00', '#ff00aa']) {
      const style = accentStyle(theme, accent);
      expect(contrastRatio(style['--accent-ink'], themeInfo[theme].background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(style['--accent-ink'], themeInfo[theme].surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(accentStyle(theme, null)['--accent'].toLowerCase()).toBe(themeInfo[theme].accent);
  });
});
