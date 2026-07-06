import { fromDatabaseBoolean } from '../../../_shared/admin';
import { jsonSuccess } from '../../../_shared/api-response';
import { getAllRows } from '../../../_shared/database';
import { assertMethod } from '../../../_shared/request';

export interface AdminWorkingHoursRow {
  id: number;
  barber_id: number;
  barber_name: string;
  weekday: number;
  start_time: string;
  end_time: string;
  active: number;
}

export function toAdminWorkingHours(row: AdminWorkingHoursRow) {
  return {
    id: row.id,
    barber: {
      id: row.barber_id,
      name: row.barber_name,
    },
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    active: fromDatabaseBoolean(row.active),
    timezone: 'Europe/Warsaw' as const,
  };
}

const ADMIN_WORKING_HOURS_QUERY = `
  SELECT
    wh.id,
    wh.barber_id,
    b.name AS barber_name,
    wh.weekday,
    wh.start_time,
    wh.end_time,
    wh.active
  FROM working_hours wh
  JOIN barbers b ON b.id = wh.barber_id
  ORDER BY wh.barber_id, wh.weekday
`;

export async function handleAdminWorkingHoursRequest(
  request: Request,
  database: D1Database,
): Promise<Response> {
  assertMethod(request, ['GET']);
  const rows = await getAllRows<AdminWorkingHoursRow>(database.prepare(ADMIN_WORKING_HOURS_QUERY));

  return jsonSuccess({
    workingHours: rows.map(toAdminWorkingHours),
    timezone: 'Europe/Warsaw',
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleAdminWorkingHoursRequest(request, env.DB);
