import { jsonSuccess } from '../../_shared/api-response';
import { getAllRows } from '../../_shared/database';
import { assertMethod } from '../../_shared/request';
import type { PublicService, ServiceRow, ServicesResponse } from '../../_shared/types';

const ACTIVE_SERVICES_QUERY = `
  SELECT
    id,
    slug,
    name,
    description,
    duration_minutes,
    price_grosze,
    sort_order
  FROM services
  WHERE active = 1
  ORDER BY sort_order, id
`;

function toPublicService(row: ServiceRow): PublicService {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceGrosze: row.price_grosze,
  };
}

export async function handleServicesRequest(
  request: Request,
  database: D1Database,
): Promise<Response> {
  assertMethod(request, ['GET']);

  const rows = await getAllRows<ServiceRow>(database.prepare(ACTIVE_SERVICES_QUERY));
  const data: ServicesResponse = {
    services: rows.map(toPublicService),
  };

  return jsonSuccess(data);
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleServicesRequest(request, env.DB);
