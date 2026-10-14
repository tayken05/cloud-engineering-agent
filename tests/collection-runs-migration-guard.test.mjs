import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseCollectionRunsMigrationCommand,
  validateCollectionRunsMigration,
} from "../scripts/collection-runs-migration-guard.mjs";

test("the collection-run migration command requires an explicit environment and mode", () => {
  assert.deepEqual(parseCollectionRunsMigrationCommand(["--development", "--preflight"]), {
    environment: "development",
    mode: "preflight",
  });
  assert.deepEqual(parseCollectionRunsMigrationCommand(["--production", "--execute"]), {
    environment: "production",
    mode: "execute",
  });
  assert.throws(() => parseCollectionRunsMigrationCommand(["--execute"]), /Choose/);
});

test("the checked-in migration is checksum-locked, additive, and excludes managed auth", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(new URL("../drizzle/0001_collection_runs.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  ]);
  assert.deepEqual(validateCollectionRunsMigration(sql, JSON.parse(journalText)), {
    checksum: "ef104c5b6cb124cc1a5571119d14f77ff74c93edf0b6d5c0542f5ad6ccb1cc05",
    statementCount: 6,
  });
  assert.throws(
    () => validateCollectionRunsMigration(`${sql}\nDROP TABLE sources;`, JSON.parse(journalText)),
    /checksum/,
  );
});
