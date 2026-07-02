import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { handleBookingsRequest } from '../../functions/api/public/bookings';
import {
  createMockD1,
  type MockD1BatchCall,
  type MockD1Call,
  type MockD1Statement,
} from './mock-d1';

const BOOKINGS_URL = 'https://example.invalid/api/public/bookings';
const NOW_UTC = '2026-07-01T10:00:00.000Z';
const UUID = '00000000-0000-4000-8000-000000000001';

const BASE_BODY: Record<string, unknown> = {
  serviceId: 1,
  barberId: 1,
  startsAt: '2026-07-15T08:00:00.000Z',
  customerName: 'Jan Kowalski',
  customerPhone: '+48123456789',
  customerEmail: 'jan@example.com',
  customerNotes: '',
  privacyNoticeAccepted: true,
  turnstileToken: 'test-turnstile-token',
};

interface BookingDatabaseOptions {
  durationMinutes?: number;
  service?: { id: number; name: string; duration_minutes: number; price_grosze: number } | null;
  barber?: { id: number; name: string } | null;
  link?: { linked: number } | null;
  workingHours?: { start_time: string; end_time: string } | null;
  blockedPeriods?: { starts_at_utc: string; ends_at_utc: string }[];
  visibleAppointmentSlots?: string[];
  initialSlotStarts?: string[];
  initialBookingCodes?: string[];
}

interface StoredAppointment {
  sql: string;
  bindings: readonly unknown[];
  customerEmailStatus: string;
  adminEmailStatus: string;
  emailError: string | null;
}

function successfulBatchResults(call: MockD1BatchCall): D1Result<unknown>[] {
  return call.statements.map(() => ({ results: [] }) as unknown as D1Result<unknown>);
}

function createBookingDatabase(options: BookingDatabaseOptions = {}) {
  const appointments = new Map<string, StoredAppointment>();
  const bookingCodes = new Set(options.initialBookingCodes ?? []);
  const slotKeys = new Set((options.initialSlotStarts ?? []).map((slotStart) => `1|${slotStart}`));

  const mock = createMockD1(
    (call: MockD1Call) => {
      if (call.sql.includes('UPDATE appointments')) {
        const id = String(call.bindings[4]);
        const appointment = appointments.get(id);

        if (appointment === undefined) {
          throw new Error('Mock appointment not found for email status update.');
        }

        appointment.customerEmailStatus = String(call.bindings[0]);
        appointment.adminEmailStatus = String(call.bindings[1]);
        appointment.emailError = call.bindings[2] === null ? null : String(call.bindings[2]);

        return { results: [] } as unknown as D1Result<unknown>;
      }

      if (call.sql.includes('FROM services')) {
        return options.service === undefined
          ? {
              id: 1,
              name: 'Strzyżenie męskie',
              duration_minutes: options.durationMinutes ?? 45,
              price_grosze: 7000,
            }
          : options.service;
      }

      if (call.sql.includes('FROM barbers')) {
        return options.barber === undefined ? { id: 1, name: 'Michał' } : options.barber;
      }

      if (call.sql.includes('FROM barber_services')) {
        return options.link === undefined ? { linked: 1 } : options.link;
      }

      if (call.sql.includes('FROM working_hours')) {
        return options.workingHours === undefined
          ? { start_time: '09:00', end_time: '20:00' }
          : options.workingHours;
      }

      if (call.sql.includes('FROM blocked_periods')) {
        return options.blockedPeriods ?? [];
      }

      if (call.sql.includes('FROM appointment_slots')) {
        return (options.visibleAppointmentSlots ?? []).map((slotStart) => ({
          slot_start_utc: slotStart,
        }));
      }

      throw new Error(`Unexpected mock query: ${call.sql}`);
    },
    async (call: MockD1BatchCall) => {
      const stagedAppointments = new Map(appointments);
      const stagedBookingCodes = new Set(bookingCodes);
      const stagedSlotKeys = new Set(slotKeys);

      for (const statement of call.statements) {
        if (statement.sql.includes('INSERT INTO appointments')) {
          const id = String(statement.bindings[0]);
          const bookingCode = String(statement.bindings[1]);

          if (stagedBookingCodes.has(bookingCode)) {
            throw new Error('D1_ERROR: UNIQUE constraint failed: appointments.booking_code');
          }

          stagedBookingCodes.add(bookingCode);
          stagedAppointments.set(id, {
            sql: statement.sql,
            bindings: statement.bindings,
            customerEmailStatus: 'pending',
            adminEmailStatus: 'pending',
            emailError: null,
          });
          continue;
        }

        if (statement.sql.includes('INSERT INTO appointment_slots')) {
          const barberId = Number(statement.bindings[1]);
          const slotStart = String(statement.bindings[2]);
          const key = `${barberId}|${slotStart}`;

          if (stagedSlotKeys.has(key)) {
            throw new Error(
              'D1_ERROR: UNIQUE constraint failed: appointment_slots.barber_id, appointment_slots.slot_start_utc',
            );
          }

          stagedSlotKeys.add(key);
          continue;
        }

        throw new Error(`Unexpected batch statement: ${statement.sql}`);
      }

      appointments.clear();
      stagedAppointments.forEach((appointment, id) => appointments.set(id, appointment));
      bookingCodes.clear();
      stagedBookingCodes.forEach((bookingCode) => bookingCodes.add(bookingCode));
      slotKeys.clear();
      stagedSlotKeys.forEach((slotKey) => slotKeys.add(slotKey));

      return successfulBatchResults(call);
    },
  );

  return {
    ...mock,
    state: {
      appointments,
      bookingCodes,
      slotKeys,
    },
  };
}

function createBookingRequest(
  body: Record<string, unknown> = BASE_BODY,
  contentType = 'application/json',
): Request {
  return new Request(BOOKINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
    },
    body: JSON.stringify(body),
  });
}

function runtime(
  overrides: {
    nowUtc?: string;
    uuidGenerator?: () => string;
    bookingCodeGenerator?: () => string;
    fetcher?: typeof fetch;
    turnstileTimeoutMs?: number;
    resendTimeoutMs?: number;
  } = {},
) {
  return {
    nowUtc: overrides.nowUtc ?? NOW_UTC,
    uuidGenerator: overrides.uuidGenerator ?? (() => UUID),
    bookingCodeGenerator: overrides.bookingCodeGenerator ?? (() => 'BK-ABC234'),
    fetcher:
      overrides.fetcher ??
      (async (input: RequestInfo | URL) => {
        if (String(input).includes('siteverify')) {
          return Response.json({ success: true });
        }

        return new Response(null, { status: 200 });
      }),
    turnstileTimeoutMs: overrides.turnstileTimeoutMs,
    resendTimeoutMs: overrides.resendTimeoutMs,
  };
}

interface TestEnvironmentOverrides {
  PUBLIC_TURNSTILE_SITE_KEY?: string | undefined;
  TURNSTILE_SECRET_KEY?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  RESEND_FROM_EMAIL?: string | undefined;
  ADMIN_NOTIFICATION_EMAIL?: string | undefined;
}

function environment(database: D1Database, overrides: TestEnvironmentOverrides = {}): Env {
  return {
    DB: database,
    PUBLIC_TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-secret-key',
    RESEND_API_KEY: 'test-resend-key',
    RESEND_FROM_EMAIL: 'Brzytwa <booking@example.com>',
    ADMIN_NOTIFICATION_EMAIL: 'admin@example.com',
    ...overrides,
  } as Env;
}

async function throughMiddleware(
  request: Request,
  database: D1Database,
  runtimeOverrides: Parameters<typeof runtime>[0] = {},
  environmentOverrides: TestEnvironmentOverrides = {},
) {
  return handleApiRequest({
    request,
    next: () =>
      handleBookingsRequest(
        request,
        environment(database, environmentOverrides),
        runtime(runtimeOverrides),
      ),
    logger: {
      error: vi.fn(),
    },
  });
}

function appointmentStatement(batchCall: MockD1BatchCall): MockD1Statement {
  const statement = batchCall.statements.find((item) =>
    item.sql.includes('INSERT INTO appointments'),
  );

  if (statement === undefined) {
    throw new Error('Appointment statement not found.');
  }

  return statement;
}

describe('POST /api/public/bookings success and atomic slot locks', () => {
  it.each([
    { durationMinutes: 30, expectedSlotCount: 2, expectedEnd: '2026-07-15T08:30:00.000Z' },
    { durationMinutes: 45, expectedSlotCount: 3, expectedEnd: '2026-07-15T08:45:00.000Z' },
    { durationMinutes: 75, expectedSlotCount: 5, expectedEnd: '2026-07-15T09:15:00.000Z' },
  ])(
    'creates a $durationMinutes-minute booking with $expectedSlotCount slot locks',
    async ({ durationMinutes, expectedSlotCount, expectedEnd }) => {
      const { database, batchCalls, state } = createBookingDatabase({ durationMinutes });
      const response = await handleBookingsRequest(
        createBookingRequest(),
        environment(database),
        runtime(),
      );

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({
        success: true,
        data: {
          booking: {
            bookingCode: 'BK-ABC234',
            serviceName: 'Strzyżenie męskie',
            barberName: 'Michał',
            startsAt: '2026-07-15T08:00:00.000Z',
            endsAt: expectedEnd,
            localDate: '15.07.2026',
            localTime: '10:00',
            durationMinutes,
            priceGrosze: 7000,
          },
          emailStatus: {
            customer: 'sent',
            admin: 'sent',
          },
        },
      });
      expect(batchCalls).toHaveLength(1);
      expect(batchCalls[0]?.statements).toHaveLength(1 + expectedSlotCount);
      expect(state.appointments).toHaveLength(1);
      expect(state.slotKeys).toHaveLength(expectedSlotCount);
    },
  );

  it('stores normalized customer data and explicit initial statuses', async () => {
    const { database, batchCalls } = createBookingDatabase();
    const request = createBookingRequest({
      ...BASE_BODY,
      customerName: '  Jan Kowalski  ',
      customerPhone: '123 456 789',
      customerEmail: '  JAN@Example.COM ',
      customerNotes: '   ',
    });

    await handleBookingsRequest(request, environment(database), runtime());

    const statement = appointmentStatement(batchCalls[0] as MockD1BatchCall);

    expect(statement.bindings[4]).toBe('Jan Kowalski');
    expect(statement.bindings[5]).toBe('+48123456789');
    expect(statement.bindings[6]).toBe('jan@example.com');
    expect(statement.bindings[7]).toBeNull();
    expect(statement.sql).toContain("'confirmed'");
    expect(statement.sql).toContain("'pending', 'pending', NULL");
  });
});

describe('POST /api/public/bookings request validation', () => {
  it('returns VALIDATION_ERROR when privacy consent is false', async () => {
    const { database, calls, batchCalls } = createBookingDatabase();
    const response = await throughMiddleware(
      createBookingRequest({
        ...BASE_BODY,
        privacyNoticeAccepted: false,
      }),
      database,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        fieldErrors: {
          privacyNoticeAccepted: expect.any(String),
        },
      },
    });
    expect(calls).toHaveLength(0);
    expect(batchCalls).toHaveLength(0);
  });

  it('returns INVALID_CONTENT_TYPE before reading the body', async () => {
    const { database } = createBookingDatabase();
    const response = await throughMiddleware(
      createBookingRequest(BASE_BODY, 'text/plain'),
      database,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'INVALID_CONTENT_TYPE',
      },
    });
  });

  it('returns INVALID_JSON for malformed JSON', async () => {
    const { database } = createBookingDatabase();
    const request = new Request(BOOKINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"serviceId":',
    });
    const response = await throughMiddleware(request, database);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'INVALID_JSON',
      },
    });
  });

  it('returns PAYLOAD_TOO_LARGE before parsing an oversized body', async () => {
    const { database } = createBookingDatabase();
    const request = new Request(BOOKINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '20000',
      },
      body: '{}',
    });
    const response = await throughMiddleware(request, database);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
      },
    });
  });

  it('returns 405 with Allow: POST for GET', async () => {
    const { database, calls, batchCalls } = createBookingDatabase();
    const request = new Request(BOOKINGS_URL);
    const response = await throughMiddleware(request, database);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'METHOD_NOT_ALLOWED',
      },
    });
    expect(calls).toHaveLength(0);
    expect(batchCalls).toHaveLength(0);
  });
});

describe('POST /api/public/bookings catalog checks', () => {
  it('returns SERVICE_NOT_FOUND for an inactive or missing service', async () => {
    const { database, calls } = createBookingDatabase({ service: null });
    const response = await throughMiddleware(createBookingRequest(), database);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SERVICE_NOT_FOUND' },
    });
    expect(calls).toHaveLength(1);
  });

  it('returns BARBER_NOT_FOUND for an inactive or missing barber', async () => {
    const { database, calls } = createBookingDatabase({ barber: null });
    const response = await throughMiddleware(createBookingRequest(), database);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'BARBER_NOT_FOUND' },
    });
    expect(calls).toHaveLength(2);
  });

  it('returns BARBER_SERVICE_UNAVAILABLE for an unsupported service', async () => {
    const { database, calls } = createBookingDatabase({ link: null });
    const response = await throughMiddleware(createBookingRequest(), database);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'BARBER_SERVICE_UNAVAILABLE' },
    });
    expect(calls).toHaveLength(3);
  });
});

describe('POST /api/public/bookings availability recheck', () => {
  it('returns INVALID_DATE for a start in the past', async () => {
    const { database } = createBookingDatabase();
    const response = await throughMiddleware(
      createBookingRequest({
        ...BASE_BODY,
        startsAt: '2026-06-30T08:00:00.000Z',
      }),
      database,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_DATE' },
    });
  });

  it('returns BOOKING_TOO_EARLY inside the 120-minute lead time', async () => {
    const { database } = createBookingDatabase();
    const response = await throughMiddleware(createBookingRequest(), database, {
      nowUtc: '2026-07-15T07:00:00.000Z',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'BOOKING_TOO_EARLY' },
    });
  });

  it('returns BOOKING_TOO_FAR beyond the 45-day horizon', async () => {
    const { database } = createBookingDatabase();
    const response = await throughMiddleware(
      createBookingRequest({
        ...BASE_BODY,
        startsAt: '2026-08-16T08:00:00.000Z',
      }),
      database,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'BOOKING_TOO_FAR' },
    });
  });

  it('returns OUTSIDE_WORKING_HOURS on a closed day', async () => {
    const { database } = createBookingDatabase({ workingHours: null });
    const response = await throughMiddleware(createBookingRequest(), database);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'OUTSIDE_WORKING_HOURS' },
    });
  });

  it('returns OUTSIDE_WORKING_HOURS when the service ends after closing', async () => {
    const { database } = createBookingDatabase({
      workingHours: { start_time: '10:00', end_time: '11:00' },
    });
    const response = await throughMiddleware(
      createBookingRequest({
        ...BASE_BODY,
        startsAt: '2026-07-15T08:30:00.000Z',
      }),
      database,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'OUTSIDE_WORKING_HOURS' },
    });
  });

  it('returns BLOCKED_PERIOD when a block intersects the service', async () => {
    const { database } = createBookingDatabase({
      blockedPeriods: [
        {
          starts_at_utc: '2026-07-15T08:15:00.000Z',
          ends_at_utc: '2026-07-15T08:30:00.000Z',
        },
      ],
    });
    const response = await throughMiddleware(createBookingRequest(), database);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'BLOCKED_PERIOD' },
    });
  });

  it.each(['2026-07-15T08:00:00.000Z', '2026-07-15T08:15:00.000Z'])(
    'returns SLOT_TAKEN when occupied segment %s intersects the service',
    async (occupiedSlot) => {
      const { database } = createBookingDatabase({
        visibleAppointmentSlots: [occupiedSlot],
      });
      const response = await throughMiddleware(createBookingRequest(), database);

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'SLOT_TAKEN' },
      });
    },
  );
});

describe('POST /api/public/bookings atomic conflicts and retries', () => {
  it('allows only one of two concurrent requests to reserve the same slot', async () => {
    const bookingDatabase = createBookingDatabase();
    const firstRequest = createBookingRequest();
    const secondRequest = createBookingRequest();
    const firstResponsePromise = throughMiddleware(firstRequest, bookingDatabase.database, {
      uuidGenerator: () => '00000000-0000-4000-8000-000000000011',
      bookingCodeGenerator: () => 'BK-AAA234',
    });
    const secondResponsePromise = throughMiddleware(secondRequest, bookingDatabase.database, {
      uuidGenerator: () => '00000000-0000-4000-8000-000000000012',
      bookingCodeGenerator: () => 'BK-BBB234',
    });
    const responses = await Promise.all([firstResponsePromise, secondResponsePromise]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const conflictResponse = responses.find((response) => response.status === 409);

    await expect(conflictResponse?.json()).resolves.toMatchObject({
      error: { code: 'SLOT_TAKEN' },
    });
    expect(bookingDatabase.state.appointments).toHaveLength(1);
    expect(bookingDatabase.state.slotKeys).toHaveLength(3);
  });

  it('rolls back the appointment when a slot insert conflicts', async () => {
    const bookingDatabase = createBookingDatabase({
      initialSlotStarts: ['2026-07-15T08:15:00.000Z'],
    });
    const response = await throughMiddleware(createBookingRequest(), bookingDatabase.database);

    expect(response.status).toBe(409);
    expect(bookingDatabase.state.appointments).toHaveLength(0);
    expect(bookingDatabase.state.slotKeys).toEqual(new Set(['1|2026-07-15T08:15:00.000Z']));
  });

  it('retries the whole batch after a booking code conflict', async () => {
    const bookingDatabase = createBookingDatabase({
      initialBookingCodes: ['BK-AAA234'],
    });
    const codes = ['BK-AAA234', 'BK-BBB234'];
    const response = await handleBookingsRequest(
      createBookingRequest(),
      environment(bookingDatabase.database),
      runtime({
        bookingCodeGenerator: () => codes.shift() ?? 'BK-BBB234',
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        booking: {
          bookingCode: 'BK-BBB234',
        },
      },
    });
    expect(bookingDatabase.batchCalls).toHaveLength(2);
    expect(bookingDatabase.state.appointments).toHaveLength(1);
  });

  it('returns a safe INTERNAL_ERROR after exhausting booking code retries', async () => {
    const logger = {
      error: vi.fn(),
    };
    const bookingDatabase = createBookingDatabase({
      initialBookingCodes: ['BK-AAA234'],
    });
    const request = createBookingRequest();
    const response = await handleApiRequest({
      request,
      next: () =>
        handleBookingsRequest(
          request,
          environment(bookingDatabase.database),
          runtime({
            bookingCodeGenerator: () => 'BK-AAA234',
          }),
        ),
      logger,
    });
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).toContain('INTERNAL_ERROR');
    expect(responseText).not.toContain('UNIQUE constraint');
    expect(bookingDatabase.batchCalls).toHaveLength(5);
    expect(bookingDatabase.state.appointments).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

describe('POST /api/public/bookings Turnstile integration', () => {
  it('does not create a booking when the token is missing', async () => {
    const bookingDatabase = createBookingDatabase();
    const response = await throughMiddleware(
      createBookingRequest({
        ...BASE_BODY,
        turnstileToken: undefined,
      }),
      bookingDatabase.database,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TURNSTILE_FAILED' },
    });
    expect(bookingDatabase.calls).toHaveLength(0);
    expect(bookingDatabase.batchCalls).toHaveLength(0);
  });

  it('does not create a booking when Siteverify rejects the token', async () => {
    const bookingDatabase = createBookingDatabase();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ success: false }));
    const response = await throughMiddleware(createBookingRequest(), bookingDatabase.database, {
      fetcher,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TURNSTILE_FAILED' },
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(bookingDatabase.batchCalls).toHaveLength(0);
  });

  it('returns TURNSTILE_UNAVAILABLE without leaking token or secret', async () => {
    const bookingDatabase = createBookingDatabase();
    const logger = {
      error: vi.fn(),
    };
    const token = 'private-turnstile-token';
    const secret = 'private-turnstile-secret';
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error(`${token}:${secret}`);
    });
    const request = createBookingRequest({
      ...BASE_BODY,
      turnstileToken: token,
    });
    const response = await handleApiRequest({
      request,
      next: () =>
        handleBookingsRequest(
          request,
          environment(bookingDatabase.database, {
            TURNSTILE_SECRET_KEY: secret,
          }),
          runtime({ fetcher }),
        ),
      logger,
    });
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(responseText).toContain('TURNSTILE_UNAVAILABLE');
    expect(responseText).not.toContain(token);
    expect(responseText).not.toContain(secret);
    expect(logger.error).not.toHaveBeenCalled();
    expect(bookingDatabase.batchCalls).toHaveLength(0);
  });

  it('handles missing Turnstile environment variables safely', async () => {
    const bookingDatabase = createBookingDatabase();
    const fetcher = vi.fn<typeof fetch>();
    const response = await throughMiddleware(
      createBookingRequest(),
      bookingDatabase.database,
      { fetcher },
      { TURNSTILE_SECRET_KEY: undefined },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TURNSTILE_UNAVAILABLE' },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(bookingDatabase.batchCalls).toHaveLength(0);
  });
});

describe('POST /api/public/bookings email integration', () => {
  function deliveryFetcher(
    failedRecipients: readonly string[] = [],
  ): ReturnType<typeof vi.fn<typeof fetch>> {
    return vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes('siteverify')) {
        return Response.json({ success: true });
      }

      const payload = JSON.parse(String(init?.body)) as {
        to: string[];
      };
      const recipient = payload.to[0] ?? '';

      return new Response(null, {
        status: failedRecipients.includes(recipient) ? 500 : 200,
      });
    });
  }

  it.each([
    {
      name: 'both sent',
      failedRecipients: [],
      expectedCustomer: 'sent',
      expectedAdmin: 'sent',
      expectedError: null,
    },
    {
      name: 'customer failed',
      failedRecipients: ['jan@example.com'],
      expectedCustomer: 'failed',
      expectedAdmin: 'sent',
      expectedError: 'customer_delivery_failed',
    },
    {
      name: 'admin failed',
      failedRecipients: ['admin@example.com'],
      expectedCustomer: 'sent',
      expectedAdmin: 'failed',
      expectedError: 'admin_delivery_failed',
    },
    {
      name: 'both failed',
      failedRecipients: ['jan@example.com', 'admin@example.com'],
      expectedCustomer: 'failed',
      expectedAdmin: 'failed',
      expectedError: 'customer_delivery_failed,admin_delivery_failed',
    },
  ])(
    'keeps the booking and stores statuses when $name',
    async ({ failedRecipients, expectedCustomer, expectedAdmin, expectedError }) => {
      const bookingDatabase = createBookingDatabase();
      const fetcher = deliveryFetcher(failedRecipients);
      const response = await handleBookingsRequest(
        createBookingRequest(),
        environment(bookingDatabase.database),
        runtime({ fetcher }),
      );
      const appointment = Array.from(bookingDatabase.state.appointments.values())[0];

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        data: {
          emailStatus: {
            customer: expectedCustomer,
            admin: expectedAdmin,
          },
        },
      });
      expect(bookingDatabase.state.appointments).toHaveLength(1);
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(appointment).toMatchObject({
        customerEmailStatus: expectedCustomer,
        adminEmailStatus: expectedAdmin,
        emailError: expectedError,
      });
    },
  );

  it('keeps the booking when required Resend variables are missing', async () => {
    const bookingDatabase = createBookingDatabase();
    const fetcher = deliveryFetcher();
    const response = await handleBookingsRequest(
      createBookingRequest(),
      environment(bookingDatabase.database, {
        RESEND_API_KEY: undefined,
      }),
      runtime({ fetcher }),
    );
    const appointment = Array.from(bookingDatabase.state.appointments.values())[0];

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        emailStatus: {
          customer: 'failed',
          admin: 'failed',
        },
      },
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(appointment).toMatchObject({
      customerEmailStatus: 'failed',
      adminEmailStatus: 'failed',
      emailError: 'email_configuration_missing',
    });
  });

  it('does not send email before the atomic booking batch succeeds', async () => {
    const bookingDatabase = createBookingDatabase({
      initialSlotStarts: ['2026-07-15T08:15:00.000Z'],
    });
    const fetcher = deliveryFetcher();
    const response = await throughMiddleware(createBookingRequest(), bookingDatabase.database, {
      fetcher,
    });

    expect(response.status).toBe(409);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('siteverify');
    expect(bookingDatabase.state.appointments).toHaveLength(0);
  });
});
