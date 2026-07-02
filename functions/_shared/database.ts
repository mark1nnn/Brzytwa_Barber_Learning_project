import type { HealthRow } from './types';

export async function getFirstRow<T>(statement: D1PreparedStatement): Promise<T | null> {
  return statement.first<T>();
}

export async function getAllRows<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results;
}

export async function runStatement(statement: D1PreparedStatement): Promise<D1Result<unknown>> {
  return statement.run();
}

export async function checkDatabaseHealth(database: D1Database): Promise<boolean> {
  const row = await getFirstRow<HealthRow>(database.prepare('SELECT 1 AS ok'));

  return row?.ok === 1;
}
