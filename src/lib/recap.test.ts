import { describe, it, expect } from 'vitest';
import { defaultData, demoData } from './model';
import { nextRecapDate, progressRecap } from './recap';

describe('progress summaries', () => {
  it('requires two actual records within the window', () => {
    expect(progressRecap(defaultData())).toBeNull();
    const data = demoData(new Date(2026, 9, 15));
    data.records = [data.records[0], data.records.at(-1)!];
    expect(progressRecap(data)).toBeNull();
  });
  it('describes both gains and losses honestly using chosen units and dated records', () => {
    const data = demoData(new Date(2026, 9, 15));
    expect(progressRecap(data)).toContain('Bajaste');
    data.settings.language = 'en';
    data.settings.weightUnit = 'lb';
    data.records.at(-1)!.weightKg = 95;
    expect(progressRecap(data)).toContain('Up');
    expect(progressRecap(data)).toContain('lb');
    expect(progressRecap(data)).toContain('Oct 15');
    expect(progressRecap(data)).toContain('2026');
  });
  it('schedules future local Sundays and month boundaries without rolling short months', () => {
    const weekly = nextRecapDate('weekly', '19:00', new Date(2026, 9, 18, 20));
    expect(weekly.getDate()).toBe(25);
    expect(weekly.getDay()).toBe(0);
    expect(weekly.getHours()).toBe(19);
    const monthly = nextRecapDate('monthly', '19:00', new Date(2026, 0, 31, 20));
    expect(monthly.getMonth()).toBe(1);
    expect(monthly.getDate()).toBe(1);
  });
});
