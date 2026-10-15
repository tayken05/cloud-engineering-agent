import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.SHELL_TEST_URL ?? "http://127.0.0.1:3100";

for (const path of ["/ideas", "/studio"]) {
  test(`${path} fails closed without owner authentication configuration`, async () => {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    assert.ok([302, 303, 307, 308].includes(response.status));
    const location = response.headers.get("location") ?? "";
    assert.match(location, /\/auth\/sign-in\?error=configuration/);
  });
}

test("owner sign-in is available without exposing configuration", async () => {
  const response = await fetch(new URL("/auth/sign-in", baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Private owner workspace/);
  assert.doesNotMatch(html, /DATABASE_URL|NEON_AUTH_COOKIE_SECRET|OWNER_AUTH_USER_ID|postgres(?:ql)?:\/\//i);
});

test("public managed-auth registration is disabled", async () => {
  const response = await fetch(new URL("/api/auth/sign-up/email", baseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Public registration is disabled/);
});

test("Learning Series remains public", async () => {
  const response = await fetch(new URL("/learning-series", baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Two independent teaching styles/);
});
