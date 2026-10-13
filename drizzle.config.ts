import { defineConfig } from "drizzle-kit";

// Offline generation/checks only. Credential-bearing migration execution is deferred.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
