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
import { adminBarberPatchSchema, type AdminBarberPatch } from '../../../_shared/validation';
import { toAdminBarber, type AdminBarberRow } from './index';

const ADMIN_BARBER_QUERY = `
  SELECT
    id,
    slug,
    name,
    bio,
    image_path,
    active,
    created_at,
    updated_at
  FROM barbers
  WHERE id = ?
`;

const UPDATE_ADMIN_BARBER_QUERY = `
  UPDATE barbers
  SET
    name = ?,
    bio = ?,
    image_path = ?,
    active = ?,
    updated_at = ?
  WHERE id = ?
`;

interface AdminBarberRuntime {
  nowUtc?: string;
}

export async function handleAdminBarberUpdateRequest(
  request: Request,
  database: D1Database,
  rawId: string,
  runtime: AdminBarberRuntime = {},
): Promise<Response> {
  assertMethod(request, ['PATCH']);
  const id = parsePositiveRouteId(rawId);
  const patch = parseWithValidation<AdminBarberPatch>(
    adminBarberPatchSchema,
    await readJsonBody(request),
  );
  const current = await getFirstRow<AdminBarberRow>(database.prepare(ADMIN_BARBER_QUERY).bind(id));

  if (current === null) {
    throw new ApiError({
      code: API_ERROR_CODES.BARBER_NOT_FOUND,
      status: 404,
      message: 'Nie znaleziono barbera.',
    });
  }

  const updated: AdminBarberRow = {
    ...current,
    name: patch.name ?? current.name,
    bio: patch.bio ?? current.bio,
    image_path: patch.imagePath ?? current.image_path,
    active: patch.active === undefined ? current.active : toDatabaseBoolean(patch.active),
    updated_at: runtime.nowUtc ?? new Date().toISOString(),
  };

  await runStatement(
    database
      .prepare(UPDATE_ADMIN_BARBER_QUERY)
      .bind(updated.name, updated.bio, updated.image_path, updated.active, updated.updated_at, id),
  );

  return jsonSuccess({
    barber: toAdminBarber(updated),
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env, params }) =>
  handleAdminBarberUpdateRequest(request, env.DB, getRouteParam(params.id));
