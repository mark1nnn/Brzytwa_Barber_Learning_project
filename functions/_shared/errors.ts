import type { ApiErrorCode, ApiFieldErrors } from './types';

interface ApiErrorOptions {
  code: ApiErrorCode;
  status: number;
  message: string;
  fieldErrors?: ApiFieldErrors;
  cause?: unknown;
  headers?: HeadersInit;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors: ApiFieldErrors | undefined;
  readonly headers: Headers;

  constructor(options: ApiErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.fieldErrors = options.fieldErrors;
    this.headers = new Headers(options.headers);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
