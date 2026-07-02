export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INVALID_TURNSTILE: 'INVALID_TURNSTILE',
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  BARBER_NOT_FOUND: 'BARBER_NOT_FOUND',
  BARBER_SERVICE_UNAVAILABLE: 'BARBER_SERVICE_UNAVAILABLE',
  INVALID_DATE: 'INVALID_DATE',
  OUTSIDE_WORKING_HOURS: 'OUTSIDE_WORKING_HOURS',
  BLOCKED_PERIOD: 'BLOCKED_PERIOD',
  SLOT_TAKEN: 'SLOT_TAKEN',
  BOOKING_TOO_EARLY: 'BOOKING_TOO_EARLY',
  BOOKING_TOO_FAR: 'BOOKING_TOO_FAR',
  APPOINTMENT_NOT_FOUND: 'APPOINTMENT_NOT_FOUND',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
export type ApiFieldErrors = Record<string, string>;

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: ApiFieldErrors;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface HealthRow {
  ok: number;
}

export interface HealthResponse {
  status: 'ok';
  database: 'ok';
  timezone: 'Europe/Warsaw';
  timestamp: string;
}
