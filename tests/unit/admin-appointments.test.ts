import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { handleAdminAppointmentDetailRequest } from '../../functions/api/admin/appointments/[id]';
import { handleAdminAppointmentStatusRequest } from '../../functions/api/admin/appointments/[id]/status';
import { handleAdminAppointmentsRequest } from '../../functions/api/admin/appointments';
import type { AdminAppointmentRow } from '../../functions/_shared/admin';
import type { MockD1BatchCall, MockD1Call } from './mock-d1';
import { createMockD1 } from './mock-d1';

const APPOINTMENT_ID = '11111111-1111-4111-8111-111111111111';
const NOW_UTC = '2026-07-06T10:00:00.000Z';

const APPOINTMENT_ROW: AdminAppointmentRow = {
  id: APPOINTMENT_ID,
  booking_code: 'BK-ABC234',
  barber_id: 1,
  barber_name: 'Michał',
  service_id: 2,
  service_name: 'Strzyżenie brody',
  customer_name: 'Jan Kowalski',
  customer_phone: '+48123456789',
  customer_email: 'jan@example.com',
  customer_notes: 'Krótka uwaga',
  starts_at_utc: '2026-07-15T08:00:00.000Z',
  ends_at_utc: '2026-07-15T08:30:00.000Z',
  status: 'confirmed',
  privacy_notice_accepted_at: '2026-07-06T08:00:00.000Z',
  customer_email_status: 'sent',
  admin_email_status: 'sent',
  email_error: null,
  created_at: '2026-07-06T08:00:00.000Z',
  updated_at: '2026-07-06T08:00:00.000Z',
};

function throughApi(request: Request, next: () => Promise<Response>): Promise<Response> {
  return handleApiRequest({
    request,
    next,
    logger: {
      error: vi.fn(),
    },
  });
}

function jsonPatch(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function batchResults(call: MockD1BatchCall): D1Result<unknown>[] {
  return call.statements.map(() => ({ results: [] }) as unknown as D1Result<unknown>);
}

describe('admin appointments list and detail', () => {
  it('binds validated filters, pagination and ascending sort without SQL interpolation', async () => {
    const { database, calls } = createMockD1(() => [APPOINTMENT_ROW]);
    const request = new Request(
      'https://example.invalid/api/admin/appointments?dateFrom=2026-07-15&dateTo=2026-07-16&barberId=1&serviceId=2&status=confirmed&sort=asc&page=2&limit=2',
    );
    const response = await handleAdminAppointmentsRequest(request, database);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        appointments: [
          expect.objectContaining({
            id: APPOINTMENT_ID,
            bookingCode: 'BK-ABC234',
            barber: { id: 1, name: 'Michał' },
            service: { id: 2, name: 'Strzyżenie brody' },
            customer: {
              name: 'Jan Kowalski',
              phone: '+48123456789',
              email: 'jan@example.com',
              notes: 'Krótka uwaga',
            },
          }),
        ],
        pagination: {
          page: 2,
          limit: 2,
          hasMore: false,
        },
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('CASE WHEN ?');
    expect(calls[0]?.sql).not.toContain('2026-07-15');
    expect(calls[0]?.bindings).toEqual([
      '2026-07-14T22:00:00.000Z',
      '2026-07-14T22:00:00.000Z',
      '2026-07-16T22:00:00.000Z',
      '2026-07-16T22:00:00.000Z',
      1,
      1,
      2,
      2,
      'confirmed',
      'confirmed',
      'asc',
      'asc',
      'asc',
      'asc',
      3,
      2,
    ]);
  });

  it('returns appointment detail with service, barber and slot locks', async () => {
    const { database, calls } = createMockD1((call) => {
      if (call.operation === 'first') {
        return APPOINTMENT_ROW;
      }

      return [
        { slot_start_utc: '2026-07-15T08:00:00.000Z' },
        { slot_start_utc: '2026-07-15T08:15:00.000Z' },
      ];
    });
    const response = await handleAdminAppointmentDetailRequest(
      new Request(`https://example.invalid/api/admin/appointments/${APPOINTMENT_ID}`),
      database,
      APPOINTMENT_ID,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        appointment: {
          id: APPOINTMENT_ID,
          barber: { id: 1, name: 'Michał' },
          service: { id: 2, name: 'Strzyżenie brody' },
          slotLocks: ['2026-07-15T08:00:00.000Z', '2026-07-15T08:15:00.000Z'],
        },
      },
    });
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.bindings[0] === APPOINTMENT_ID)).toBe(true);
  });

  it('returns APPOINTMENT_NOT_FOUND for a missing appointment', async () => {
    const { database } = createMockD1(() => null);
    const request = new Request(`https://example.invalid/api/admin/appointments/${APPOINTMENT_ID}`);
    const response = await throughApi(request, () =>
      handleAdminAppointmentDetailRequest(request, database, APPOINTMENT_ID),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'APPOINTMENT_NOT_FOUND',
      },
    });
  });

  it.each(['2026-02-30', '15-07-2026'])(
    'rejects invalid appointment date filter %s',
    async (dateFrom) => {
      const { database, calls } = createMockD1(() => []);
      const request = new Request(
        `https://example.invalid/api/admin/appointments?dateFrom=${dateFrom}`,
      );
      const response = await throughApi(request, () =>
        handleAdminAppointmentsRequest(request, database),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
      expect(calls).toHaveLength(0);
    },
  );

  it('does not disclose SQL or D1 details when the list query fails', async () => {
    const logger = { error: vi.fn() };
    const { database } = createMockD1(() => {
      throw new Error('SQLITE_ERROR: SELECT customer_email FROM appointments');
    });
    const request = new Request('https://example.invalid/api/admin/appointments');
    const response = await handleApiRequest({
      request,
      next: () => handleAdminAppointmentsRequest(request, database),
      logger,
    });
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).toContain('INTERNAL_ERROR');
    expect(responseText).not.toContain('SQLITE_ERROR');
    expect(responseText).not.toContain('customer_email');
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

describe('admin appointment status', () => {
  function statusDatabase(currentStatus: string) {
    return createMockD1((call: MockD1Call) => {
      if (call.operation === 'first') {
        return {
          id: APPOINTMENT_ID,
          status: currentStatus,
        };
      }

      return { results: [] } as unknown as D1Result<unknown>;
    }, batchResults);
  }

  it('updates a valid appointment status', async () => {
    const { database, calls } = statusDatabase('confirmed');
    const request = jsonPatch(
      `https://example.invalid/api/admin/appointments/${APPOINTMENT_ID}/status`,
      { status: 'completed' },
    );
    const response = await handleAdminAppointmentStatusRequest(request, database, APPOINTMENT_ID, {
      nowUtc: NOW_UTC,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        appointment: {
          id: APPOINTMENT_ID,
          status: 'completed',
          updatedAt: NOW_UTC,
        },
      },
    });
    expect(calls[1]?.operation).toBe('run');
    expect(calls[1]?.bindings).toEqual(['completed', NOW_UTC, APPOINTMENT_ID]);
  });

  it('cancels atomically and releases all appointment slots', async () => {
    const { database, batchCalls } = statusDatabase('confirmed');
    const request = jsonPatch(
      `https://example.invalid/api/admin/appointments/${APPOINTMENT_ID}/status`,
      { status: 'cancelled' },
    );
    const response = await handleAdminAppointmentStatusRequest(request, database, APPOINTMENT_ID, {
      nowUtc: NOW_UTC,
    });

    expect(response.status).toBe(200);
    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0]?.statements).toHaveLength(2);
    expect(batchCalls[0]?.statements[0]?.sql).toContain('UPDATE appointments');
    expect(batchCalls[0]?.statements[1]?.sql).toContain('DELETE FROM appointment_slots');
    expect(batchCalls[0]?.statements[1]?.bindings).toEqual([APPOINTMENT_ID]);
  });

  it('makes repeated cancellation idempotent and still ensures slots are released', async () => {
    const { database, batchCalls } = statusDatabase('cancelled');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const request = jsonPatch(
        `https://example.invalid/api/admin/appointments/${APPOINTMENT_ID}/status`,
        { status: 'cancelled' },
      );
      const response = await handleAdminAppointmentStatusRequest(
        request,
        database,
        APPOINTMENT_ID,
        { nowUtc: NOW_UTC },
      );
      expect(response.status).toBe(200);
    }

    expect(batchCalls).toHaveLength(2);
    expect(
      batchCalls.every((call) =>
        call.statements.some((statement) =>
          statement.sql.includes('DELETE FROM appointment_slots'),
        ),
      ),
    ).toBe(true);
  });

  it('returns INVALID_STATUS before querying D1', async () => {
    const { database, calls } = statusDatabase('confirmed');
    const request = jsonPatch(
      `https://example.invalid/api/admin/appointments/${APPOINTMENT_ID}/status`,
      { status: 'deleted' },
    );
    const response = await throughApi(request, () =>
      handleAdminAppointmentStatusRequest(request, database, APPOINTMENT_ID),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'INVALID_STATUS',
      },
    });
    expect(calls).toHaveLength(0);
  });

  it('returns 405 for GET status requests', async () => {
    const { database, calls } = statusDatabase('confirmed');
    const request = new Request(
      `https://example.invalid/api/admin/appointments/${APPOINTMENT_ID}/status`,
    );
    const response = await throughApi(request, () =>
      handleAdminAppointmentStatusRequest(request, database, APPOINTMENT_ID),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('PATCH');
    expect(calls).toHaveLength(0);
  });
});
