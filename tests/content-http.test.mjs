import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.SHELL_TEST_URL ?? "http://127.0.0.1:3100";

for (const path of ["/ideas", "/studio"]) {
  test(`${path} fails closed without owner authentication configuration`, async () => {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    assert.ok([302, 303, 307, 308].includes(response.status));
    const location = response.headers.get("location") ?? "";
    assert.match(location, /\/sign-in\?error=configuration/);
  });
}

for (const path of ["/sign-in", "/auth/sign-in"]) {
  test(`${path} provides the owner sign-in form without exposing configuration`, async () => {
    const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Private owner workspace/);
    assert.match(html, /Owner sign in/);
    assert.match(html, /Set or reset password/);
    assert.doesNotMatch(html, /DATABASE_URL|NEON_AUTH_COOKIE_SECRET|OWNER_AUTH_USER_ID|postgres(?:ql)?:\/\//i);
  });
}

for (const [path, marker] of [["/forgot-password", "Send password setup link"]]) {
  test(`${path} renders a privacy-preserving recovery form`, async () => {
    const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(marker));
    assert.match(html, /whether|never confirms/i);
    assert.doesNotMatch(html, /OWNER_AUTH_USER_ID|NEON_AUTH_COOKIE_SECRET|postgres(?:ql)?:\/\//i);
  });
}

test("/verify-email renders the managed shared-provider code flow", async () => {
  const response = await fetch(new URL("/verify-email", baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Send verification code/);
  assert.match(html, /Six-digit verification code/);
  assert.match(html, /autoComplete="one-time-code"/);
  assert.match(html, /Codes expire after[\s\S]*15[\s\S]*minutes/);
  assert.match(html, /one-minute resend cooldown/);
  assert.doesNotMatch(html, /verification link/i);
  assert.doesNotMatch(html, /OWNER_AUTH_USER_ID|NEON_AUTH_COOKIE_SECRET|postgres(?:ql)?:\/\//i);
});

test("reset page rejects missing tokens without exposing a password form", async () => {
  const response = await fetch(new URL("/reset-password", baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /No valid recovery token/);
  assert.doesNotMatch(html, /name="token"/);
});

test("public managed-auth registration is disabled", async () => {
  const response = await fetch(new URL("/api/auth/sign-up/email", baseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Public registration is disabled/);
});

test("direct public email-code operations are disabled", async () => {
  for (const path of ["/api/auth/email-otp/send-verification-otp", "/api/auth/email-otp/verify-email", "/api/auth/sign-in/email-otp"]) {
    const response = await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(30_000),
    });
    assert.equal(response.status, 404);
  }
});

test("Learning Series remains public", async () => {
  const response = await fetch(new URL("/learning-series", baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Two independent teaching styles/);
});
