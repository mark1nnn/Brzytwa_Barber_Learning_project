import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { handleAdminAccessRequest } from '../../functions/api/admin/_middleware';
import { handleServicesRequest } from '../../functions/api/public/services';
import type { ServiceRow } from '../../functions/_shared/types';
import { createMockD1 } from './mock-d1';

function throughApi(request: Request, next: () => Promise<Response>): Promise<Response> {
  return handleApiRequest({
    request,
    next,
    logger: {
      error: vi.fn(),
    },
  });
}

describe('admin Cloudflare Access middleware', () => {
  it('returns 401 ADMIN_UNAUTHORIZED when Access identity headers are absent', async () => {
    const request = new Request('https://example.invalid/api/admin/appointments');
    const next = vi.fn(async () => new Response('should not run'));
    const response = await throughApi(request, () => handleAdminAccessRequest(request, next));
    const responseText = await response.text();

    expect(response.status).toBe(401);
    expect(responseText).toContain('ADMIN_UNAUTHORIZED');
    expect(responseText).not.toContain('@');
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    {
      'Cf-Access-Jwt-Assertion': 'signed-access-jwt',
    },
    {
      'Cf-Access-Authenticated-User-Email': 'admin@example.invalid',
    },
  ])('requires both Access identity headers', async (headers) => {
    const request = new Request('https://example.invalid/api/admin/services', {
      headers,
    });
    const response = await throughApi(request, () =>
      handleAdminAccessRequest(request, async () => new Response('should not run')),
    );

    expect(response.status).toBe(401);
  });

  it('allows the request after Cloudflare Access supplied both headers', async () => {
    const request = new Request('https://example.invalid/api/admin/services', {
      headers: {
        'Cf-Access-Jwt-Assertion': 'signed-access-jwt',
        'Cf-Access-Authenticated-User-Email': 'admin@example.invalid',
      },
    });
    const response = await handleAdminAccessRequest(
      request,
      async () => new Response('admin-ok', { status: 200 }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('admin-ok');
  });

  it('does not apply admin Access checks to public routes', async () => {
    const rows: ServiceRow[] = [
      {
        id: 1,
        slug: 'service',
        name: 'Service',
        description: 'Description',
        duration_minutes: 30,
        price_grosze: 5000,
        sort_order: 1,
      },
    ];
    const { database } = createMockD1(() => rows);
    const request = new Request('https://example.invalid/api/public/services');
    const response = await throughApi(request, () => handleServicesRequest(request, database));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        services: [{ id: 1 }],
      },
    });
  });
});
