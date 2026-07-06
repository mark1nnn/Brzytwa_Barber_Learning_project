import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { handleAdminBarberUpdateRequest } from '../../functions/api/admin/barbers/[id]';
import { handleAdminBarbersRequest, type AdminBarberRow } from '../../functions/api/admin/barbers';
import { handleAdminServiceUpdateRequest } from '../../functions/api/admin/services/[id]';
import {
  handleAdminServicesRequest,
  type AdminServiceRow,
} from '../../functions/api/admin/services';
import { createMockD1 } from './mock-d1';

const NOW_UTC = '2026-07-06T12:00:00.000Z';

const SERVICE_ROW: AdminServiceRow = {
  id: 1,
  slug: 'strzyzenie',
  name: 'Strzyżenie',
  description: 'Opis usługi',
  duration_minutes: 45,
  price_grosze: 7000,
  active: 0,
  sort_order: 2,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const BARBER_ROW: AdminBarberRow = {
  id: 1,
  slug: 'michal',
  name: 'Michał',
  bio: 'Bio barbera',
  image_path: 'barber-michal.png',
  active: 0,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

function patchRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PATCH',
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

describe('admin services', () => {
  it('lists active and inactive services in admin order', async () => {
    const { database, calls } = createMockD1(() => [SERVICE_ROW]);
    const response = await handleAdminServicesRequest(
      new Request('https://example.invalid/api/admin/services'),
      database,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        services: [
          {
            id: 1,
            slug: 'strzyzenie',
            name: 'Strzyżenie',
            description: 'Opis usługi',
            durationMinutes: 45,
            priceGrosze: 7000,
            active: false,
            sortOrder: 2,
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      },
    });
    expect(calls[0]?.sql).not.toContain('WHERE active = 1');
    expect(calls[0]?.sql).toContain('ORDER BY sort_order, id');
  });

  it('updates only allowed service fields with prepared bindings', async () => {
    const { database, calls } = createMockD1((call) =>
      call.operation === 'first' ? SERVICE_ROW : ({ results: [] } as unknown as D1Result<unknown>),
    );
    const request = patchRequest('https://example.invalid/api/admin/services/1', {
      name: 'Nowa nazwa',
      durationMinutes: 60,
      priceGrosze: 8000,
      active: true,
      sortOrder: 1,
    });
    const response = await handleAdminServiceUpdateRequest(request, database, '1', {
      nowUtc: NOW_UTC,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        service: {
          id: 1,
          name: 'Nowa nazwa',
          description: 'Opis usługi',
          durationMinutes: 60,
          priceGrosze: 8000,
          active: true,
          sortOrder: 1,
          updatedAt: NOW_UTC,
        },
      },
    });
    expect(calls[1]?.sql).toContain('UPDATE services');
    expect(calls[1]?.sql).not.toContain('Nowa nazwa');
    expect(calls[1]?.bindings).toEqual(['Nowa nazwa', 'Opis usługi', 60, 8000, 1, 1, NOW_UTC, 1]);
  });

  it('returns SERVICE_NOT_FOUND for an unknown service', async () => {
    const { database } = createMockD1(() => null);
    const request = patchRequest('https://example.invalid/api/admin/services/999', {
      active: false,
    });
    const response = await throughApi(request, () =>
      handleAdminServiceUpdateRequest(request, database, '999'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'SERVICE_NOT_FOUND' },
    });
  });

  it.each([30.5, 20, 0])('rejects invalid service duration %s', async (durationMinutes) => {
    const { database, calls } = createMockD1(() => SERVICE_ROW);
    const request = patchRequest('https://example.invalid/api/admin/services/1', {
      durationMinutes,
    });
    const response = await throughApi(request, () =>
      handleAdminServiceUpdateRequest(request, database, '1'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(calls).toHaveLength(0);
  });
});

describe('admin barbers', () => {
  it('lists active and inactive barbers', async () => {
    const { database } = createMockD1(() => [BARBER_ROW]);
    const response = await handleAdminBarbersRequest(
      new Request('https://example.invalid/api/admin/barbers'),
      database,
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        barbers: [
          {
            id: 1,
            name: 'Michał',
            imagePath: 'barber-michal.png',
            active: false,
          },
        ],
      },
    });
  });

  it('updates allowed barber fields without changing service links', async () => {
    const { database, calls } = createMockD1((call) =>
      call.operation === 'first' ? BARBER_ROW : ({ results: [] } as unknown as D1Result<unknown>),
    );
    const request = patchRequest('https://example.invalid/api/admin/barbers/1', {
      name: 'Michał K.',
      bio: 'Nowe bio',
      imagePath: 'barber-michal-v2.webp',
      active: true,
    });
    const response = await handleAdminBarberUpdateRequest(request, database, '1', {
      nowUtc: NOW_UTC,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        barber: {
          name: 'Michał K.',
          bio: 'Nowe bio',
          imagePath: 'barber-michal-v2.webp',
          active: true,
        },
      },
    });
    expect(calls[1]?.sql).toContain('UPDATE barbers');
    expect(calls[1]?.sql).not.toContain('barber_services');
    expect(calls[1]?.bindings).toEqual([
      'Michał K.',
      'Nowe bio',
      'barber-michal-v2.webp',
      1,
      NOW_UTC,
      1,
    ]);
  });

  it('returns BARBER_NOT_FOUND for an unknown barber', async () => {
    const { database } = createMockD1(() => null);
    const request = patchRequest('https://example.invalid/api/admin/barbers/999', {
      active: false,
    });
    const response = await throughApi(request, () =>
      handleAdminBarberUpdateRequest(request, database, '999'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'BARBER_NOT_FOUND' },
    });
  });
});
