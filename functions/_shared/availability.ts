import { Temporal } from '@js-temporal/polyfill';

import {
  APP_TIMEZONE,
  MAX_BOOKING_DAYS_AHEAD,
  MIN_BOOKING_LEAD_MINUTES,
  SLOT_DURATION_MINUTES,
} from './constants';
import { addMinutesToUtc, formatUtcInWarsaw, localDateTimeToUtc } from './time';
import type { AvailabilitySlot } from './types';

export interface AvailabilityWorkingHours {
  startTime: string;
  endTime: string;
}

export interface AvailabilityBlockedPeriod {
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityEngineInput {
  date: string;
  durationMinutes: number;
  workingHours: AvailabilityWorkingHours | null;
  blockedPeriods: readonly AvailabilityBlockedPeriod[];
  occupiedSlotStarts: readonly string[];
  nowUtc: string;
}

export type BookingDateStatus = 'available' | 'past' | 'too-far';
export type AvailabilityStartStatus =
  | 'available'
  | 'invalid-date'
  | 'too-early'
  | 'too-far'
  | 'outside-working-hours'
  | 'blocked-period'
  | 'slot-taken';

export interface AvailabilityStartCheckInput extends AvailabilityEngineInput {
  startsAt: string;
}

function compareUtc(left: string, right: string): number {
  return Temporal.Instant.compare(Temporal.Instant.from(left), Temporal.Instant.from(right));
}

function overlapsBlockedPeriod(
  appointmentStart: string,
  appointmentEnd: string,
  blockedPeriod: AvailabilityBlockedPeriod,
): boolean {
  return (
    compareUtc(blockedPeriod.startsAt, appointmentEnd) < 0 &&
    compareUtc(blockedPeriod.endsAt, appointmentStart) > 0
  );
}

function includesOccupiedSegment(
  appointmentStart: string,
  appointmentEnd: string,
  occupiedSlotStarts: ReadonlySet<string>,
): boolean {
  let segmentStart = appointmentStart;

  while (compareUtc(segmentStart, appointmentEnd) < 0) {
    if (occupiedSlotStarts.has(segmentStart)) {
      return true;
    }

    segmentStart = addMinutesToUtc(segmentStart, SLOT_DURATION_MINUTES);
  }

  return false;
}

function isAlignedWithWorkingDay(startsAt: string, workingDayStart: string): boolean {
  let candidate = workingDayStart;

  while (compareUtc(candidate, startsAt) < 0) {
    candidate = addMinutesToUtc(candidate, SLOT_DURATION_MINUTES);
  }

  return candidate === startsAt;
}

export function getBookingDateStatus(date: string, nowUtc: string): BookingDateStatus {
  const requestedDate = Temporal.PlainDate.from(date);
  const currentWarsawDate = Temporal.Instant.from(nowUtc)
    .toZonedDateTimeISO(APP_TIMEZONE)
    .toPlainDate();
  const daysAhead = currentWarsawDate.until(requestedDate).days;

  if (daysAhead < 0) {
    return 'past';
  }

  if (daysAhead > MAX_BOOKING_DAYS_AHEAD) {
    return 'too-far';
  }

  return 'available';
}

export function checkAvailabilityStart(
  input: AvailabilityStartCheckInput,
): AvailabilityStartStatus {
  const bookingDateStatus = getBookingDateStatus(input.date, input.nowUtc);

  if (bookingDateStatus === 'past' || compareUtc(input.startsAt, input.nowUtc) < 0) {
    return 'invalid-date';
  }

  if (bookingDateStatus === 'too-far') {
    return 'too-far';
  }

  const earliestAllowedStart = addMinutesToUtc(input.nowUtc, MIN_BOOKING_LEAD_MINUTES);

  if (compareUtc(input.startsAt, earliestAllowedStart) < 0) {
    return 'too-early';
  }

  if (input.workingHours === null) {
    return 'outside-working-hours';
  }

  const workingDayStart = localDateTimeToUtc(input.date, input.workingHours.startTime);
  const workingDayEnd = localDateTimeToUtc(input.date, input.workingHours.endTime);
  const appointmentEnd = addMinutesToUtc(input.startsAt, input.durationMinutes);

  if (
    compareUtc(input.startsAt, workingDayStart) < 0 ||
    compareUtc(input.startsAt, workingDayEnd) >= 0 ||
    compareUtc(appointmentEnd, workingDayEnd) > 0 ||
    !isAlignedWithWorkingDay(input.startsAt, workingDayStart)
  ) {
    return 'outside-working-hours';
  }

  if (
    input.blockedPeriods.some((blockedPeriod) =>
      overlapsBlockedPeriod(input.startsAt, appointmentEnd, blockedPeriod),
    )
  ) {
    return 'blocked-period';
  }

  if (includesOccupiedSegment(input.startsAt, appointmentEnd, new Set(input.occupiedSlotStarts))) {
    return 'slot-taken';
  }

  return 'available';
}

export function generateAvailabilitySlots(input: AvailabilityEngineInput): AvailabilitySlot[] {
  if (
    !Number.isSafeInteger(input.durationMinutes) ||
    input.durationMinutes <= 0 ||
    input.durationMinutes % SLOT_DURATION_MINUTES !== 0
  ) {
    throw new RangeError('Service duration must be a positive multiple of the slot duration.');
  }

  if (input.workingHours === null) {
    return [];
  }

  const workingDayStart = localDateTimeToUtc(input.date, input.workingHours.startTime);
  const workingDayEnd = localDateTimeToUtc(input.date, input.workingHours.endTime);
  const slots: AvailabilitySlot[] = [];
  let candidateStart = workingDayStart;

  while (compareUtc(candidateStart, workingDayEnd) < 0) {
    if (
      checkAvailabilityStart({
        ...input,
        startsAt: candidateStart,
      }) === 'available'
    ) {
      slots.push({
        startsAt: candidateStart,
        localTime: formatUtcInWarsaw(candidateStart).localTime,
      });
    }

    candidateStart = addMinutesToUtc(candidateStart, SLOT_DURATION_MINUTES);
  }

  return slots;
}
