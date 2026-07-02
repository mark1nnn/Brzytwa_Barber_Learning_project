import type { ApiErrorCode, ApiFailure, ApiFieldErrors, ApiSuccess } from './types';

export const API_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
} as const;

function createJsonHeaders(source?: HeadersInit): Headers {
  const headers = new Headers(source);

  for (const [name, value] of Object.entries(API_RESPONSE_HEADERS)) {
    headers.set(name, value);
  }

  return headers;
}

export function jsonSuccess<T>(data: T, init: ResponseInit = {}): Response {
  const body: ApiSuccess<T> = {
    success: true,
    data,
  };

  return new Response(JSON.stringify(body), {
    ...init,
    headers: createJsonHeaders(init.headers),
  });
}

interface JsonErrorOptions {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: ApiFieldErrors;
}

export function jsonError(error: JsonErrorOptions, init: ResponseInit = {}): Response {
  const errorPayload: ApiFailure['error'] = {
    code: error.code,
    message: error.message,
    ...(error.fieldErrors === undefined ? {} : { fieldErrors: error.fieldErrors }),
  };
  const body: ApiFailure = {
    success: false,
    error: errorPayload,
  };

  return new Response(JSON.stringify(body), {
    ...init,
    headers: createJsonHeaders(init.headers),
  });
}
