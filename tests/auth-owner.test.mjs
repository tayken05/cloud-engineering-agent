import assert from "node:assert/strict";
import test from "node:test";
import { readNeonAuthConfig, readOwnerAuthConfig } from "../src/server/auth/config.ts";
import { authorizeOwnerId, OwnerAuthorizationError } from "../src/server/auth/owner-policy.ts";
import { AUTH_CALLBACKS, normalizeEmail, normalizeResetToken, validateNewPassword } from "../src/server/auth/recovery-policy.ts";

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

test("recovery inputs are bounded and callbacks stay on the production application", () => {
  assert.equal(normalizeEmail(" Owner@Example.com "), "owner@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail("a".repeat(321)), null);
  assert.equal(normalizeResetToken("abcdefghijklmnop_123"), "abcdefghijklmnop_123");
  assert.equal(normalizeResetToken("bad token"), null);
  assert.equal(validateNewPassword("a secure passphrase", "a secure passphrase"), null);
  assert.equal(validateNewPassword("short", "short"), "password");
  assert.equal(validateNewPassword("a secure passphrase", "different secure passphrase"), "mismatch");
  assert.equal(new URL(AUTH_CALLBACKS.passwordReset).origin, "https://cloud-engineering-agent.vercel.app");
  assert.equal(new URL(AUTH_CALLBACKS.emailVerified).origin, "https://cloud-engineering-agent.vercel.app");
});
