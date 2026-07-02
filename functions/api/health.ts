import { jsonSuccess } from '../_shared/api-response';
import { APP_TIMEZONE } from '../_shared/constants';
import { checkDatabaseHealth } from '../_shared/database';
import { ApiError } from '../_shared/errors';
import { assertMethod } from '../_shared/request';
import { API_ERROR_CODES, type HealthResponse } from '../_shared/types';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  assertMethod(request, ['GET']);

  try {
    const databaseIsAvailable = await checkDatabaseHealth(env.DB);

    if (!databaseIsAvailable) {
      throw new Error('D1 health query returned an unexpected value.');
    }
  } catch (cause) {
    throw new ApiError({
      code: API_ERROR_CODES.DATABASE_UNAVAILABLE,
      status: 503,
      message: 'Usługa jest chwilowo niedostępna. Spróbuj ponownie później.',
      cause,
    });
  }

  const data: HealthResponse = {
    status: 'ok',
    database: 'ok',
    timezone: APP_TIMEZONE,
    timestamp: new Date().toISOString(),
  };

  return jsonSuccess(data);
};
