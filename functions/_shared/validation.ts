import { z } from "zod";

import {
  MAX_CUSTOMER_EMAIL_LENGTH,
  MAX_CUSTOMER_NAME_LENGTH,
  MAX_CUSTOMER_NOTES_LENGTH,
  MAX_CUSTOMER_PHONE_LENGTH,
} from "./constants";
import {
  isValidLocalDate,
  isValidUtcTimestamp,
} from "./time";
import type { ApiFieldErrors } from "./types";

const CUSTOMER_NAME_MESSAGE = "Podaj prawidłowe imię i nazwisko.";
const CUSTOMER_PHONE_MESSAGE = "Podaj prawidłowy polski numer telefonu.";
const CUSTOMER_EMAIL_MESSAGE = "Podaj prawidłowy adres e-mail.";
const LOCAL_DATE_MESSAGE = "Podaj prawidłową datę.";
const UTC_TIMESTAMP_MESSAGE = "Podaj prawidłowy znacznik czasu UTC.";

const CUSTOMER_NAME_PATTERN =
  /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;

export const positiveIntegerIdSchema = z
  .union([
    z.number(),
    z.string().regex(/^[1-9]\d*$/),
  ])
  .transform((value) =>
    typeof value === "number" ? value : Number(value),
  )
  .refine(
    (value) => Number.isSafeInteger(value) && value > 0,
    "Identyfikator musi być dodatnią liczbą całkowitą.",
  );

export const localDateSchema = z
  .string()
  .refine(isValidLocalDate, LOCAL_DATE_MESSAGE);

export const utcTimestampSchema = z
  .string()
  .refine(isValidUtcTimestamp, UTC_TIMESTAMP_MESSAGE);

export const customerNameSchema = z
  .string()
  .trim()
  .min(2, CUSTOMER_NAME_MESSAGE)
  .max(MAX_CUSTOMER_NAME_LENGTH, CUSTOMER_NAME_MESSAGE)
  .regex(CUSTOMER_NAME_PATTERN, CUSTOMER_NAME_MESSAGE);

export function normalizePolishPhone(value: string): string | null {
  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_CUSTOMER_PHONE_LENGTH ||
    !/^[+\d\s-]+$/.test(trimmed)
  ) {
    return null;
  }

  const compact = trimmed.replace(/[\s-]/g, "");

  if (/^\d{9}$/.test(compact)) {
    return `+48${compact}`;
  }

  if (/^\+48\d{9}$/.test(compact)) {
    return compact;
  }

  return null;
}

export const customerPhoneSchema = z
  .string()
  .max(MAX_CUSTOMER_PHONE_LENGTH, CUSTOMER_PHONE_MESSAGE)
  .refine(
    (value) => normalizePolishPhone(value) !== null,
    CUSTOMER_PHONE_MESSAGE,
  )
  .transform((value) => normalizePolishPhone(value) ?? "");

export const customerEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_CUSTOMER_EMAIL_LENGTH, CUSTOMER_EMAIL_MESSAGE)
  .email(CUSTOMER_EMAIL_MESSAGE);

export const customerNotesSchema = z
  .string()
  .trim()
  .max(
    MAX_CUSTOMER_NOTES_LENGTH,
    `Uwagi mogą mieć maksymalnie ${MAX_CUSTOMER_NOTES_LENGTH} znaków.`,
  )
  .optional()
  .transform((value): string | null =>
    value === undefined || value.length === 0 ? null : value,
  );

export const privacyNoticeSchema = z.literal(true, {
  error: "Potwierdź zapoznanie się z polityką prywatności.",
});

export function zodIssuesToFieldErrors(
  issues: readonly z.core.$ZodIssue[],
): ApiFieldErrors {
  const fieldErrors: ApiFieldErrors = {};

  for (const issue of issues) {
    const key =
      issue.path.length === 0
        ? "_root"
        : issue.path.map(String).join(".");

    if (fieldErrors[key] === undefined) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
