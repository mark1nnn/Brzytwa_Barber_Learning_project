import { fromDatabaseBoolean } from '../../../_shared/admin';
import { jsonSuccess } from '../../../_shared/api-response';
import { getAllRows } from '../../../_shared/database';
import { assertMethod } from '../../../_shared/request';

export interface AdminServiceRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_grosze: number;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function toAdminService(row: AdminServiceRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceGrosze: row.price_grosze,
    active: fromDatabaseBoolean(row.active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ADMIN_SERVICES_QUERY = `
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
  ORDER BY sort_order, id
`;

export async function handleAdminServicesRequest(
  request: Request,
  database: D1Database,
): Promise<Response> {
  assertMethod(request, ['GET']);
  const rows = await getAllRows<AdminServiceRow>(database.prepare(ADMIN_SERVICES_QUERY));

  return jsonSuccess({
    services: rows.map(toAdminService),
  });
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleAdminServicesRequest(request, env.DB);
