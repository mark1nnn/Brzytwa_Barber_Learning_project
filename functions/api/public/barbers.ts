import { z } from 'zod';

import { jsonSuccess } from '../../_shared/api-response';
import { getAllRows, getFirstRow } from '../../_shared/database';
import { ApiError } from '../../_shared/errors';
import { assertMethod } from '../../_shared/request';
import {
  API_ERROR_CODES,
  type ActiveServiceRow,
  type BarberServiceRow,
  type BarbersResponse,
  type PublicBarber,
} from '../../_shared/types';
import { positiveIntegerIdSchema, zodIssuesToFieldErrors } from '../../_shared/validation';

const SERVICE_ID_QUERY_SCHEMA = z.object({
  serviceId: positiveIntegerIdSchema,
});

const ACTIVE_SERVICE_QUERY = `
  SELECT id
  FROM services
  WHERE id = ?
    AND active = 1
`;

const ACTIVE_BARBERS_QUERY = `
  SELECT
    b.id AS barber_id,
    b.slug AS barber_slug,
    b.name AS barber_name,
    b.bio AS barber_bio,
    b.image_path AS barber_image_path,
    s.id AS service_id,
    s.slug AS service_slug,
    s.name AS service_name,
    s.duration_minutes AS service_duration_minutes,
    s.price_grosze AS service_price_grosze
  FROM barbers AS b
  JOIN barber_services AS bs
    ON bs.barber_id = b.id
  JOIN services AS s
    ON s.id = bs.service_id
  WHERE b.active = 1
    AND s.active = 1
  ORDER BY b.id, s.sort_order, s.id
`;

const ACTIVE_BARBERS_BY_SERVICE_QUERY = `
  SELECT
    b.id AS barber_id,
    b.slug AS barber_slug,
    b.name AS barber_name,
    b.bio AS barber_bio,
    b.image_path AS barber_image_path,
    s.id AS service_id,
    s.slug AS service_slug,
    s.name AS service_name,
    s.duration_minutes AS service_duration_minutes,
    s.price_grosze AS service_price_grosze
  FROM barbers AS b
  JOIN barber_services AS bs
    ON bs.barber_id = b.id
  JOIN services AS s
    ON s.id = bs.service_id
  WHERE b.active = 1
    AND s.active = 1
    AND EXISTS (
      SELECT 1
      FROM barber_services AS filtered_bs
      JOIN services AS filtered_s
        ON filtered_s.id = filtered_bs.service_id
      WHERE filtered_bs.barber_id = b.id
        AND filtered_bs.service_id = ?
        AND filtered_s.active = 1
    )
  ORDER BY b.id, s.sort_order, s.id
`;

function parseServiceId(request: Request): number | undefined {
  const serviceId = new URL(request.url).searchParams.get('serviceId');

  if (serviceId === null) {
    return undefined;
  }

  const result = SERVICE_ID_QUERY_SCHEMA.safeParse({ serviceId });

  if (!result.success) {
    throw new ApiError({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      status: 400,
      message: 'Nie udało się przetworzyć żądania.',
      fieldErrors: zodIssuesToFieldErrors(result.error.issues),
    });
  }

  return result.data.serviceId;
}

function groupBarbers(rows: readonly BarberServiceRow[]): PublicBarber[] {
  const grouped = new Map<
    number,
    {
      barber: PublicBarber;
      serviceIds: Set<number>;
    }
  >();

  for (const row of rows) {
    let entry = grouped.get(row.barber_id);

    if (entry === undefined) {
      entry = {
        barber: {
          id: row.barber_id,
          slug: row.barber_slug,
          name: row.barber_name,
          bio: row.barber_bio,
          imagePath: row.barber_image_path,
          services: [],
        },
        serviceIds: new Set<number>(),
      };
      grouped.set(row.barber_id, entry);
    }

    if (!entry.serviceIds.has(row.service_id)) {
      entry.serviceIds.add(row.service_id);
      entry.barber.services.push({
        id: row.service_id,
        slug: row.service_slug,
        name: row.service_name,
        durationMinutes: row.service_duration_minutes,
        priceGrosze: row.service_price_grosze,
      });
    }
  }

  return Array.from(grouped.values(), ({ barber }) => barber);
}

async function assertActiveService(database: D1Database, serviceId: number): Promise<void> {
  const service = await getFirstRow<ActiveServiceRow>(
    database.prepare(ACTIVE_SERVICE_QUERY).bind(serviceId),
  );

  if (service === null) {
    throw new ApiError({
      code: API_ERROR_CODES.SERVICE_NOT_FOUND,
      status: 404,
      message: 'Wybrana usługa nie istnieje lub jest niedostępna.',
    });
  }
}

export async function handleBarbersRequest(
  request: Request,
  database: D1Database,
): Promise<Response> {
  assertMethod(request, ['GET']);

  const serviceId = parseServiceId(request);
  let rows: BarberServiceRow[];

  if (serviceId === undefined) {
    rows = await getAllRows<BarberServiceRow>(database.prepare(ACTIVE_BARBERS_QUERY));
  } else {
    await assertActiveService(database, serviceId);
    rows = await getAllRows<BarberServiceRow>(
      database.prepare(ACTIVE_BARBERS_BY_SERVICE_QUERY).bind(serviceId),
    );
  }

  const data: BarbersResponse = {
    barbers: groupBarbers(rows),
  };

  return jsonSuccess(data);
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleBarbersRequest(request, env.DB);
