import assert from "node:assert/strict";
import test from "node:test";
import { readNeonAuthConfig, readOwnerAuthConfig } from "../src/server/auth/config.ts";
import { authorizeOwnerId, OwnerAuthorizationError } from "../src/server/auth/owner-policy.ts";

const valid = { NEON_AUTH_BASE_URL: "https://example.neonauth.test", NEON_AUTH_COOKIE_SECRET: "x".repeat(32), OWNER_AUTH_USER_ID: "owner_user_123" };
test("auth configuration validates server-only owner controls", () => {
  assert.equal(readOwnerAuthConfig(valid).ownerUserId, valid.OWNER_AUTH_USER_ID);
  assert.equal(readNeonAuthConfig(valid).baseUrl, valid.NEON_AUTH_BASE_URL);
  assert.throws(() => readOwnerAuthConfig({}), /not fully configured/);
  assert.throws(() => readOwnerAuthConfig({ ...valid, NEON_AUTH_BASE_URL: "http://example.test" }), /credential-free HTTPS/);
  assert.throws(() => readOwnerAuthConfig({ ...valid, NEON_AUTH_COOKIE_SECRET: "short" }), /cookie secret/);
});
test("authentication and owner authorization remain separate", () => {
  assert.equal(authorizeOwnerId("owner_user_123", "owner_user_123"), "owner_user_123");
  assert.throws(() => authorizeOwnerId(null, "owner_user_123"), (error) => error instanceof OwnerAuthorizationError && error.reason === "unauthenticated");
  assert.throws(() => authorizeOwnerId("other_user_123", "owner_user_123"), (error) => error instanceof OwnerAuthorizationError && error.reason === "forbidden");
  assert.throws(() => authorizeOwnerId("owner_user_123", null), (error) => error instanceof OwnerAuthorizationError && error.reason === "configuration");
});
