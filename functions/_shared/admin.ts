import type { z } from 'zod';

import { ApiError } from './errors';
import { localDateTimeToUtc } from './time';
import { API_ERROR_CODES } from './types';
import {
  adminAppointmentsQuerySchema,
  positiveIntegerIdSchema,
  zodIssuesToFieldErrors,
} from './validation';

const DEFAULT_BLOCKED_PERIOD_REASON = 'Blokada administracyjna';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validationError(issues: readonly z.core.$ZodIssue[]): ApiError {
  return new ApiError({
    code: API_ERROR_CODES.VALIDATION_ERROR,
    status: 400,
    message: 'Nie udało się przetworzyć żądania.',
    fieldErrors: zodIssuesToFieldErrors(issues),
  });
}

export function parseWithValidation<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false; error: z.ZodError };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw validationError(result.error.issues);
  }

  return result.data;
}

export function getRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export function parsePositiveRouteId(value: string): number {
  const result = positiveIntegerIdSchema.safeParse(value);

  if (!result.success) {
    throw validationError(
      result.error.issues.map((issue) => ({
        ...issue,
        path: ['id'],
      })),
    );
  }

  return result.data;
}

export function parseUuidRouteId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new ApiError({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      status: 400,
      message: 'Nieprawidłowy identyfikator.',
      fieldErrors: {
        id: 'Podaj prawidłowy identyfikator UUID.',
      },
    });
  }

  return value.toLowerCase();
}

function nextLocalDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function parseAppointmentsQuery(url: URL): {
  dateFromUtc: string | null;
  dateToUtcExclusive: string | null;
  barberId: number | null;
  serviceId: number | null;
  status: string | null;
  sort: 'asc' | 'desc';
  page: number;
  limit: number;
  offset: number;
} {
  const raw = Object.fromEntries(url.searchParams.entries());
  const query = parseWithValidation(adminAppointmentsQuerySchema, raw);

  return {
    dateFromUtc: query.dateFrom === undefined ? null : localDateTimeToUtc(query.dateFrom, '00:00'),
    dateToUtcExclusive:
      query.dateTo === undefined ? null : localDateTimeToUtc(nextLocalDate(query.dateTo), '00:00'),
    barberId: query.barberId ?? null,
    serviceId: query.serviceId ?? null,
    status: query.status ?? null,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  };
}

export function toDatabaseBoolean(value: boolean): number {
  return value ? 1 : 0;
}

export function fromDatabaseBoolean(value: number): boolean {
  return value === 1;
}

export function blockedPeriodReason(value: string | undefined): string {
  return value ?? DEFAULT_BLOCKED_PERIOD_REASON;
}

export interface AdminAppointmentRow {
  id: string;
  booking_code: string;
  barber_id: number;
  barber_name: string;
  service_id: number;
  service_name: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_notes: string | null;
  starts_at_utc: string;
  ends_at_utc: string;
  status: string;
  privacy_notice_accepted_at: string;
  customer_email_status: string;
  admin_email_status: string;
  email_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAppointment {
  id: string;
  bookingCode: string;
  barber: {
    id: number;
    name: string;
  };
  service: {
    id: number;
    name: string;
  };
  customer: {
    name: string;
    phone: string;
    email: string;
    notes: string | null;
  };
  startsAt: string;
  endsAt: string;
  status: string;
  privacyNoticeAcceptedAt: string;
  emailStatus: {
    customer: string;
    admin: string;
    error: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export function toAdminAppointment(row: AdminAppointmentRow): AdminAppointment {
  return {
    id: row.id,
    bookingCode: row.booking_code,
    barber: {
      id: row.barber_id,
      name: row.barber_name,
    },
    service: {
      id: row.service_id,
      name: row.service_name,
    },
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email,
      notes: row.customer_notes,
    },
    startsAt: row.starts_at_utc,
    endsAt: row.ends_at_utc,
    status: row.status,
    privacyNoticeAcceptedAt: row.privacy_notice_accepted_at,
    emailStatus: {
      customer: row.customer_email_status,
      admin: row.admin_email_status,
      error: row.email_error,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
