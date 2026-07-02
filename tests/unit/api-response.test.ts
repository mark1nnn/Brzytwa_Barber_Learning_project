import { describe, expect, it } from 'vitest';

import { jsonError, jsonSuccess } from '../../functions/_shared/api-response';
import { API_ERROR_CODES } from '../../functions/_shared/types';

describe('API responses', () => {
  it('creates a typed success response with security headers', async () => {
    const response = jsonSuccess({ status: 'ok' }, { status: 201 });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { status: 'ok' },
    });
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('creates an error response without optional field errors', async () => {
    const response = jsonError(
      {
        code: API_ERROR_CODES.INVALID_JSON,
        message: 'Nie udało się odczytać danych JSON.',
      },
      { status: 400 },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Nie udało się odczytać danych JSON.',
      },
    });
  });

  it('includes field errors when provided', async () => {
    const response = jsonError(
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Nie udało się przetworzyć żądania.',
        fieldErrors: {
          customerEmail: 'Podaj prawidłowy adres e-mail.',
        },
      },
      { status: 422 },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        fieldErrors: {
          customerEmail: 'Podaj prawidłowy adres e-mail.',
        },
      },
    });
  });
});
