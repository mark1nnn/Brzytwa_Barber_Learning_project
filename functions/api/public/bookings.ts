import { checkAvailabilityStart, type AvailabilityStartStatus } from '../../_shared/availability';
import {
  classifyBookingWriteError,
  prepareBooking,
  type PreparedBooking,
} from '../../_shared/booking';
import { jsonSuccess } from '../../_shared/api-response';
import { MAX_BOOKING_CODE_ATTEMPTS } from '../../_shared/constants';
import { getAllRows, getFirstRow, runBatchStatements, runStatement } from '../../_shared/database';
import { sendBookingEmails } from '../../_shared/email';
import { buildAdminBookingEmail, buildCustomerBookingEmail } from '../../_shared/email-templates';
import { ApiError } from '../../_shared/errors';
import { generateBookingCode, generateUuid } from '../../_shared/ids';
import { assertMethod, readJsonBody } from '../../_shared/request';
import { getWarsawIsoWeekday, getWarsawLocalIsoDate, localDateTimeToUtc } from '../../_shared/time';
import { verifyTurnstile } from '../../_shared/turnstile';
import {
  API_ERROR_CODES,
  type AppointmentSlotRow,
  type BarberServiceLinkRow,
  type BlockedPeriodRow,
  type BookingBarberRow,
  type BookingResponse,
  type BookingServiceRow,
  type WorkingHoursRow,
} from '../../_shared/types';
import {
  bookingRequestSchema,
  type BookingRequest,
  zodIssuesToFieldErrors,
} from '../../_shared/validation';

const ACTIVE_SERVICE_QUERY = `
  SELECT id, name, duration_minutes, price_grosze
  FROM services
  WHERE id = ?
    AND active = 1
`;

const ACTIVE_BARBER_QUERY = `
  SELECT id, name
  FROM barbers
  WHERE id = ?
    AND active = 1
`;

const BARBER_SERVICE_QUERY = `
  SELECT 1 AS linked
  FROM barber_services
  WHERE barber_id = ?
    AND service_id = ?
`;

const WORKING_HOURS_QUERY = `
  SELECT start_time, end_time
  FROM working_hours
  WHERE barber_id = ?
    AND weekday = ?
    AND active = 1
`;

const BLOCKED_PERIODS_QUERY = `
  SELECT starts_at_utc, ends_at_utc
  FROM blocked_periods
  WHERE barber_id = ?
    AND starts_at_utc < ?
    AND ends_at_utc > ?
  ORDER BY starts_at_utc
`;

const APPOINTMENT_SLOTS_QUERY = `
  SELECT slot_start_utc
  FROM appointment_slots
  WHERE barber_id = ?
    AND slot_start_utc >= ?
    AND slot_start_utc < ?
  ORDER BY slot_start_utc
`;

const INSERT_APPOINTMENT_QUERY = `
  INSERT INTO appointments (
    id,
    booking_code,
    barber_id,
    service_id,
    customer_name,
    customer_phone,
    customer_email,
    customer_notes,
    starts_at_utc,
    ends_at_utc,
    status,
    privacy_notice_accepted_at,
    customer_email_status,
    admin_email_status,
    email_error
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 'pending', 'pending', NULL)
`;

const INSERT_APPOINTMENT_SLOT_QUERY = `
  INSERT INTO appointment_slots (
    appointment_id,
    barber_id,
    slot_start_utc
  )
  VALUES (?, ?, ?)
`;

const UPDATE_EMAIL_STATUS_QUERY = `
  UPDATE appointments
  SET
    customer_email_status = ?,
    admin_email_status = ?,
    email_error = ?,
    updated_at = ?
  WHERE id = ?
`;

interface BookingRuntime {
  nowUtc?: string;
  uuidGenerator?: () => string;
  bookingCodeGenerator?: () => string;
  fetcher?: typeof fetch | undefined;
  turnstileTimeoutMs?: number | undefined;
  resendTimeoutMs?: number | undefined;
}

function parseBookingRequest(body: unknown): BookingRequest {
  const result = bookingRequestSchema.safeParse(body);

  if (!result.success) {
    throw new ApiError({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      status: 400,
      message: 'Nie udało się przetworzyć żądania.',
      fieldErrors: zodIssuesToFieldErrors(result.error.issues),
    });
  }

  return result.data;
}

async function getActiveService(
  database: D1Database,
  serviceId: number,
): Promise<BookingServiceRow> {
  const service = await getFirstRow<BookingServiceRow>(
    database.prepare(ACTIVE_SERVICE_QUERY).bind(serviceId),
  );

  if (service === null) {
    throw new ApiError({
      code: API_ERROR_CODES.SERVICE_NOT_FOUND,
      status: 404,
      message: 'Wybrana usługa nie istnieje lub jest niedostępna.',
    });
  }

  return service;
}

async function getActiveBarber(database: D1Database, barberId: number): Promise<BookingBarberRow> {
  const barber = await getFirstRow<BookingBarberRow>(
    database.prepare(ACTIVE_BARBER_QUERY).bind(barberId),
  );

  if (barber === null) {
    throw new ApiError({
      code: API_ERROR_CODES.BARBER_NOT_FOUND,
      status: 404,
      message: 'Wybrany barber nie istnieje lub jest niedostępny.',
    });
  }

  return barber;
}

async function assertBarberService(
  database: D1Database,
  barberId: number,
  serviceId: number,
): Promise<void> {
  const link = await getFirstRow<BarberServiceLinkRow>(
    database.prepare(BARBER_SERVICE_QUERY).bind(barberId, serviceId),
  );

  if (link === null) {
    throw new ApiError({
      code: API_ERROR_CODES.BARBER_SERVICE_UNAVAILABLE,
      status: 400,
      message: 'Wybrany barber nie wykonuje tej usługi.',
    });
  }
}

function availabilityError(status: Exclude<AvailabilityStartStatus, 'available'>): ApiError {
  const errors: Record<
    Exclude<AvailabilityStartStatus, 'available'>,
    {
      code: (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
      status: number;
      message: string;
    }
  > = {
    'invalid-date': {
      code: API_ERROR_CODES.INVALID_DATE,
      status: 400,
      message: 'Nie można zarezerwować terminu w przeszłości.',
    },
    'too-early': {
      code: API_ERROR_CODES.BOOKING_TOO_EARLY,
      status: 400,
      message: 'Termin nie spełnia minimalnego czasu wyprzedzenia rezerwacji.',
    },
    'too-far': {
      code: API_ERROR_CODES.BOOKING_TOO_FAR,
      status: 400,
      message: 'Wybrana data wykracza poza dostępny okres rezerwacji.',
    },
    'outside-working-hours': {
      code: API_ERROR_CODES.OUTSIDE_WORKING_HOURS,
      status: 400,
      message: 'Wybrany termin znajduje się poza godzinami pracy.',
    },
    'blocked-period': {
      code: API_ERROR_CODES.BLOCKED_PERIOD,
      status: 400,
      message: 'Wybrany termin jest zablokowany.',
    },
    'slot-taken': {
      code: API_ERROR_CODES.SLOT_TAKEN,
      status: 409,
      message: 'Wybrany termin jest już zajęty.',
    },
  };
  const error = errors[status];

  return new ApiError(error);
}

function createBookingStatements(
  database: D1Database,
  booking: PreparedBooking,
): D1PreparedStatement[] {
  const appointmentStatement = database
    .prepare(INSERT_APPOINTMENT_QUERY)
    .bind(
      booking.id,
      booking.bookingCode,
      booking.barberId,
      booking.serviceId,
      booking.customerName,
      booking.customerPhone,
      booking.customerEmail,
      booking.customerNotes,
      booking.startsAt,
      booking.endsAt,
      booking.privacyNoticeAcceptedAt,
    );
  const slotStatements = booking.slotStarts.map((slotStart) =>
    database.prepare(INSERT_APPOINTMENT_SLOT_QUERY).bind(booking.id, booking.barberId, slotStart),
  );

  return [appointmentStatement, ...slotStatements];
}

async function persistBookingWithRetry(
  database: D1Database,
  request: BookingRequest,
  service: BookingServiceRow,
  barber: BookingBarberRow,
  nowUtc: string,
  id: string,
  bookingCodeGenerator: () => string,
): Promise<PreparedBooking> {
  let lastBookingCodeError: unknown;

  for (let attempt = 0; attempt < MAX_BOOKING_CODE_ATTEMPTS; attempt += 1) {
    const booking = prepareBooking({
      id,
      bookingCode: bookingCodeGenerator(),
      request,
      serviceName: service.name,
      barberName: barber.name,
      durationMinutes: service.duration_minutes,
      priceGrosze: service.price_grosze,
      acceptedAt: nowUtc,
    });

    try {
      await runBatchStatements(database, createBookingStatements(database, booking));
      return booking;
    } catch (error) {
      const conflict = classifyBookingWriteError(error);

      if (conflict === 'slot') {
        throw new ApiError({
          code: API_ERROR_CODES.SLOT_TAKEN,
          status: 409,
          message: 'Wybrany termin jest już zajęty.',
          cause: error,
        });
      }

      if (conflict === 'booking-code') {
        lastBookingCodeError = error;
        continue;
      }

      throw error;
    }
  }

  throw new ApiError({
    code: API_ERROR_CODES.INTERNAL_ERROR,
    status: 500,
    message: 'Nie udało się utworzyć rezerwacji. Spróbuj ponownie później.',
    cause: lastBookingCodeError,
  });
}

export async function handleBookingsRequest(
  request: Request,
  environment: Env,
  runtime: BookingRuntime = {},
): Promise<Response> {
  assertMethod(request, ['POST']);

  const body = await readJsonBody(request);
  const bookingRequest = parseBookingRequest(body);
  const turnstileStatus = await verifyTurnstile({
    secretKey: environment.TURNSTILE_SECRET_KEY,
    siteKey: environment.PUBLIC_TURNSTILE_SITE_KEY,
    token: bookingRequest.turnstileToken,
    remoteIp: request.headers.get('CF-Connecting-IP') ?? undefined,
    fetcher: runtime.fetcher,
    timeoutMs: runtime.turnstileTimeoutMs,
  });

  if (turnstileStatus === 'failed') {
    throw new ApiError({
      code: API_ERROR_CODES.TURNSTILE_FAILED,
      status: 400,
      message: 'Nie udało się potwierdzić zabezpieczenia formularza.',
    });
  }

  if (turnstileStatus === 'unavailable') {
    throw new ApiError({
      code: API_ERROR_CODES.TURNSTILE_UNAVAILABLE,
      status: 503,
      message: 'Weryfikacja formularza jest chwilowo niedostępna.',
    });
  }

  const database = environment.DB;
  const nowUtc = runtime.nowUtc ?? new Date().toISOString();
  const service = await getActiveService(database, bookingRequest.serviceId);
  const barber = await getActiveBarber(database, bookingRequest.barberId);
  await assertBarberService(database, bookingRequest.barberId, bookingRequest.serviceId);

  const localDate = getWarsawLocalIsoDate(bookingRequest.startsAt);
  const weekday = getWarsawIsoWeekday(bookingRequest.startsAt);
  const workingHours = await getFirstRow<WorkingHoursRow>(
    database.prepare(WORKING_HOURS_QUERY).bind(bookingRequest.barberId, weekday),
  );
  let blockedPeriods: BlockedPeriodRow[] = [];
  let appointmentSlots: AppointmentSlotRow[] = [];

  if (workingHours !== null) {
    const workingDayStart = localDateTimeToUtc(localDate, workingHours.start_time);
    const workingDayEnd = localDateTimeToUtc(localDate, workingHours.end_time);
    blockedPeriods = await getAllRows<BlockedPeriodRow>(
      database
        .prepare(BLOCKED_PERIODS_QUERY)
        .bind(bookingRequest.barberId, workingDayEnd, workingDayStart),
    );
    appointmentSlots = await getAllRows<AppointmentSlotRow>(
      database
        .prepare(APPOINTMENT_SLOTS_QUERY)
        .bind(bookingRequest.barberId, workingDayStart, workingDayEnd),
    );
  }

  const availabilityStatus = checkAvailabilityStart({
    date: localDate,
    startsAt: bookingRequest.startsAt,
    durationMinutes: service.duration_minutes,
    workingHours:
      workingHours === null
        ? null
        : {
            startTime: workingHours.start_time,
            endTime: workingHours.end_time,
          },
    blockedPeriods: blockedPeriods.map((period) => ({
      startsAt: period.starts_at_utc,
      endsAt: period.ends_at_utc,
    })),
    occupiedSlotStarts: appointmentSlots.map((slot) => slot.slot_start_utc),
    nowUtc,
  });

  if (availabilityStatus !== 'available') {
    throw availabilityError(availabilityStatus);
  }

  const booking = await persistBookingWithRetry(
    database,
    bookingRequest,
    service,
    barber,
    nowUtc,
    (runtime.uuidGenerator ?? generateUuid)(),
    runtime.bookingCodeGenerator ?? generateBookingCode,
  );
  const emailTemplateInput = {
    booking: booking.response,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail,
    customerNotes: booking.customerNotes,
  };
  const emailStatus = await sendBookingEmails({
    environment,
    customerEmail: booking.customerEmail,
    customerContent: buildCustomerBookingEmail(emailTemplateInput),
    adminContent: buildAdminBookingEmail(emailTemplateInput),
    fetcher: runtime.fetcher,
    timeoutMs: runtime.resendTimeoutMs,
  });

  try {
    await runStatement(
      database
        .prepare(UPDATE_EMAIL_STATUS_QUERY)
        .bind(emailStatus.customer, emailStatus.admin, emailStatus.error, nowUtc, booking.id),
    );
  } catch {
    console.error('Booking email status update failed', {
      bookingId: booking.id,
    });
  }

  const data: BookingResponse = {
    booking: booking.response,
    emailStatus: {
      customer: emailStatus.customer,
      admin: emailStatus.admin,
    },
  };

  return jsonSuccess(data, { status: 201 });
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleBookingsRequest(request, env);
