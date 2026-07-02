import { describe, expect, it } from 'vitest';

import {
  generateAvailabilitySlots,
  getBookingDateStatus,
  type AvailabilityEngineInput,
} from '../../functions/_shared/availability';

const BASE_INPUT: AvailabilityEngineInput = {
  date: '2026-07-15',
  durationMinutes: 30,
  workingHours: {
    startTime: '10:00',
    endTime: '11:00',
  },
  blockedPeriods: [],
  occupiedSlotStarts: [],
  nowUtc: '2026-07-01T10:00:00.000Z',
};

function generate(overrides: Partial<AvailabilityEngineInput> = {}) {
  return generateAvailabilitySlots({
    ...BASE_INPUT,
    ...overrides,
  });
}

describe('availability engine service durations and closing time', () => {
  it.each([
    {
      durationMinutes: 30,
      endTime: '11:00',
      expectedLocalTimes: ['10:00', '10:15', '10:30'],
    },
    {
      durationMinutes: 45,
      endTime: '11:00',
      expectedLocalTimes: ['10:00', '10:15'],
    },
    {
      durationMinutes: 75,
      endTime: '12:00',
      expectedLocalTimes: ['10:00', '10:15', '10:30', '10:45'],
    },
  ])(
    'generates 15-minute starts for a $durationMinutes-minute service',
    ({ durationMinutes, endTime, expectedLocalTimes }) => {
      const slots = generate({
        durationMinutes,
        workingHours: {
          startTime: '10:00',
          endTime,
        },
      });

      expect(slots.map((slot) => slot.localTime)).toEqual(expectedLocalTimes);
    },
  );

  it('includes the last slot ending exactly at closing and excludes starts ending later', () => {
    const slots = generate();

    expect(slots.at(-1)?.localTime).toBe('10:30');
    expect(slots.some((slot) => slot.localTime === '10:45')).toBe(false);
  });

  it('returns no slots on a closed day', () => {
    expect(generate({ workingHours: null })).toEqual([]);
  });
});

describe('availability engine occupied 15-minute segments', () => {
  it('excludes an appointment when its first segment is occupied', () => {
    const slots = generate({
      durationMinutes: 45,
      occupiedSlotStarts: ['2026-07-15T08:00:00.000Z'],
    });

    expect(slots.map((slot) => slot.localTime)).toEqual(['10:15']);
  });

  it('excludes an appointment when a middle segment is occupied', () => {
    const slots = generate({
      durationMinutes: 45,
      occupiedSlotStarts: ['2026-07-15T08:15:00.000Z'],
    });

    expect(slots).toEqual([]);
  });
});

describe('availability engine blocked periods', () => {
  it('excludes a slot when a blocked period overlaps the beginning of the service', () => {
    const slots = generate({
      durationMinutes: 45,
      blockedPeriods: [
        {
          startsAt: '2026-07-15T08:00:00.000Z',
          endsAt: '2026-07-15T08:15:00.000Z',
        },
      ],
    });

    expect(slots.map((slot) => slot.localTime)).toEqual(['10:15']);
  });

  it('excludes a slot when a blocked period overlaps the middle of the service', () => {
    const slots = generate({
      durationMinutes: 45,
      blockedPeriods: [
        {
          startsAt: '2026-07-15T08:15:00.000Z',
          endsAt: '2026-07-15T08:30:00.000Z',
        },
      ],
    });

    expect(slots).toEqual([]);
  });

  it('does not treat a blocked period ending at appointment start as an overlap', () => {
    const slots = generate({
      blockedPeriods: [
        {
          startsAt: '2026-07-15T07:30:00.000Z',
          endsAt: '2026-07-15T08:00:00.000Z',
        },
      ],
    });

    expect(slots[0]?.localTime).toBe('10:00');
  });
});

describe('availability engine booking window', () => {
  it('filters slots that start before the 120-minute lead time', () => {
    const slots = generate({
      workingHours: {
        startTime: '09:00',
        endTime: '13:00',
      },
      nowUtc: '2026-07-15T07:30:00.000Z',
    });

    expect(slots[0]?.startsAt).toBe('2026-07-15T09:30:00.000Z');
    expect(slots[0]?.localTime).toBe('11:30');
  });

  it('accepts the last day of the 45-day booking horizon', () => {
    expect(getBookingDateStatus('2026-08-15', '2026-07-01T10:00:00.000Z')).toBe('available');
  });

  it('rejects the day after the booking horizon', () => {
    expect(getBookingDateStatus('2026-08-16', '2026-07-01T10:00:00.000Z')).toBe('too-far');
  });

  it('marks a past Warsaw calendar date as invalid', () => {
    expect(getBookingDateStatus('2026-06-30', '2026-07-01T10:00:00.000Z')).toBe('past');
  });
});

describe('availability engine Warsaw timezone', () => {
  it('uses UTC+2 for a summer local time', () => {
    const slots = generate();

    expect(slots[0]).toEqual({
      startsAt: '2026-07-15T08:00:00.000Z',
      localTime: '10:00',
    });
  });

  it('uses UTC+1 for a winter local time', () => {
    const slots = generate({
      date: '2027-01-15',
      nowUtc: '2027-01-01T10:00:00.000Z',
    });

    expect(slots[0]).toEqual({
      startsAt: '2027-01-15T09:00:00.000Z',
      localTime: '10:00',
    });
  });
});
