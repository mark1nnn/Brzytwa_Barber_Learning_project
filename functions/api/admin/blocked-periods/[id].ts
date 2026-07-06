import { getRouteParam, parseUuidRouteId } from '../../../_shared/admin';
import { jsonSuccess } from '../../../_shared/api-response';
import { getFirstRow, runStatement } from '../../../_shared/database';
import { ApiError } from '../../../_shared/errors';
import { assertMethod } from '../../../_shared/request';
import { API_ERROR_CODES } from '../../../_shared/types';

const BLOCKED_PERIOD_EXISTS_QUERY = `
  SELECT id
  FROM blocked_periods
  WHERE id = ?
`;

const DELETE_BLOCKED_PERIOD_QUERY = `
  DELETE FROM blocked_periods
  WHERE id = ?
`;

interface BlockedPeriodIdRow {
  id: string;
}

export async function handleAdminBlockedPeriodDeleteRequest(
  request: Request,
  database: D1Database,
  rawId: string,
): Promise<Response> {
  assertMethod(request, ['DELETE']);
  const id = parseUuidRouteId(rawId);
  const row = await getFirstRow<BlockedPeriodIdRow>(
    database.prepare(BLOCKED_PERIOD_EXISTS_QUERY).bind(id),
  );

  if (row === null) {
    throw new ApiError({
      code: API_ERROR_CODES.BLOCKED_PERIOD_NOT_FOUND,
      status: 404,
      message: 'Nie znaleziono blokady.',
    });
  }

  await runStatement(database.prepare(DELETE_BLOCKED_PERIOD_QUERY).bind(id));

  return jsonSuccess({
    blockedPeriod: {
      id,
      deleted: true,
    },
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env, params }) =>
  handleAdminBlockedPeriodDeleteRequest(request, env.DB, getRouteParam(params.id));
