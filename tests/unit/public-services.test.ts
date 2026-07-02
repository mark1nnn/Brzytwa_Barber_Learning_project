import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { handleServicesRequest } from '../../functions/api/public/services';
import type { ServiceRow } from '../../functions/_shared/types';
import { createMockD1 } from './mock-d1';

const SERVICE_ROWS: ServiceRow[] = [
  {
    id: 1,
    slug: 'strzyzenie-meskie',
    name: 'Strzyżenie męskie',
    description: 'Precyzyjne cięcie.',
    duration_minutes: 45,
    price_grosze: 7000,
    sort_order: 1,
  },
  {
    id: 2,
    slug: 'strzyzenie-brody',
    name: 'Strzyżenie brody',
    description: 'Konturowanie brody.',
    duration_minutes: 30,
    price_grosze: 5000,
    sort_order: 2,
  },
];

async function requestThroughMiddleware(request: Request, database: D1Database) {
  return handleApiRequest({
    request,
    next: () => handleServicesRequest(request, database),
    logger: {
      error: vi.fn(),
    },
  });
}

describe('GET /api/public/services', () => {
  it('queries active services in stable order and maps database rows to the public response', async () => {
    const { database, calls } = createMockD1(() => SERVICE_ROWS);
    const response = await handleServicesRequest(
      new Request('https://example.invalid/api/public/services'),
      database,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        services: [
          {
            id: 1,
            slug: 'strzyzenie-meskie',
            name: 'Strzyżenie męskie',
            description: 'Precyzyjne cięcie.',
            durationMinutes: 45,
            priceGrosze: 7000,
          },
          {
            id: 2,
            slug: 'strzyzenie-brody',
            name: 'Strzyżenie brody',
            description: 'Konturowanie brody.',
            durationMinutes: 30,
            priceGrosze: 5000,
          },
        ],
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toMatch(/WHERE active = 1/);
    expect(calls[0]?.sql).toMatch(/ORDER BY sort_order, id/);
    expect(calls[0]?.sql).toContain('sort_order');
  });

  it('returns 405 with Allow: GET for POST', async () => {
    const { database, calls } = createMockD1(() => {
      throw new Error('The database must not be queried.');
    });
    const request = new Request('https://example.invalid/api/public/services', {
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

  it('hides D1 details behind the middleware INTERNAL_ERROR response', async () => {
    const logger = {
      error: vi.fn(),
    };
    const { database } = createMockD1(() => {
      throw new Error('SQLITE_ERROR: sensitive SELECT detail');
    });
    const request = new Request('https://example.invalid/api/public/services');
    const response = await handleApiRequest({
      request,
      next: () => handleServicesRequest(request, database),
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
