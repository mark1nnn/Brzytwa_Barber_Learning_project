import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { handleAdminBlockedPeriodDeleteRequest } from '../../functions/api/admin/blocked-periods/[id]';
import {
  handleAdminBlockedPeriodsRequest,
  type AdminBlockedPeriodRow,
} from '../../functions/api/admin/blocked-periods';
import { handleAdminWorkingHoursUpdateRequest } from '../../functions/api/admin/working-hours/[id]';
import {
  handleAdminWorkingHoursRequest,
  type AdminWorkingHoursRow,
} from '../../functions/api/admin/working-hours';
import { createMockD1 } from './mock-d1';

const BLOCKED_PERIOD_ID = '22222222-2222-4222-8222-222222222222';
const NOW_UTC = '2026-07-06T12:00:00.000Z';

const WORKING_HOURS_ROW: AdminWorkingHoursRow = {
  id: 1,
  barber_id: 1,
  barber_name: 'Michał',
  weekday: 1,
  start_time: '09:00',
  end_time: '20:00',
  active: 1,
};

const BLOCKED_PERIOD_ROW: AdminBlockedPeriodRow = {
  id: BLOCKED_PERIOD_ID,
  barber_id: 1,
  barber_name: 'Michał',
  starts_at_utc: '2026-07-15T08:00:00.000Z',
  ends_at_utc: '2026-07-15T09:00:00.000Z',
  reason: 'Szkolenie',
  created_at: NOW_UTC,
};

function jsonRequest(url: string, method: 'POST' | 'PATCH', body: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function throughApi(request: Request, next: () => Promise<Response>): Promise<Response> {
  return handleApiRequest({
    request,
    next,
    logger: {
      error: vi.fn(),
    },
  });
}

describe('admin working hours', () => {
  it('lists working hours with ISO weekday and fixed Warsaw timezone', async () => {
    const { database } = createMockD1(() => [WORKING_HOURS_ROW]);
    const response = await handleAdminWorkingHoursRequest(
      new Request('https://example.invalid/api/admin/working-hours'),
      database,
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        workingHours: [
          {
            id: 1,
            barber: { id: 1, name: 'Michał' },
            weekday: 1,
            startTime: '09:00',
            endTime: '20:00',
            active: true,
            timezone: 'Europe/Warsaw',
          },
        ],
        timezone: 'Europe/Warsaw',
      },
    });
  });

  it('updates start, end and active with prepared bindings', async () => {
    const { database, calls } = createMockD1((call) =>
      call.operation === 'first'
        ? WORKING_HOURS_ROW
        : ({ results: [] } as unknown as D1Result<unknown>),
    );
    const request = jsonRequest('https://example.invalid/api/admin/working-hours/1', 'PATCH', {
      startTime: '10:00',
      endTime: '18:30',
      active: false,
    });
    const response = await handleAdminWorkingHoursUpdateRequest(request, database, '1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        workingHours: {
          id: 1,
          weekday: 1,
          startTime: '10:00',
          endTime: '18:30',
          active: false,
          timezone: 'Europe/Warsaw',
        },
      },
    });
    expect(calls[1]?.sql).toContain('UPDATE working_hours');
    expect(calls[1]?.bindings).toEqual(['10:00', '18:30', 0, 1]);
  });

  it.each([
    { startTime: '9:00' },
    { endTime: '24:00' },
    { startTime: '20:00', endTime: '09:00' },
    { startTime: '09:00', endTime: '09:00' },
  ])('rejects invalid working hours %#', async (body) => {
    const { database } = createMockD1((call) =>
      call.operation === 'first'
        ? WORKING_HOURS_ROW
        : ({ results: [] } as unknown as D1Result<unknown>),
    );
    const request = jsonRequest('https://example.invalid/api/admin/working-hours/1', 'PATCH', body);
    const response = await throughApi(request, () =>
      handleAdminWorkingHoursUpdateRequest(request, database, '1'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('returns WORKING_HOURS_NOT_FOUND for an unknown row', async () => {
    const { database } = createMockD1(() => null);
    const request = jsonRequest('https://example.invalid/api/admin/working-hours/999', 'PATCH', {
      active: false,
    });
    const response = await throughApi(request, () =>
      handleAdminWorkingHoursUpdateRequest(request, database, '999'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'WORKING_HOURS_NOT_FOUND' },
    });
  });
});

describe('admin blocked periods', () => {
  it('lists blocked periods with barber data', async () => {
    const { database } = createMockD1(() => [BLOCKED_PERIOD_ROW]);
    const response = await handleAdminBlockedPeriodsRequest(
      new Request('https://example.invalid/api/admin/blocked-periods'),
      database,
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        blockedPeriods: [
          {
            id: BLOCKED_PERIOD_ID,
            barber: { id: 1, name: 'Michał' },
            startsAt: '2026-07-15T08:00:00.000Z',
            endsAt: '2026-07-15T09:00:00.000Z',
            reason: 'Szkolenie',
          },
        ],
      },
    });
  });

  it('creates a blocked period for an active barber', async () => {
    const { database, calls } = createMockD1((call) => {
      if (call.operation === 'first') {
        return { id: 1, name: 'Michał', active: 1 };
      }

      return { results: [] } as unknown as D1Result<unknown>;
    });
    const request = jsonRequest('https://example.invalid/api/admin/blocked-periods', 'POST', {
      barberId: 1,
      startsAt: '2026-07-15T08:00:00.000Z',
      endsAt: '2026-07-15T09:00:00.000Z',
    });
    const response = await handleAdminBlockedPeriodsRequest(request, database, {
      nowUtc: NOW_UTC,
      uuidGenerator: () => BLOCKED_PERIOD_ID,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        blockedPeriod: {
          id: BLOCKED_PERIOD_ID,
          barber: { id: 1, name: 'Michał' },
          reason: 'Blokada administracyjna',
          createdAt: NOW_UTC,
        },
      },
    });
    expect(calls[1]?.sql).toContain('INSERT INTO blocked_periods');
    expect(calls[1]?.bindings).toEqual([
      BLOCKED_PERIOD_ID,
      1,
      '2026-07-15T08:00:00.000Z',
      '2026-07-15T09:00:00.000Z',
      'Blokada administracyjna',
      NOW_UTC,
    ]);
  });

  it.each([
    {
      startsAt: '2026-07-15T09:00:00.000Z',
      endsAt: '2026-07-15T08:00:00.000Z',
    },
    {
      startsAt: '2026-07-15 08:00',
      endsAt: '2026-07-15T09:00:00.000Z',
    },
  ])('rejects invalid blocked-period timestamps %#', async ({ startsAt, endsAt }) => {
    const { database, calls } = createMockD1(() => {
      throw new Error('D1 must not be queried');
    });
    const request = jsonRequest('https://example.invalid/api/admin/blocked-periods', 'POST', {
      barberId: 1,
      startsAt,
      endsAt,
    });
    const response = await throughApi(request, () =>
      handleAdminBlockedPeriodsRequest(request, database),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(calls).toHaveLength(0);
  });

  it.each([null, { id: 1, name: 'Michał', active: 0 }])(
    'rejects a missing or inactive barber: %s',
    async (barber) => {
      const { database } = createMockD1(() => barber);
      const request = jsonRequest('https://example.invalid/api/admin/blocked-periods', 'POST', {
        barberId: 1,
        startsAt: '2026-07-15T08:00:00.000Z',
        endsAt: '2026-07-15T09:00:00.000Z',
      });
      const response = await throughApi(request, () =>
        handleAdminBlockedPeriodsRequest(request, database),
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: { code: 'BARBER_NOT_FOUND' },
      });
    },
  );

  it('deletes an existing blocked period', async () => {
    const { database, calls } = createMockD1((call) =>
      call.operation === 'first'
        ? { id: BLOCKED_PERIOD_ID }
        : ({ results: [] } as unknown as D1Result<unknown>),
    );
    const request = new Request(
      `https://example.invalid/api/admin/blocked-periods/${BLOCKED_PERIOD_ID}`,
      { method: 'DELETE' },
    );
    const response = await handleAdminBlockedPeriodDeleteRequest(
      request,
      database,
      BLOCKED_PERIOD_ID,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        blockedPeriod: {
          id: BLOCKED_PERIOD_ID,
          deleted: true,
        },
      },
    });
    expect(calls[1]?.sql).toContain('DELETE FROM blocked_periods');
    expect(calls[1]?.bindings).toEqual([BLOCKED_PERIOD_ID]);
  });

  it('returns BLOCKED_PERIOD_NOT_FOUND for an unknown blocked period', async () => {
    const { database } = createMockD1(() => null);
    const request = new Request(
      `https://example.invalid/api/admin/blocked-periods/${BLOCKED_PERIOD_ID}`,
      { method: 'DELETE' },
    );
    const response = await throughApi(request, () =>
      handleAdminBlockedPeriodDeleteRequest(request, database, BLOCKED_PERIOD_ID),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'BLOCKED_PERIOD_NOT_FOUND' },
    });
  });
});
