import { getRouteParam, parseUuidRouteId } from '../../../../_shared/admin';
import { jsonSuccess } from '../../../../_shared/api-response';
import { getFirstRow, runBatchStatements, runStatement } from '../../../../_shared/database';
import { ApiError } from '../../../../_shared/errors';
import { assertMethod, readJsonBody } from '../../../../_shared/request';
import { API_ERROR_CODES } from '../../../../_shared/types';
import {
  adminAppointmentStatusRequestSchema,
  zodIssuesToFieldErrors,
  type AppointmentStatus,
} from '../../../../_shared/validation';

const APPOINTMENT_STATUS_QUERY = `
  SELECT id, status
  FROM appointments
  WHERE id = ?
`;

const UPDATE_APPOINTMENT_STATUS_QUERY = `
  UPDATE appointments
  SET status = ?, updated_at = ?
  WHERE id = ?
`;

const DELETE_APPOINTMENT_SLOTS_QUERY = `
  DELETE FROM appointment_slots
  WHERE appointment_id = ?
`;

interface AppointmentStatusRow {
  id: string;
  status: AppointmentStatus;
}

interface AdminStatusRuntime {
  nowUtc?: string;
}

function parseStatusRequest(body: unknown): { status: AppointmentStatus } {
  const result = adminAppointmentStatusRequestSchema.safeParse(body);

  if (!result.success) {
    throw new ApiError({
      code: API_ERROR_CODES.INVALID_STATUS,
      status: 400,
      message: 'Nieprawidłowy status rezerwacji.',
      fieldErrors: zodIssuesToFieldErrors(result.error.issues),
    });
  }

  return result.data;
}

export async function handleAdminAppointmentStatusRequest(
  request: Request,
  database: D1Database,
  rawId: string,
  runtime: AdminStatusRuntime = {},
): Promise<Response> {
  assertMethod(request, ['PATCH']);
  const id = parseUuidRouteId(rawId);
  const body = parseStatusRequest(await readJsonBody(request));
  const appointment = await getFirstRow<AppointmentStatusRow>(
    database.prepare(APPOINTMENT_STATUS_QUERY).bind(id),
  );

  if (appointment === null) {
    throw new ApiError({
      code: API_ERROR_CODES.APPOINTMENT_NOT_FOUND,
      status: 404,
      message: 'Nie znaleziono rezerwacji.',
    });
  }

  const updatedAt = runtime.nowUtc ?? new Date().toISOString();
  const updateStatement = database
    .prepare(UPDATE_APPOINTMENT_STATUS_QUERY)
    .bind(body.status, updatedAt, id);

  if (body.status === 'cancelled') {
    await runBatchStatements(database, [
      updateStatement,
      database.prepare(DELETE_APPOINTMENT_SLOTS_QUERY).bind(id),
    ]);
  } else {
    await runStatement(updateStatement);
  }

  return jsonSuccess({
    appointment: {
      id,
      status: body.status,
      updatedAt,
    },
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env, params }) =>
  handleAdminAppointmentStatusRequest(request, env.DB, getRouteParam(params.id));
