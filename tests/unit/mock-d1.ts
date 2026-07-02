export interface MockD1Call {
  operation: 'all' | 'first';
  sql: string;
  bindings: readonly unknown[];
}

type MockD1Resolver = (call: MockD1Call) => unknown | Promise<unknown>;

export function createMockD1(resolver: MockD1Resolver): {
  database: D1Database;
  calls: MockD1Call[];
} {
  const calls: MockD1Call[] = [];

  function createStatement(sql: string, bindings: readonly unknown[]): D1PreparedStatement {
    const statement = {
      bind(...values: unknown[]) {
        return createStatement(sql, values);
      },
      async first<T>(): Promise<T | null> {
        const call: MockD1Call = {
          operation: 'first',
          sql,
          bindings,
        };
        calls.push(call);
        return (await resolver(call)) as T | null;
      },
      async all<T>(): Promise<D1Result<T>> {
        const call: MockD1Call = {
          operation: 'all',
          sql,
          bindings,
        };
        calls.push(call);
        const results = (await resolver(call)) as T[];

        return { results } as D1Result<T>;
      },
    };

    return statement as unknown as D1PreparedStatement;
  }

  const database = {
    prepare(sql: string) {
      return createStatement(sql, []);
    },
  } as unknown as D1Database;

  return {
    database,
    calls,
  };
}
