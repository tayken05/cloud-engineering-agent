import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSourceCatalogCommand,
  planSourceCatalog,
  sourceCatalogConfig,
  validateDevelopmentDatabaseUrls,
  validateTrustedSourceCatalog,
} from "../scripts/source-catalog-guard.mjs";
import { TRUSTED_SOURCE_CATALOG } from "../src/server/sources/trusted-source-catalog.ts";

function developmentUrl({ pooled = false, endpoint = sourceCatalogConfig.developmentEndpoint } = {}) {
  return `postgresql://user:password@${endpoint}${pooled ? "-pooler" : ""}.example.neon.tech/neondb?sslmode=require`;
}

test("development credentials require the exact direct and pooled endpoint pair", () => {
  const valid = validateDevelopmentDatabaseUrls({
    DATABASE_URL: developmentUrl({ pooled: true }),
    DATABASE_URL_UNPOOLED: developmentUrl(),
  });
  assert.equal(valid.endpoint, sourceCatalogConfig.developmentEndpoint);
  assert.equal(valid.database, "neondb");

  assert.throws(() => validateDevelopmentDatabaseUrls({
    DATABASE_URL: developmentUrl({ pooled: true }),
    DATABASE_URL_UNPOOLED: developmentUrl({ endpoint: sourceCatalogConfig.productionEndpoint }),
  }), /approved endpoint/);
  assert.throws(() => validateDevelopmentDatabaseUrls({
    DATABASE_URL: developmentUrl({ pooled: true }),
    DATABASE_URL_UNPOOLED: developmentUrl(),
    EXTRA_SECRET: "forbidden",
  }), /must contain only/);
});

test("catalog operations require an explicit environment and mode", () => {
  assert.deepEqual(parseSourceCatalogCommand(["--development", "--preflight"]), {
    environment: "development",
    mode: "preflight",
  });
  assert.deepEqual(parseSourceCatalogCommand(["--production", "--execute"]), {
    environment: "production",
    mode: "execute",
  });
  assert.throws(() => parseSourceCatalogCommand(["--production"]), /Choose an environment/);
});

test("catalog planning is idempotent and detects identity conflicts", () => {
  validateTrustedSourceCatalog(TRUSTED_SOURCE_CATALOG);
  const firstPlan = planSourceCatalog([], TRUSTED_SOURCE_CATALOG);
  assert.equal(firstPlan.missing.length, TRUSTED_SOURCE_CATALOG.length);

  const existing = TRUSTED_SOURCE_CATALOG.map((source, index) => ({
    ...source,
    id: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
  }));
  assert.equal(planSourceCatalog(existing, TRUSTED_SOURCE_CATALOG).missing.length, 0);

  const conflicting = existing.map((source, index) => index === 0
    ? { ...source, canonicalUrl: "https://example.invalid/conflict" }
    : source);
  assert.throws(
    () => planSourceCatalog(conflicting, TRUSTED_SOURCE_CATALOG),
    /conflicts with the approved source catalog/,
  );
});

test("catalog validation rejects duplicate URLs and non-HTTPS sources", () => {
  const duplicate = TRUSTED_SOURCE_CATALOG.map((source, index) => index === 1
    ? { ...source, canonicalUrl: TRUSTED_SOURCE_CATALOG[0].canonicalUrl }
    : source);
  assert.throws(() => validateTrustedSourceCatalog(duplicate), /duplicate key or URL/);

  const insecure = TRUSTED_SOURCE_CATALOG.map((source, index) => index === 0
    ? { ...source, canonicalUrl: "http://example.invalid" }
    : source);
  assert.throws(() => validateTrustedSourceCatalog(insecure), /credential-free HTTPS/);
});
