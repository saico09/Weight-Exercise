import { describe, expect, it } from 'vitest';
import { defaultData, validateData } from './model';

describe('chart preference migration', () => {
  it('moves existing perspective weights to a 3D goal without dropping any records', () => {
    const data = defaultData();
    const old = { ...data, settings: { ...data.settings, chartStyle: 'depth', goalChartStyle: undefined } };
    const migrated = validateData(old)!;
    expect(migrated.settings.chartStyle).toBe('area');
    expect(migrated.settings.goalChartStyle).toBe('depth');
    expect(migrated.records).toEqual(data.records);
  });
  it('preserves an explicit 2D goal and repairs invalid chart options', () => {
    const data = defaultData();
    expect(validateData({ ...data, settings: { ...data.settings, chartStyle: 'depth', goalChartStyle: 'ring' } })?.settings.goalChartStyle).toBe('ring');
    const repaired = validateData({ ...data, settings: { ...data.settings, chartStyle: 'invalid', goalChartStyle: 'invalid' } })!;
    expect(repaired.settings.chartStyle).toBe('area');
    expect(repaired.settings.goalChartStyle).toBe('ring');
  });
});
