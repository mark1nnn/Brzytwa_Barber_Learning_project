import { z } from 'zod';

import { generateAvailabilitySlots, getBookingDateStatus } from '../../_shared/availability';
import { jsonSuccess } from '../../_shared/api-response';
import { APP_TIMEZONE } from '../../_shared/constants';
import { getAllRows, getFirstRow } from '../../_shared/database';
import { ApiError } from '../../_shared/errors';
import { assertMethod } from '../../_shared/request';
import { getWarsawIsoWeekday, localDateTimeToUtc } from '../../_shared/time';
import {
  API_ERROR_CODES,
  type ActiveBarberRow,
  type AppointmentSlotRow,
  type AvailabilityResponse,
  type AvailabilityServiceRow,
  type BarberServiceLinkRow,
  type BlockedPeriodRow,
  type WorkingHoursRow,
} from '../../_shared/types';
import {
  localDateSchema,
  positiveIntegerIdSchema,
  zodIssuesToFieldErrors,
} from '../../_shared/validation';

const AVAILABILITY_QUERY_SCHEMA = z.object({
  serviceId: positiveIntegerIdSchema,
  barberId: positiveIntegerIdSchema,
  date: z.string(),
});

const ACTIVE_SERVICE_QUERY = `
  SELECT id, duration_minutes
  FROM services
  WHERE id = ?
    AND active = 1
`;

const ACTIVE_BARBER_QUERY = `
  SELECT id
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

interface AvailabilityQuery {
  serviceId: number;
  barberId: number;
  date: string;
}

function parseAvailabilityQuery(request: Request): AvailabilityQuery {
  const searchParams = new URL(request.url).searchParams;
  const result = AVAILABILITY_QUERY_SCHEMA.safeParse({
    serviceId: searchParams.get('serviceId'),
    barberId: searchParams.get('barberId'),
    date: searchParams.get('date'),
  });

  if (!result.success) {
    throw new ApiError({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      status: 400,
      message: 'Nie udało się przetworzyć żądania.',
      fieldErrors: zodIssuesToFieldErrors(result.error.issues),
    });
  }

  const dateResult = localDateSchema.safeParse(result.data.date);

  if (!dateResult.success) {
    throw new ApiError({
      code: API_ERROR_CODES.INVALID_DATE,
      status: 400,
      message: 'Podaj prawidłową datę.',
      fieldErrors: {
        date: dateResult.error.issues[0]?.message ?? 'Podaj prawidłową datę.',
      },
    });
  }

  return {
    serviceId: result.data.serviceId,
    barberId: result.data.barberId,
    date: dateResult.data,
  };
}

function assertBookableDate(date: string, nowUtc: string): void {
  const status = getBookingDateStatus(date, nowUtc);

  if (status === 'past') {
    throw new ApiError({
      code: API_ERROR_CODES.INVALID_DATE,
      status: 400,
      message: 'Nie można sprawdzić dostępności dla minionej daty.',
    });
  }

  if (status === 'too-far') {
    throw new ApiError({
      code: API_ERROR_CODES.BOOKING_TOO_FAR,
      status: 400,
      message: 'Wybrana data wykracza poza dostępny okres rezerwacji.',
    });
  }
}

async function getActiveService(
  database: D1Database,
  serviceId: number,
): Promise<AvailabilityServiceRow> {
  const service = await getFirstRow<AvailabilityServiceRow>(
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

async function assertActiveBarber(database: D1Database, barberId: number): Promise<void> {
  const barber = await getFirstRow<ActiveBarberRow>(
    database.prepare(ACTIVE_BARBER_QUERY).bind(barberId),
  );

  if (barber === null) {
    throw new ApiError({
      code: API_ERROR_CODES.BARBER_NOT_FOUND,
      status: 404,
      message: 'Wybrany barber nie istnieje lub jest niedostępny.',
    });
  }
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

export async function handleAvailabilityRequest(
  request: Request,
  database: D1Database,
  nowUtc = new Date().toISOString(),
): Promise<Response> {
  assertMethod(request, ['GET']);

  const query = parseAvailabilityQuery(request);
  assertBookableDate(query.date, nowUtc);

  const service = await getActiveService(database, query.serviceId);
  await assertActiveBarber(database, query.barberId);
  await assertBarberService(database, query.barberId, query.serviceId);

  const localNoonUtc = localDateTimeToUtc(query.date, '12:00');
  const weekday = getWarsawIsoWeekday(localNoonUtc);
  const workingHours = await getFirstRow<WorkingHoursRow>(
    database.prepare(WORKING_HOURS_QUERY).bind(query.barberId, weekday),
  );

  if (workingHours === null) {
    const data: AvailabilityResponse = {
      date: query.date,
      timezone: APP_TIMEZONE,
      slots: [],
    };

    return jsonSuccess(data);
  }

  const workingDayStart = localDateTimeToUtc(query.date, workingHours.start_time);
  const workingDayEnd = localDateTimeToUtc(query.date, workingHours.end_time);
  const blockedPeriods = await getAllRows<BlockedPeriodRow>(
    database.prepare(BLOCKED_PERIODS_QUERY).bind(query.barberId, workingDayEnd, workingDayStart),
  );
  const appointmentSlots = await getAllRows<AppointmentSlotRow>(
    database.prepare(APPOINTMENT_SLOTS_QUERY).bind(query.barberId, workingDayStart, workingDayEnd),
  );
  const data: AvailabilityResponse = {
    date: query.date,
    timezone: APP_TIMEZONE,
    slots: generateAvailabilitySlots({
      date: query.date,
      durationMinutes: service.duration_minutes,
      workingHours: {
        startTime: workingHours.start_time,
        endTime: workingHours.end_time,
      },
      blockedPeriods: blockedPeriods.map((period) => ({
        startsAt: period.starts_at_utc,
        endsAt: period.ends_at_utc,
      })),
      occupiedSlotStarts: appointmentSlots.map((slot) => slot.slot_start_utc),
      nowUtc,
    }),
  };

  return jsonSuccess(data);
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleAvailabilityRequest(request, env.DB);
