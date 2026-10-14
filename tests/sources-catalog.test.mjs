import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSourceLabel,
  parseSourceFilters,
  SOURCE_KIND_VALUES,
  SOURCE_TOPIC_VALUES,
} from "../src/features/sources/source-filters.ts";
import { getDatabaseUrl } from "../src/server/db/environment.ts";
import { sourceKind, intelligenceTopic } from "../src/server/db/schema.ts";
import { TRUSTED_SOURCE_CATALOG } from "../src/server/sources/trusted-source-catalog.ts";

test("the approved catalog contains unique HTTPS first-party source identities", () => {
  assert.equal(TRUSTED_SOURCE_CATALOG.length, 11);
  assert.equal(new Set(TRUSTED_SOURCE_CATALOG.map((source) => source.key)).size, 11);
  assert.equal(new Set(TRUSTED_SOURCE_CATALOG.map((source) => source.canonicalUrl)).size, 11);
  for (const source of TRUSTED_SOURCE_CATALOG) {
    const url = new URL(source.canonicalUrl);
    assert.equal(url.protocol, "https:");
    assert.equal(url.username, "");
    assert.equal(url.password, "");
    assert.ok(source.description.length > 20);
    assert.ok(!("reliabilityScore" in source));
    assert.ok(!("lastCollectedAt" in source));
  }
});

test("the approved catalog covers every requested technology area", () => {
  const topics = new Set(TRUSTED_SOURCE_CATALOG.map((source) => source.primaryTopic));
  for (const topic of [
    "cloud_engineering",
    "software_engineering",
    "linux",
    "networking",
    "devops",
    "cybersecurity",
    "containers_kubernetes",
    "infrastructure_as_code",
    "ai_infrastructure",
  ]) {
    assert.ok(topics.has(topic), `Missing topic ${topic}`);
  }
});

test("filter values remain aligned with the Drizzle enum declarations", () => {
  assert.deepEqual(SOURCE_KIND_VALUES, sourceKind.enumValues);
  assert.deepEqual(SOURCE_TOPIC_VALUES, intelligenceTopic.enumValues);
});

test("source filters validate, trim, and bound untrusted query parameters", () => {
  assert.deepEqual(parseSourceFilters({}), { status: "all" });
  assert.deepEqual(parseSourceFilters({
    kind: "publisher",
    q: "  cloud  ",
    status: "active",
    topic: "cloud_engineering",
  }), {
    kind: "publisher",
    query: "cloud",
    status: "active",
    topic: "cloud_engineering",
  });
  assert.deepEqual(parseSourceFilters({
    kind: "invalid",
    q: "x".repeat(120),
    status: "invalid",
    topic: ["invalid", "linux"],
  }), { query: "x".repeat(100), status: "all" });
  assert.equal(formatSourceLabel("infrastructure_as_code"), "Infrastructure as Code");
  assert.equal(formatSourceLabel("ai_infrastructure"), "AI Infrastructure");
});

test("database URL access remains lazy and build-safe", () => {
  assert.throws(() => getDatabaseUrl({}), /DATABASE_URL is required/);
});
