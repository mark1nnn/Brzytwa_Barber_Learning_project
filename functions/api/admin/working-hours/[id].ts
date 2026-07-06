import {
  getRouteParam,
  parsePositiveRouteId,
  parseWithValidation,
  toDatabaseBoolean,
} from '../../../_shared/admin';
import { jsonSuccess } from '../../../_shared/api-response';
import { getFirstRow, runStatement } from '../../../_shared/database';
import { ApiError } from '../../../_shared/errors';
import { assertMethod, readJsonBody } from '../../../_shared/request';
import { API_ERROR_CODES } from '../../../_shared/types';
import {
  adminWorkingHoursPatchSchema,
  type AdminWorkingHoursPatch,
} from '../../../_shared/validation';
import { toAdminWorkingHours, type AdminWorkingHoursRow } from './index';

const ADMIN_WORKING_HOURS_ITEM_QUERY = `
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
  WHERE wh.id = ?
`;

const UPDATE_ADMIN_WORKING_HOURS_QUERY = `
  UPDATE working_hours
  SET start_time = ?, end_time = ?, active = ?
  WHERE id = ?
`;

export async function handleAdminWorkingHoursUpdateRequest(
  request: Request,
  database: D1Database,
  rawId: string,
): Promise<Response> {
  assertMethod(request, ['PATCH']);
  const id = parsePositiveRouteId(rawId);
  const patch = parseWithValidation<AdminWorkingHoursPatch>(
    adminWorkingHoursPatchSchema,
    await readJsonBody(request),
  );
  const current = await getFirstRow<AdminWorkingHoursRow>(
    database.prepare(ADMIN_WORKING_HOURS_ITEM_QUERY).bind(id),
  );

  if (current === null) {
    throw new ApiError({
      code: API_ERROR_CODES.WORKING_HOURS_NOT_FOUND,
      status: 404,
      message: 'Nie znaleziono godzin pracy.',
    });
  }

  const updated: AdminWorkingHoursRow = {
    ...current,
    start_time: patch.startTime ?? current.start_time,
    end_time: patch.endTime ?? current.end_time,
    active: patch.active === undefined ? current.active : toDatabaseBoolean(patch.active),
  };

  if (updated.start_time >= updated.end_time) {
    throw new ApiError({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      status: 400,
      message: 'Nie udało się przetworzyć żądania.',
      fieldErrors: {
        endTime: 'Godzina zakończenia musi być późniejsza niż godzina rozpoczęcia.',
      },
    });
  }

  await runStatement(
    database
      .prepare(UPDATE_ADMIN_WORKING_HOURS_QUERY)
      .bind(updated.start_time, updated.end_time, updated.active, id),
  );

  return jsonSuccess({
    workingHours: toAdminWorkingHours(updated),
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env, params }) =>
  handleAdminWorkingHoursUpdateRequest(request, env.DB, getRouteParam(params.id));
