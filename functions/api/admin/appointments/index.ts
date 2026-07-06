import {
  parseAppointmentsQuery,
  toAdminAppointment,
  type AdminAppointmentRow,
} from '../../../_shared/admin';
import { jsonSuccess } from '../../../_shared/api-response';
import { getAllRows } from '../../../_shared/database';
import { assertMethod } from '../../../_shared/request';

const APPOINTMENTS_QUERY = `
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
  WHERE (? IS NULL OR a.starts_at_utc >= ?)
    AND (? IS NULL OR a.starts_at_utc < ?)
    AND (? IS NULL OR a.barber_id = ?)
    AND (? IS NULL OR a.service_id = ?)
    AND (? IS NULL OR a.status = ?)
  ORDER BY
    CASE WHEN ? = 'asc' THEN a.starts_at_utc END ASC,
    CASE WHEN ? = 'desc' THEN a.starts_at_utc END DESC,
    CASE WHEN ? = 'asc' THEN a.id END ASC,
    CASE WHEN ? = 'desc' THEN a.id END DESC
  LIMIT ?
  OFFSET ?
`;

export async function handleAdminAppointmentsRequest(
  request: Request,
  database: D1Database,
): Promise<Response> {
  assertMethod(request, ['GET']);

  const query = parseAppointmentsQuery(new URL(request.url));
  const rows = await getAllRows<AdminAppointmentRow>(
    database
      .prepare(APPOINTMENTS_QUERY)
      .bind(
        query.dateFromUtc,
        query.dateFromUtc,
        query.dateToUtcExclusive,
        query.dateToUtcExclusive,
        query.barberId,
        query.barberId,
        query.serviceId,
        query.serviceId,
        query.status,
        query.status,
        query.sort,
        query.sort,
        query.sort,
        query.sort,
        query.limit + 1,
        query.offset,
      ),
  );
  const hasMore = rows.length > query.limit;

  return jsonSuccess({
    appointments: rows.slice(0, query.limit).map(toAdminAppointment),
    pagination: {
      page: query.page,
      limit: query.limit,
      hasMore,
    },
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleAdminAppointmentsRequest(request, env.DB);
