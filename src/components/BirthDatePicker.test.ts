import { describe, expect, it } from 'vitest';
import { ageFromBirthDate, shiftDate } from '../lib/model';
import { birthDateBounds, defaultBirthDate } from './BirthDatePicker';

describe('birth date choices', () => {
  it('includes every valid birthday for ages five through 120', () => {
    const today = '2026-10-14';
    const { min, max } = birthDateBounds(today);
    expect(min).toBe('1905-10-15');
    expect(max).toBe('2021-10-14');
    expect(ageFromBirthDate(min, today)).toBe(120);
    expect(ageFromBirthDate(max, today)).toBe(5);
    expect(ageFromBirthDate(shiftDate(min, -1), today)).toBe(121);
    expect(ageFromBirthDate(shiftDate(max, 1), today)).toBe(4);
  });

  it.each(['2024-02-29', '2025-02-28', '2025-03-01', '2026-01-01', '2026-12-31'])(
    'keeps the exact age limits across leap days and year boundaries on %s',
    today => {
      const { min, max } = birthDateBounds(today);
      expect(ageFromBirthDate(min, today)).toBe(120);
      expect(ageFromBirthDate(max, today)).toBe(5);
      expect(ageFromBirthDate(shiftDate(min, -1), today)).toBe(121);
      expect(ageFromBirthDate(shiftDate(max, 1), today)).toBe(4);
    },
  );

  it('starts with a real date even when today is a leap day', () => {
    const value = defaultBirthDate('2024-02-29');
    expect(value).toBe('1999-02-28');
    expect(ageFromBirthDate(value, '2024-02-29')).toBe(25);
    expect(defaultBirthDate('2026-10-14')).toBe('2001-10-14');
  });
});
