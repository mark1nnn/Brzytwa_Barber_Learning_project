import { describe, expect, it } from 'vitest';

import {
  addMinutesToUtc,
  formatUtcInWarsaw,
  getWarsawIsoWeekday,
  isValidLocalDate,
  isValidUtcTimestamp,
  localDateTimeToUtc,
} from '../../functions/_shared/time';

describe('Warsaw time helpers', () => {
  it('validates real local calendar dates', () => {
    expect(isValidLocalDate('2026-02-28')).toBe(true);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
  });

  it('requires an exact UTC timestamp with milliseconds and Z', () => {
    expect(isValidUtcTimestamp('2026-07-15T08:00:00.000Z')).toBe(true);
    expect(isValidUtcTimestamp('2026-07-15T10:00:00')).toBe(false);
    expect(isValidUtcTimestamp('2026-07-15 08:00')).toBe(false);
  });

  it('converts Warsaw local time to UTC in winter and summer', () => {
    expect(localDateTimeToUtc('2026-01-15', '10:00')).toBe('2026-01-15T09:00:00.000Z');
    expect(localDateTimeToUtc('2026-07-15', '10:00')).toBe('2026-07-15T08:00:00.000Z');
  });

  it('rejects the spring DST gap', () => {
    expect(() => localDateTimeToUtc('2026-03-29', '02:30')).toThrow(RangeError);
  });

  it('rejects the autumn DST overlap instead of choosing an offset', () => {
    expect(() => localDateTimeToUtc('2026-10-25', '02:30')).toThrow(RangeError);
  });

  it('formats UTC in Warsaw independently of the process timezone', () => {
    expect(formatUtcInWarsaw('2026-01-15T09:00:00.000Z')).toEqual({
      localDate: '15.01.2026',
      localTime: '10:00',
    });
    expect(formatUtcInWarsaw('2026-07-15T08:00:00.000Z')).toEqual({
      localDate: '15.07.2026',
      localTime: '10:00',
    });
  });

  it('returns ISO weekdays in the application timezone', () => {
    expect(getWarsawIsoWeekday('2026-07-13T08:00:00.000Z')).toBe(1);
    expect(getWarsawIsoWeekday('2026-07-19T08:00:00.000Z')).toBe(7);
  });

  it.each([15, 30, 45, 75])('adds %i exact UTC minutes', (minutes) => {
    expect(addMinutesToUtc('2026-07-15T08:00:00.000Z', minutes)).toBe(
      `2026-07-15T${String(8 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00.000Z`,
    );
  });
});
