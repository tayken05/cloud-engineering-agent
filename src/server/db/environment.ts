import "server-only";

// Resolve only when future server-side database access is explicitly requested.
// Importing this module never reads credentials or creates a connection.
export function getDatabaseUrl(environment: Readonly<NodeJS.ProcessEnv> = process.env): string {
  const value = environment.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required for database access.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname || url.pathname === "/") {
    throw new Error("DATABASE_URL must specify a PostgreSQL host and database.");
  }
  return value;
}
