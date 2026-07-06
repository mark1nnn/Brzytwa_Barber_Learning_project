export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INVALID_TURNSTILE: 'INVALID_TURNSTILE',
  TURNSTILE_FAILED: 'TURNSTILE_FAILED',
  TURNSTILE_UNAVAILABLE: 'TURNSTILE_UNAVAILABLE',
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
  ADMIN_UNAUTHORIZED: 'ADMIN_UNAUTHORIZED',
  ADMIN_FORBIDDEN: 'ADMIN_FORBIDDEN',
  WORKING_HOURS_NOT_FOUND: 'WORKING_HOURS_NOT_FOUND',
  BLOCKED_PERIOD_NOT_FOUND: 'BLOCKED_PERIOD_NOT_FOUND',
  INVALID_STATUS: 'INVALID_STATUS',
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

export interface ServiceRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_grosze: number;
  sort_order: number;
}

export interface PublicService {
  id: number;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceGrosze: number;
}

export interface ServicesResponse {
  services: PublicService[];
}

export interface ActiveServiceRow {
  id: number;
}

export interface BarberServiceRow {
  barber_id: number;
  barber_slug: string;
  barber_name: string;
  barber_bio: string;
  barber_image_path: string;
  service_id: number;
  service_slug: string;
  service_name: string;
  service_duration_minutes: number;
  service_price_grosze: number;
}

export interface PublicBarberService {
  id: number;
  slug: string;
  name: string;
  durationMinutes: number;
  priceGrosze: number;
}

export interface PublicBarber {
  id: number;
  slug: string;
  name: string;
  bio: string;
  imagePath: string;
  services: PublicBarberService[];
}

export interface BarbersResponse {
  barbers: PublicBarber[];
}

export interface AvailabilityServiceRow {
  id: number;
  duration_minutes: number;
}

export interface ActiveBarberRow {
  id: number;
}

export interface BarberServiceLinkRow {
  linked: number;
}

export interface WorkingHoursRow {
  start_time: string;
  end_time: string;
}

export interface BlockedPeriodRow {
  starts_at_utc: string;
  ends_at_utc: string;
}

export interface AppointmentSlotRow {
  slot_start_utc: string;
}

export interface AvailabilitySlot {
  startsAt: string;
  localTime: string;
}

export interface AvailabilityResponse {
  date: string;
  timezone: 'Europe/Warsaw';
  slots: AvailabilitySlot[];
}

export interface BookingServiceRow {
  id: number;
  name: string;
  duration_minutes: number;
  price_grosze: number;
}

export interface BookingBarberRow {
  id: number;
  name: string;
}

export interface BookingDetails {
  bookingCode: string;
  serviceName: string;
  barberName: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localTime: string;
  durationMinutes: number;
  priceGrosze: number;
}

export interface BookingResponse {
  booking: BookingDetails;
  emailStatus: {
    customer: EmailDeliveryStatus;
    admin: EmailDeliveryStatus;
  };
}

export type EmailDeliveryStatus = 'sent' | 'failed';
