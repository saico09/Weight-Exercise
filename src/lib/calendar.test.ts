import { describe, expect, it } from 'vitest';
import { addCalendarDays, calendarMonthCells, calendarMonthRange, daysInCalendarMonth, matchesHistoryDate, moveCalendarDate, selectCalendarRange, shiftCalendarMonth } from './calendar';

describe('history calendar dates', () => {
  it('lays out Monday-first months including leap days without duplicated adjacent dates', () => {
    const cells = calendarMonthCells('2024-02');
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 4)).toEqual([null, null, null, '2024-02-01']);
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(cells).toContain('2024-02-29');
    expect(daysInCalendarMonth('2025-02')).toBe(28);
    expect(calendarMonthCells('2026-06')[0]).toBe('2026-06-01');
  });

  it('only includes weeks containing days, retaining all days in six-week months', () => {
    expect(calendarMonthCells('2021-02')).toHaveLength(28);
    expect(calendarMonthCells('2026-10')).toHaveLength(35);
    const august = calendarMonthCells('2026-08');
    expect(august).toHaveLength(42);
    expect(august.filter(Boolean)).toHaveLength(31);
    expect(august).toContain('2026-08-31');
  });

  it('navigates month and year boundaries and clamps shorter months', () => {
    expect(shiftCalendarMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftCalendarMonth('2026-01', -1)).toBe('2025-12');
    expect(moveCalendarDate('2024-01-31', 1)).toBe('2024-02-29');
    expect(moveCalendarDate('2024-02-29', 12)).toBe('2025-02-28');
    expect(addCalendarDays('2026-09-05', 1)).toBe('2026-09-06');
  });

  it('selects whole months and excludes future days in the current month', () => {
    expect(calendarMonthRange('2024-02', '2026-10-14')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(calendarMonthRange('2026-10', '2026-10-14')).toEqual({ start: '2026-10-01', end: '2026-10-14' });
  });

  it('sorts reversed range endpoints, allows one day, then starts another range', () => {
    const first = selectCalendarRange({ start: '', end: '' }, '2026-01-03');
    expect(first).toEqual({ start: '2026-01-03', end: '' });
    const backwards = selectCalendarRange(first, '2025-12-29');
    expect(backwards).toEqual({ start: '2025-12-29', end: '2026-01-03' });
    expect(selectCalendarRange(backwards, '2024-02-29')).toEqual({ start: '2024-02-29', end: '' });
    expect(selectCalendarRange(first, '2026-01-03')).toEqual({ start: '2026-01-03', end: '2026-01-03' });
  });

  it('includes both range endpoints, including across years, independently of habits', () => {
    const filter = { start: '2025-12-29', end: '2026-01-03', mode: 'range' as const };
    expect(matchesHistoryDate('2025-12-28', filter)).toBe(false);
    expect(matchesHistoryDate('2025-12-29', filter)).toBe(true);
    expect(matchesHistoryDate('2026-01-03', filter)).toBe(true);
    expect(matchesHistoryDate('2026-01-04', filter)).toBe(false);
    expect(matchesHistoryDate('2020-01-01', null)).toBe(true);
  });
});
