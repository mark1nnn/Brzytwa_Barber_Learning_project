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
import { adminServicePatchSchema, type AdminServicePatch } from '../../../_shared/validation';
import { toAdminService, type AdminServiceRow } from './index';

const ADMIN_SERVICE_QUERY = `
  SELECT
    id,
    slug,
    name,
    description,
    duration_minutes,
    price_grosze,
    active,
    sort_order,
    created_at,
    updated_at
  FROM services
  WHERE id = ?
`;

const UPDATE_ADMIN_SERVICE_QUERY = `
  UPDATE services
  SET
    name = ?,
    description = ?,
    duration_minutes = ?,
    price_grosze = ?,
    active = ?,
    sort_order = ?,
    updated_at = ?
  WHERE id = ?
`;

interface AdminServiceRuntime {
  nowUtc?: string;
}

export async function handleAdminServiceUpdateRequest(
  request: Request,
  database: D1Database,
  rawId: string,
  runtime: AdminServiceRuntime = {},
): Promise<Response> {
  assertMethod(request, ['PATCH']);
  const id = parsePositiveRouteId(rawId);
  const patch = parseWithValidation<AdminServicePatch>(
    adminServicePatchSchema,
    await readJsonBody(request),
  );
  const current = await getFirstRow<AdminServiceRow>(
    database.prepare(ADMIN_SERVICE_QUERY).bind(id),
  );

  if (current === null) {
    throw new ApiError({
      code: API_ERROR_CODES.SERVICE_NOT_FOUND,
      status: 404,
      message: 'Nie znaleziono usługi.',
    });
  }

  const updated: AdminServiceRow = {
    ...current,
    name: patch.name ?? current.name,
    description: patch.description ?? current.description,
    duration_minutes: patch.durationMinutes ?? current.duration_minutes,
    price_grosze: patch.priceGrosze ?? current.price_grosze,
    active: patch.active === undefined ? current.active : toDatabaseBoolean(patch.active),
    sort_order: patch.sortOrder ?? current.sort_order,
    updated_at: runtime.nowUtc ?? new Date().toISOString(),
  };

  await runStatement(
    database
      .prepare(UPDATE_ADMIN_SERVICE_QUERY)
      .bind(
        updated.name,
        updated.description,
        updated.duration_minutes,
        updated.price_grosze,
        updated.active,
        updated.sort_order,
        updated.updated_at,
        id,
      ),
  );

  return jsonSuccess({
    service: toAdminService(updated),
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env, params }) =>
  handleAdminServiceUpdateRequest(request, env.DB, getRouteParam(params.id));
