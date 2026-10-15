/** Calendar dates stay as ISO date-only strings; UTC arithmetic avoids DST jumps. */
export interface HistoryDateFilter { start: string; end: string; mode: 'range' | 'month' }
export interface CalendarSelection { start: string; end: string }

function utcDate(value: string) { return new Date(`${value}T12:00:00Z`); }
function dateString(value: Date) { return value.toISOString().slice(0, 10); }

export function addCalendarDays(value: string, days: number) {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateString(date);
}

export function shiftCalendarMonth(month: string, count: number) {
  const date = utcDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + count);
  return dateString(date).slice(0, 7);
}

export function daysInCalendarMonth(month: string) {
  return Number(addCalendarDays(`${shiftCalendarMonth(month, 1)}-01`, -1).slice(-2));
}

export function moveCalendarDate(value: string, months: number) {
  const month = shiftCalendarMonth(value.slice(0, 7), months);
  return `${month}-${String(Math.min(Number(value.slice(-2)), daysInCalendarMonth(month))).padStart(2, '0')}`;
}

export function calendarMonthCells(month: string): (string | null)[] {
  const offset = (utcDate(`${month}-01`).getUTCDay() + 6) % 7;
  const days = daysInCalendarMonth(month);
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > days ? null : `${month}-${String(day).padStart(2, '0')}`;
  });
}

export function calendarMonthRange(month: string, today: string): CalendarSelection {
  return { start: `${month}-01`, end: [`${month}-${daysInCalendarMonth(month)}`, today].sort()[0] };
}

/** A third click begins a new range. A backwards second click keeps both endpoints. */
export function selectCalendarRange(selection: CalendarSelection, date: string): CalendarSelection {
  if (!selection.start || selection.end) return { start: date, end: '' };
  const [start, end] = [selection.start, date].sort();
  return { start, end };
}

export function matchesHistoryDate(date: string, filter: HistoryDateFilter | null) {
  return !filter || date >= filter.start && date <= filter.end;
}
