import { fromDatabaseBoolean } from '../../../_shared/admin';
import { jsonSuccess } from '../../../_shared/api-response';
import { getAllRows } from '../../../_shared/database';
import { assertMethod } from '../../../_shared/request';

export interface AdminBarberRow {
  id: number;
  slug: string;
  name: string;
  bio: string;
  image_path: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export function toAdminBarber(row: AdminBarberRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    bio: row.bio,
    imagePath: row.image_path,
    active: fromDatabaseBoolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ADMIN_BARBERS_QUERY = `
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
  ORDER BY id
`;

export async function handleAdminBarbersRequest(
  request: Request,
  database: D1Database,
): Promise<Response> {
  assertMethod(request, ['GET']);
  const rows = await getAllRows<AdminBarberRow>(database.prepare(ADMIN_BARBERS_QUERY));

  return jsonSuccess({
    barbers: rows.map(toAdminBarber),
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleAdminBarbersRequest(request, env.DB);
