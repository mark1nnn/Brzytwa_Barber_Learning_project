import {
  blockedPeriodReason,
  fromDatabaseBoolean,
  parseWithValidation,
} from '../../../_shared/admin';
import { jsonSuccess } from '../../../_shared/api-response';
import { getAllRows, getFirstRow, runStatement } from '../../../_shared/database';
import { ApiError } from '../../../_shared/errors';
import { generateUuid } from '../../../_shared/ids';
import { assertMethod, readJsonBody } from '../../../_shared/request';
import { API_ERROR_CODES } from '../../../_shared/types';
import {
  adminBlockedPeriodRequestSchema,
  type AdminBlockedPeriodRequest,
} from '../../../_shared/validation';

export interface AdminBlockedPeriodRow {
  id: string;
  barber_id: number;
  barber_name: string;
  starts_at_utc: string;
  ends_at_utc: string;
  reason: string;
  created_at: string;
}

interface AdminBarberStateRow {
  id: number;
  name: string;
  active: number;
}

export function toAdminBlockedPeriod(row: AdminBlockedPeriodRow) {
  return {
    id: row.id,
    barber: {
      id: row.barber_id,
      name: row.barber_name,
    },
    startsAt: row.starts_at_utc,
    endsAt: row.ends_at_utc,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

const ADMIN_BLOCKED_PERIODS_QUERY = `
  SELECT
    bp.id,
    bp.barber_id,
    b.name AS barber_name,
    bp.starts_at_utc,
    bp.ends_at_utc,
    bp.reason,
    bp.created_at
  FROM blocked_periods bp
  JOIN barbers b ON b.id = bp.barber_id
  ORDER BY bp.starts_at_utc DESC, bp.id DESC
`;

const ADMIN_BARBER_STATE_QUERY = `
  SELECT id, name, active
  FROM barbers
  WHERE id = ?
`;

const INSERT_BLOCKED_PERIOD_QUERY = `
  INSERT INTO blocked_periods (
    id,
    barber_id,
    starts_at_utc,
    ends_at_utc,
    reason,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
`;

interface AdminBlockedPeriodRuntime {
  nowUtc?: string;
  uuidGenerator?: () => string;
}

export async function handleAdminBlockedPeriodsRequest(
  request: Request,
  database: D1Database,
  runtime: AdminBlockedPeriodRuntime = {},
): Promise<Response> {
  assertMethod(request, ['GET', 'POST']);

  if (request.method === 'GET') {
    const rows = await getAllRows<AdminBlockedPeriodRow>(
      database.prepare(ADMIN_BLOCKED_PERIODS_QUERY),
    );

    return jsonSuccess({
      blockedPeriods: rows.map(toAdminBlockedPeriod),
    });
  }

  const input = parseWithValidation<AdminBlockedPeriodRequest>(
    adminBlockedPeriodRequestSchema,
    await readJsonBody(request),
  );
  const barber = await getFirstRow<AdminBarberStateRow>(
    database.prepare(ADMIN_BARBER_STATE_QUERY).bind(input.barberId),
  );

  if (barber === null || !fromDatabaseBoolean(barber.active)) {
    throw new ApiError({
      code: API_ERROR_CODES.BARBER_NOT_FOUND,
      status: 404,
      message: 'Nie znaleziono aktywnego barbera.',
    });
  }

  const row: AdminBlockedPeriodRow = {
    id: (runtime.uuidGenerator ?? generateUuid)(),
    barber_id: barber.id,
    barber_name: barber.name,
    starts_at_utc: input.startsAt,
    ends_at_utc: input.endsAt,
    reason: blockedPeriodReason(input.reason),
    created_at: runtime.nowUtc ?? new Date().toISOString(),
  };

  await runStatement(
    database
      .prepare(INSERT_BLOCKED_PERIOD_QUERY)
      .bind(row.id, row.barber_id, row.starts_at_utc, row.ends_at_utc, row.reason, row.created_at),
  );

  return jsonSuccess(
    {
      blockedPeriod: toAdminBlockedPeriod(row),
    },
    { status: 201 },
  );
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleAdminBlockedPeriodsRequest(request, env.DB);
