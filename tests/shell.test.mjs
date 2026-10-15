import assert from "node:assert/strict";
import test from "node:test";

// Verify the public route contract over HTTP, independently of the UI catalog.
const baseUrl = process.env.SHELL_TEST_URL ?? "http://127.0.0.1:3100";
const routes = [
  ["/", "Your engineering workspace", "Coming in a future phase"],
  ["/tech-hub", "My Tech Intelligence", "Coming in a future phase"],
  ["/trending", "Trending", "Coming in a future phase"],
  ["/stories", "Stories &amp; News", "Collected publisher updates"],
  ["/learning-series", "Learning Series", "Two independent teaching styles"],
  ["/posts", "Published Posts", "Coming in a future phase"],
  ["/inbox", "Inbox", "Coming in a future phase"],
  ["/analytics", "Analytics", "Coming in a future phase"],
  ["/sources", "Sources", "Registered catalog"],
  ["/jobs", "Jobs &amp; Opportunities", "Official employer listings"],
  ["/settings", "Settings", "Coming in a future phase"],
];

for (const [path, heading, expectedContent] of routes) {
  test(`direct navigation to ${path} serves the shared shell and correct content`, async () => {
    const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<h1[^>]*>${heading}</h1>`));
    assert.match(html, /id="main-content"/);
    assert.match(html, /aria-label="Desktop workspace"/);
    assert.match(html, /aria-label="Mobile workspace"/);
    assert.match(html, /aria-label="Color theme"/);
    assert.match(html, new RegExp(expectedContent));
  });
}

test("unknown routes retain the framework's 404 behavior", async () => {
  const response = await fetch(new URL("/nonexistent-shell-route", baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 404);
});
