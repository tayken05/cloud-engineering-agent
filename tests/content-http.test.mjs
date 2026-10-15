import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.SHELL_TEST_URL ?? "http://127.0.0.1:3100";

for (const [path, heading, expected] of [
  ["/ideas", "Content Ideas", "Opening the device-local ideas workspace"],
  ["/studio", "Content Studio", "Opening the device-local Content Studio"],
  ["/learning-series", "Learning Series", "Two independent teaching styles"],
]) {
  test(`${path} exposes the read-only shell without credentials`, async () => {
    const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<h1[^>]*>${heading}</h1>`));
    assert.match(html, new RegExp(expected));
    assert.doesNotMatch(html, /DATABASE_URL|OPENAI_API_KEY|XAI_API_KEY|postgres(?:ql)?:\/\//i);
    assert.doesNotMatch(html, /<form[^>]+action=/i);
  });
}
