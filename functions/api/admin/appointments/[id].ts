import {
  getRouteParam,
  parseUuidRouteId,
  toAdminAppointment,
  type AdminAppointmentRow,
} from '../../../_shared/admin';
import { jsonSuccess } from '../../../_shared/api-response';
import { getAllRows, getFirstRow } from '../../../_shared/database';
import { ApiError } from '../../../_shared/errors';
import { assertMethod } from '../../../_shared/request';
import { API_ERROR_CODES, type AppointmentSlotRow } from '../../../_shared/types';

const APPOINTMENT_DETAIL_QUERY = `
  SELECT
    a.id,
    a.booking_code,
    a.barber_id,
    b.name AS barber_name,
    a.service_id,
    s.name AS service_name,
    a.customer_name,
    a.customer_phone,
    a.customer_email,
    a.customer_notes,
    a.starts_at_utc,
    a.ends_at_utc,
    a.status,
    a.privacy_notice_accepted_at,
    a.customer_email_status,
    a.admin_email_status,
    a.email_error,
    a.created_at,
    a.updated_at
  FROM appointments a
  JOIN barbers b ON b.id = a.barber_id
  JOIN services s ON s.id = a.service_id
  WHERE a.id = ?
`;

const APPOINTMENT_SLOTS_QUERY = `
  SELECT slot_start_utc
  FROM appointment_slots
  WHERE appointment_id = ?
  ORDER BY slot_start_utc
`;

export async function handleAdminAppointmentDetailRequest(
  request: Request,
  database: D1Database,
  rawId: string,
): Promise<Response> {
  assertMethod(request, ['GET']);
  const id = parseUuidRouteId(rawId);
  const row = await getFirstRow<AdminAppointmentRow>(
    database.prepare(APPOINTMENT_DETAIL_QUERY).bind(id),
  );

  if (row === null) {
    throw new ApiError({
      code: API_ERROR_CODES.APPOINTMENT_NOT_FOUND,
      status: 404,
      message: 'Nie znaleziono rezerwacji.',
    });
  }

  const slots = await getAllRows<AppointmentSlotRow>(
    database.prepare(APPOINTMENT_SLOTS_QUERY).bind(id),
  );

  return jsonSuccess({
    appointment: {
      ...toAdminAppointment(row),
      slotLocks: slots.map((slot) => slot.slot_start_utc),
    },
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env, params }) =>
  handleAdminAppointmentDetailRequest(request, env.DB, getRouteParam(params.id));
