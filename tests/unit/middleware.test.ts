import { describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../functions/api/_middleware';
import { ApiError } from '../../functions/_shared/errors';
import { API_ERROR_CODES } from '../../functions/_shared/types';

describe('API middleware', () => {
  it('preserves the downstream response and adds API headers', async () => {
    const response = await handleApiRequest({
      request: new Request('https://example.invalid/api/health', {
        headers: {
          'CF-Ray': 'test-ray',
        },
      }),
      next: async () =>
        new Response('payload', {
          status: 201,
          headers: {
            'Content-Type': 'text/plain',
            'X-Custom': 'preserved',
          },
        }),
    });

    expect(response.status).toBe(201);
    await expect(response.text()).resolves.toBe('payload');
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(response.headers.get('X-Custom')).toBe('preserved');
    expect(response.headers.get('X-Request-Id')).toBe('test-ray');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('serializes ApiError and preserves the Allow header', async () => {
    const logger = {
      error: vi.fn(),
    };
    const response = await handleApiRequest({
      request: new Request('https://example.invalid/api/health', {
        method: 'POST',
      }),
      next: async () => {
        throw new ApiError({
          code: API_ERROR_CODES.METHOD_NOT_ALLOWED,
          status: 405,
          message: 'Ta metoda HTTP nie jest obsługiwana.',
          headers: {
            Allow: 'GET',
          },
          cause: new Error('internal SQL detail'),
        });
      },
      logger,
    });
    const responseText = await response.text();

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.parse(responseText)).toMatchObject({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
      },
    });
    expect(responseText).not.toContain('internal SQL detail');
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('logs unknown errors but returns only a safe 500 response', async () => {
    const logger = {
      error: vi.fn(),
    };
    const response = await handleApiRequest({
      request: new Request('https://example.invalid/api/health', {
        headers: {
          'CF-Ray': 'unknown-error-ray',
        },
      }),
      next: async () => {
        throw new Error('sensitive internal database detail');
      },
      logger,
    });
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get('X-Request-Id')).toBe('unknown-error-ray');
    expect(responseText).toContain('INTERNAL_ERROR');
    expect(responseText).not.toContain('sensitive internal database detail');
    expect(responseText).not.toContain('stack');
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      'Unhandled API error',
      expect.objectContaining({
        requestId: 'unknown-error-ray',
        method: 'GET',
        pathname: '/api/health',
      }),
    );
  });
});
