import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

const g = globalThis as unknown as { __cyclewardenSql?: Sql };

/**
 * Portable Postgres client (Better Auth + domain tables).
 * Only constructed when DATABASE_URL is set. Reused within a server process so
 * server actions and route handlers do not create a new pool per request.
 */
export function createSql(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!g.__cyclewardenSql) {
    g.__cyclewardenSql = postgres(url, { max: 5, prepare: false });
  }
  return g.__cyclewardenSql;
}

export function createDb() {
  const client = createSql();
  return client ? drizzle(client) : null;
}

export type Db = NonNullable<ReturnType<typeof createDb>>;
