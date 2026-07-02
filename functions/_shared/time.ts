import { Temporal } from '@js-temporal/polyfill';

import { APP_TIMEZONE } from './constants';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function padTwoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}

export function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDate.from(value, {
        overflow: 'reject',
      }).toString() === value
    );
  } catch {
    return false;
  }
}

export function isValidUtcTimestamp(value: string): boolean {
  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  try {
    return (
      Temporal.Instant.from(value).toString({
        smallestUnit: 'millisecond',
      }) === value
    );
  } catch {
    return false;
  }
}

export function localDateTimeToUtc(date: string, time: string): string {
  if (!isValidLocalDate(date) || !LOCAL_TIME_PATTERN.test(time)) {
    throw new RangeError('Invalid Warsaw local date or time.');
  }

  const localDateTime = Temporal.PlainDateTime.from(`${date}T${time}`, {
    overflow: 'reject',
  });
  const zonedDateTime = localDateTime.toZonedDateTime(APP_TIMEZONE, {
    disambiguation: 'reject',
  });

  return zonedDateTime.toInstant().toString({
    smallestUnit: 'millisecond',
  });
}

export function formatUtcInWarsaw(utcTimestamp: string): {
  localDate: string;
  localTime: string;
} {
  if (!isValidUtcTimestamp(utcTimestamp)) {
    throw new RangeError('Invalid UTC timestamp.');
  }

  const local = Temporal.Instant.from(utcTimestamp).toZonedDateTimeISO(APP_TIMEZONE);

  return {
    localDate: `${padTwoDigits(local.day)}.${padTwoDigits(local.month)}.${local.year}`,
    localTime: `${padTwoDigits(local.hour)}:${padTwoDigits(local.minute)}`,
  };
}

export function getWarsawLocalIsoDate(utcTimestamp: string): string {
  if (!isValidUtcTimestamp(utcTimestamp)) {
    throw new RangeError('Invalid UTC timestamp.');
  }

  return Temporal.Instant.from(utcTimestamp)
    .toZonedDateTimeISO(APP_TIMEZONE)
    .toPlainDate()
    .toString();
}

export function getWarsawIsoWeekday(utcTimestamp: string): number {
  if (!isValidUtcTimestamp(utcTimestamp)) {
    throw new RangeError('Invalid UTC timestamp.');
  }

  return Temporal.Instant.from(utcTimestamp).toZonedDateTimeISO(APP_TIMEZONE).dayOfWeek;
}

export function addMinutesToUtc(utcTimestamp: string, minutes: number): string {
  if (!isValidUtcTimestamp(utcTimestamp)) {
    throw new RangeError('Invalid UTC timestamp.');
  }

  if (!Number.isSafeInteger(minutes)) {
    throw new RangeError('Minutes must be a safe integer.');
  }

  return Temporal.Instant.from(utcTimestamp)
    .add({ minutes })
    .toString({ smallestUnit: 'millisecond' });
}
