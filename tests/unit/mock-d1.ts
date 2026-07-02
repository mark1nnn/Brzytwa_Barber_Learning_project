export interface MockD1Call {
  operation: 'all' | 'first' | 'run';
  sql: string;
  bindings: readonly unknown[];
}

export interface MockD1Statement {
  sql: string;
  bindings: readonly unknown[];
}

export interface MockD1BatchCall {
  statements: readonly MockD1Statement[];
}

type MockD1Resolver = (call: MockD1Call) => unknown | Promise<unknown>;
type MockD1BatchResolver = (
  call: MockD1BatchCall,
) => D1Result<unknown>[] | Promise<D1Result<unknown>[]>;

export function createMockD1(
  resolver: MockD1Resolver,
  batchResolver?: MockD1BatchResolver,
): {
  database: D1Database;
  calls: MockD1Call[];
  batchCalls: MockD1BatchCall[];
} {
  const calls: MockD1Call[] = [];
  const batchCalls: MockD1BatchCall[] = [];
  const statementDetails = new WeakMap<D1PreparedStatement, MockD1Statement>();

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
      async run<T>(): Promise<D1Result<T>> {
        const call: MockD1Call = {
          operation: 'run',
          sql,
          bindings,
        };
        calls.push(call);
        return (await resolver(call)) as D1Result<T>;
      },
    };
    const preparedStatement = statement as unknown as D1PreparedStatement;

    statementDetails.set(preparedStatement, {
      sql,
      bindings,
    });

    return preparedStatement;
  }

  const database = {
    prepare(sql: string) {
      return createStatement(sql, []);
    },
    async batch(statements: D1PreparedStatement[]) {
      const batchCall: MockD1BatchCall = {
        statements: statements.map((statement) => {
          const details = statementDetails.get(statement);

          if (details === undefined) {
            throw new Error('Unknown prepared statement passed to mock D1 batch.');
          }

          return details;
        }),
      };
      batchCalls.push(batchCall);

      if (batchResolver === undefined) {
        throw new Error('Mock D1 batch resolver is not configured.');
      }

      return batchResolver(batchCall);
    },
  } as unknown as D1Database;

  return {
    database,
    calls,
    batchCalls,
  };
}
