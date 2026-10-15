import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getDatabaseUrl } from "./environment.ts";
import * as schema from "./schema.ts";

export const DATABASE_QUERY_TIMEOUT_MS = 15_000;

type DatabaseOptions = Readonly<{
  signal?: AbortSignal;
}>;

export function createDatabase(options: DatabaseOptions = {}) {
  const timeoutSignal = AbortSignal.timeout(DATABASE_QUERY_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;
  const client = neon(getDatabaseUrl(), { fetchOptions: { signal } });

  return drizzle(client, { schema });
}
