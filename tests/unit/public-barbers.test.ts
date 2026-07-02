import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { handleBarbersRequest } from '../../functions/api/public/barbers';
import type { BarberServiceRow } from '../../functions/_shared/types';
import { createMockD1 } from './mock-d1';

const BARBER_ROWS: BarberServiceRow[] = [
  {
    barber_id: 1,
    barber_slug: 'michal',
    barber_name: 'Michał',
    barber_bio: 'Klasyczne formy.',
    barber_image_path: 'barber-michal.png',
    service_id: 1,
    service_slug: 'strzyzenie-meskie',
    service_name: 'Strzyżenie męskie',
    service_duration_minutes: 45,
    service_price_grosze: 7000,
  },
  {
    barber_id: 1,
    barber_slug: 'michal',
    barber_name: 'Michał',
    barber_bio: 'Klasyczne formy.',
    barber_image_path: 'barber-michal.png',
    service_id: 2,
    service_slug: 'strzyzenie-brody',
    service_name: 'Strzyżenie brody',
    service_duration_minutes: 30,
    service_price_grosze: 5000,
  },
  {
    barber_id: 2,
    barber_slug: 'kamil',
    barber_name: 'Kamil',
    barber_bio: 'Współczesne tekstury.',
    barber_image_path: 'barber-kamil.png',
    service_id: 1,
    service_slug: 'strzyzenie-meskie',
    service_name: 'Strzyżenie męskie',
    service_duration_minutes: 45,
    service_price_grosze: 7000,
  },
];

async function requestThroughMiddleware(request: Request, database: D1Database) {
  return handleApiRequest({
    request,
    next: () => handleBarbersRequest(request, database),
    logger: {
      error: vi.fn(),
    },
  });
}

describe('GET /api/public/barbers', () => {
  it('returns active barbers with active services grouped without duplicate barbers', async () => {
    const { database, calls } = createMockD1(() => BARBER_ROWS);
    const response = await handleBarbersRequest(
      new Request('https://example.invalid/api/public/barbers'),
      database,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      data: {
        barbers: [
          {
            id: 1,
            slug: 'michal',
            name: 'Michał',
            bio: 'Klasyczne formy.',
            imagePath: 'barber-michal.png',
            services: [
              {
                id: 1,
                slug: 'strzyzenie-meskie',
                name: 'Strzyżenie męskie',
                durationMinutes: 45,
                priceGrosze: 7000,
              },
              {
                id: 2,
                slug: 'strzyzenie-brody',
                name: 'Strzyżenie brody',
                durationMinutes: 30,
                priceGrosze: 5000,
              },
            ],
          },
          {
            id: 2,
            slug: 'kamil',
            name: 'Kamil',
            bio: 'Współczesne tekstury.',
            imagePath: 'barber-kamil.png',
            services: [
              {
                id: 1,
                slug: 'strzyzenie-meskie',
                name: 'Strzyżenie męskie',
                durationMinutes: 45,
                priceGrosze: 7000,
              },
            ],
          },
        ],
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toMatch(/b\.active = 1/);
    expect(calls[0]?.sql).toMatch(/s\.active = 1/);
    expect(calls[0]?.sql).toMatch(/ORDER BY b\.id, s\.sort_order, s\.id/);
  });

  it('checks and binds serviceId, then returns only matching barbers with their active services', async () => {
    const { database, calls } = createMockD1((call) => {
      if (call.operation === 'first') {
        return { id: 2 };
      }

      return BARBER_ROWS.slice(0, 2);
    });
    const response = await handleBarbersRequest(
      new Request('https://example.invalid/api/public/barbers?serviceId=2'),
      database,
    );
    const payload = (await response.json()) as {
      data: {
        barbers: unknown[];
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.barbers).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      operation: 'first',
      bindings: [2],
    });
    expect(calls[0]?.sql).toMatch(/WHERE id = \?/);
    expect(calls[0]?.sql).toMatch(/active = 1/);
    expect(calls[1]).toMatchObject({
      operation: 'all',
      bindings: [2],
    });
    expect(calls[1]?.sql).toMatch(/filtered_bs\.service_id = \?/);
    expect(calls[1]?.sql).not.toMatch(/filtered_bs\.service_id = 2/);
  });

  it.each(['abc', '0', '-1', '1.5', ''])(
    'returns 400 VALIDATION_ERROR for invalid serviceId=%s',
    async (serviceId) => {
      const { database, calls } = createMockD1(() => {
        throw new Error('The database must not be queried.');
      });
      const request = new Request(
        `https://example.invalid/api/public/barbers?serviceId=${serviceId}`,
      );
      const response = await requestThroughMiddleware(request, database);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          fieldErrors: {
            serviceId: 'Identyfikator musi być dodatnią liczbą całkowitą.',
          },
        },
      });
      expect(calls).toHaveLength(0);
    },
  );

  it('returns 404 SERVICE_NOT_FOUND for a missing or inactive service', async () => {
    const { database, calls } = createMockD1(() => null);
    const request = new Request('https://example.invalid/api/public/barbers?serviceId=99999');
    const response = await requestThroughMiddleware(request, database);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'SERVICE_NOT_FOUND',
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.bindings).toEqual([99999]);
  });

  it('returns 405 with Allow: GET for POST', async () => {
    const { database, calls } = createMockD1(() => {
      throw new Error('The database must not be queried.');
    });
    const request = new Request('https://example.invalid/api/public/barbers', {
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
});
