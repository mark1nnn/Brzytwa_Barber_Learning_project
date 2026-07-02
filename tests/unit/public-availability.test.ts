import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { handleAvailabilityRequest } from '../../functions/api/public/availability';
import { createMockD1, type MockD1Call } from './mock-d1';

const REQUEST_URL =
  'https://example.invalid/api/public/availability?serviceId=1&barberId=1&date=2026-07-15';
const NOW_UTC = '2026-07-01T10:00:00.000Z';

interface AvailabilityDatabaseOptions {
  service?: { id: number; duration_minutes: number } | null;
  barber?: { id: number } | null;
  link?: { linked: number } | null;
  workingHours?: { start_time: string; end_time: string } | null;
  blockedPeriods?: { starts_at_utc: string; ends_at_utc: string }[];
  appointmentSlots?: { slot_start_utc: string }[];
}

function createAvailabilityDatabase(options: AvailabilityDatabaseOptions = {}) {
  return createMockD1((call) => {
    if (call.sql.includes('FROM services')) {
      return options.service === undefined ? { id: 1, duration_minutes: 30 } : options.service;
    }

    if (call.sql.includes('FROM barbers')) {
      return options.barber === undefined ? { id: 1 } : options.barber;
    }

    if (call.sql.includes('FROM barber_services')) {
      return options.link === undefined ? { linked: 1 } : options.link;
    }

    if (call.sql.includes('FROM working_hours')) {
      return options.workingHours === undefined
        ? { start_time: '10:00', end_time: '11:00' }
        : options.workingHours;
    }

    if (call.sql.includes('FROM blocked_periods')) {
      return options.blockedPeriods ?? [];
    }

    if (call.sql.includes('FROM appointment_slots')) {
      return options.appointmentSlots ?? [];
    }

    throw new Error(`Unexpected mock query: ${call.sql}`);
  });
}

async function requestThroughMiddleware(request: Request, database: D1Database, nowUtc = NOW_UTC) {
  return handleApiRequest({
    request,
    next: () => handleAvailabilityRequest(request, database, nowUtc),
    logger: {
      error: vi.fn(),
    },
  });
}

function findCall(calls: readonly MockD1Call[], table: string): MockD1Call | undefined {
  return calls.find((call) => call.sql.includes(`FROM ${table}`));
}

describe('GET /api/public/availability', () => {
  it('returns generated slots and uses bounded prepared D1 queries', async () => {
    const { database, calls } = createAvailabilityDatabase();
    const response = await handleAvailabilityRequest(new Request(REQUEST_URL), database, NOW_UTC);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        date: '2026-07-15',
        timezone: 'Europe/Warsaw',
        slots: [
          {
            startsAt: '2026-07-15T08:00:00.000Z',
            localTime: '10:00',
          },
          {
            startsAt: '2026-07-15T08:15:00.000Z',
            localTime: '10:15',
          },
          {
            startsAt: '2026-07-15T08:30:00.000Z',
            localTime: '10:30',
          },
        ],
      },
    });
    expect(findCall(calls, 'services')?.bindings).toEqual([1]);
    expect(findCall(calls, 'barbers')?.bindings).toEqual([1]);
    expect(findCall(calls, 'barber_services')?.bindings).toEqual([1, 1]);
    expect(findCall(calls, 'working_hours')?.bindings).toEqual([1, 3]);
    expect(findCall(calls, 'blocked_periods')?.bindings).toEqual([
      1,
      '2026-07-15T09:00:00.000Z',
      '2026-07-15T08:00:00.000Z',
    ]);
    expect(findCall(calls, 'appointment_slots')?.bindings).toEqual([
      1,
      '2026-07-15T08:00:00.000Z',
      '2026-07-15T09:00:00.000Z',
    ]);
    expect(findCall(calls, 'blocked_periods')?.sql).toMatch(
      /starts_at_utc < \?\s+AND ends_at_utc > \?/,
    );
  });

  it('returns an empty list for a closed day without querying periods or slots', async () => {
    const { database, calls } = createAvailabilityDatabase({
      workingHours: null,
    });
    const response = await handleAvailabilityRequest(new Request(REQUEST_URL), database, NOW_UTC);

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        slots: [],
      },
    });
    expect(findCall(calls, 'blocked_periods')).toBeUndefined();
    expect(findCall(calls, 'appointment_slots')).toBeUndefined();
  });

  it.each([
    'https://example.invalid/api/public/availability?barberId=1&date=2026-07-15',
    'https://example.invalid/api/public/availability?serviceId=abc&barberId=1&date=2026-07-15',
    'https://example.invalid/api/public/availability?serviceId=1&barberId=0&date=2026-07-15',
  ])('returns 400 VALIDATION_ERROR for invalid query %s', async (url) => {
    const { database, calls } = createAvailabilityDatabase();
    const request = new Request(url);
    const response = await requestThroughMiddleware(request, database);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
    expect(calls).toHaveLength(0);
  });

  it('returns 400 INVALID_DATE for a nonexistent local date', async () => {
    const { database, calls } = createAvailabilityDatabase();
    const request = new Request(
      'https://example.invalid/api/public/availability?serviceId=1&barberId=1&date=2026-02-30',
    );
    const response = await requestThroughMiddleware(request, database);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'INVALID_DATE',
      },
    });
    expect(calls).toHaveLength(0);
  });

  it('returns 400 BOOKING_TOO_FAR after the 45-day horizon', async () => {
    const { database, calls } = createAvailabilityDatabase();
    const request = new Request(
      'https://example.invalid/api/public/availability?serviceId=1&barberId=1&date=2026-08-16',
    );
    const response = await requestThroughMiddleware(request, database);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'BOOKING_TOO_FAR',
      },
    });
    expect(calls).toHaveLength(0);
  });

  it('returns 404 SERVICE_NOT_FOUND for a missing or inactive service', async () => {
    const { database, calls } = createAvailabilityDatabase({
      service: null,
    });
    const request = new Request(REQUEST_URL);
    const response = await requestThroughMiddleware(request, database);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'SERVICE_NOT_FOUND',
      },
    });
    expect(calls).toHaveLength(1);
  });

  it('returns 404 BARBER_NOT_FOUND for a missing or inactive barber', async () => {
    const { database, calls } = createAvailabilityDatabase({
      barber: null,
    });
    const request = new Request(REQUEST_URL);
    const response = await requestThroughMiddleware(request, database);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'BARBER_NOT_FOUND',
      },
    });
    expect(calls).toHaveLength(2);
  });

  it('returns 400 BARBER_SERVICE_UNAVAILABLE when the barber does not provide the service', async () => {
    const { database, calls } = createAvailabilityDatabase({
      link: null,
    });
    const request = new Request(REQUEST_URL);
    const response = await requestThroughMiddleware(request, database);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'BARBER_SERVICE_UNAVAILABLE',
      },
    });
    expect(calls).toHaveLength(3);
  });

  it('returns 405 with Allow: GET for POST', async () => {
    const { database, calls } = createAvailabilityDatabase();
    const request = new Request(REQUEST_URL, {
      method: 'POST',
    });
    const response = await requestThroughMiddleware(request, database);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
      },
    });
    expect(calls).toHaveLength(0);
  });

  it('does not expose D1 or SQL details through the middleware', async () => {
    const logger = {
      error: vi.fn(),
    };
    const { database } = createMockD1(() => {
      throw new Error('SQLITE_ERROR: SELECT secret internal detail');
    });
    const request = new Request(REQUEST_URL);
    const response = await handleApiRequest({
      request,
      next: () => handleAvailabilityRequest(request, database, NOW_UTC),
      logger,
    });
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).toContain('INTERNAL_ERROR');
    expect(responseText).not.toContain('SQLITE_ERROR');
    expect(responseText).not.toContain('SELECT');
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
