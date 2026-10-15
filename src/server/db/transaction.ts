import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";

import { getDatabaseUrl } from "./environment.ts";
import * as schema from "./schema.ts";

function createTransactionalDatabase(pool: Pool) { return drizzle(pool, { schema }); }
type DatabaseTransaction = Parameters<Parameters<ReturnType<typeof createTransactionalDatabase>["transaction"]>[0]>[0];

export async function withDatabaseTransaction<T>(work: (database: DatabaseTransaction) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000 });
  const database = createTransactionalDatabase(pool);
  try {
    return await database.transaction(async (transaction) => {
      await transaction.execute(sql`set local statement_timeout = '15s'`);
      await transaction.execute(sql`set local lock_timeout = '5s'`);
      return work(transaction);
    });
  } finally {
    await pool.end();
  }
}
