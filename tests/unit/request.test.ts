import { describe, expect, it } from 'vitest';

import { MAX_JSON_BODY_BYTES } from '../../functions/_shared/constants';
import { ApiError, isApiError } from '../../functions/_shared/errors';
import { assertMethod, readJsonBody } from '../../functions/_shared/request';

function jsonRequest(body: string, headers: HeadersInit = {}): Request {
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  return new Request('https://example.invalid/api/test', {
    method: 'POST',
    headers: requestHeaders,
    body,
  });
}

async function captureApiError(operation: Promise<unknown>): Promise<ApiError> {
  try {
    await operation;
  } catch (error) {
    if (isApiError(error)) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected ApiError.');
}

describe('readJsonBody', () => {
  it.each([
    'application/json',
    'application/json; charset=utf-8',
    'Application/JSON; Charset=UTF-8',
    'application/vnd.api+json',
  ])('accepts %s', async (contentType) => {
    const request = jsonRequest('{"name":"Michał"}', {
      'Content-Type': contentType,
    });

    await expect(readJsonBody(request)).resolves.toEqual({
      name: 'Michał',
    });
  });

  it.each([undefined, 'text/plain', 'multipart/form-data'])(
    'rejects non-JSON content type %s',
    async (contentType) => {
      const headers: HeadersInit | undefined =
        contentType === undefined ? undefined : { 'Content-Type': contentType };
      const request = new Request('https://example.invalid/api/test', {
        method: 'POST',
        headers,
        body: '{}',
      });
      const error = await captureApiError(readJsonBody(request));

      expect(error.code).toBe('INVALID_CONTENT_TYPE');
      expect(error.status).toBe(415);
    },
  );

  it('rejects malformed JSON without exposing the body', async () => {
    const error = await captureApiError(readJsonBody(jsonRequest('{"secret":')));

    expect(error.code).toBe('INVALID_JSON');
    expect(error.message).not.toContain('secret');
  });

  it.each(['', '   '])('rejects an empty body', async (body) => {
    const error = await captureApiError(readJsonBody(jsonRequest(body)));

    expect(error.code).toBe('INVALID_JSON');
  });

  it('rejects a declared oversized body before trusting its content', async () => {
    const error = await captureApiError(
      readJsonBody(
        jsonRequest('{}', {
          'Content-Length': String(MAX_JSON_BODY_BYTES + 1),
        }),
      ),
    );

    expect(error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(error.status).toBe(413);
  });

  it('measures actual UTF-8 bytes despite a false small Content-Length', async () => {
    const body = JSON.stringify({
      value: 'ą'.repeat(MAX_JSON_BODY_BYTES / 2),
    });
    expect(body.length).toBeLessThan(MAX_JSON_BODY_BYTES);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(MAX_JSON_BODY_BYTES);

    const error = await captureApiError(
      readJsonBody(
        jsonRequest(body, {
          'Content-Length': '10',
        }),
      ),
    );

    expect(error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('assertMethod', () => {
  it('accepts an allowed method case-insensitively', () => {
    const request = new Request('https://example.invalid/api/health');
    expect(() => assertMethod(request, ['get'])).not.toThrow();
  });

  it('returns method metadata for a disallowed method', () => {
    const request = new Request('https://example.invalid/api/health', {
      method: 'POST',
    });

    try {
      assertMethod(request, ['GET']);
      throw new Error('Expected assertMethod to throw.');
    } catch (error) {
      expect(isApiError(error)).toBe(true);

      if (!isApiError(error)) {
        return;
      }

      expect(error.code).toBe('METHOD_NOT_ALLOWED');
      expect(error.status).toBe(405);
      expect(error.headers.get('Allow')).toBe('GET');
    }
  });
});
