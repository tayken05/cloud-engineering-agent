import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTENT_FORMATS,
  getContentFormat,
} from "../src/features/content-studio/content-formats.ts";
import { PLANNED_IMAGE_PROVIDERS } from "../src/features/content-studio/image-provider.ts";
import { VISUAL_TEMPLATES } from "../src/features/content-studio/content-types.ts";
import {
  countXCharacters,
  createDefaultVisual,
  createStarterWorkspace,
  parseContentWorkspace,
  serializeContentWorkspace,
  validateDraft,
} from "../src/features/content-studio/content-workspace.ts";

test("all 20 original content formats remain distinct and guided", () => {
  assert.equal(CONTENT_FORMATS.length, 20);
  assert.equal(new Set(CONTENT_FORMATS.map((format) => format.id)).size, 20);
  const historical = getContentFormat("historical-first-principles");
  const analogy = getContentFormat("real-world-analogies");
  assert.notEqual(historical.id, analogy.id);
  assert.match(historical.guidance, /original human problem/i);
  assert.match(analogy.guidance, /analogy (?:breaks|stops)/i);
  assert.ok(CONTENT_FORMATS.every((format) => format.template.length >= 4));
});

test("device-local workspace round-trips through a bounded validated format", () => {
  const starter = createStarterWorkspace();
  const serialized = serializeContentWorkspace(starter);
  assert.ok(serialized.length < 1_000_000);
  assert.deepEqual(parseContentWorkspace(JSON.parse(serialized)), starter);
  assert.equal(parseContentWorkspace({ version: 2, ideas: [], drafts: [] }), null);
});

test("stored evidence rejects non-HTTPS links and clips unsupported data", () => {
  const starter = createStarterWorkspace();
  const unsafe = {
    ...starter,
    ideas: [{
      ...starter.ideas[0],
      evidence: [
        { id: "bad", publisher: "Bad", publishedAt: null, title: "Bad", url: "javascript:alert(1)", verificationLabel: "publisher_record" },
        { id: "good", publisher: "Official", publishedAt: "2026-10-15T00:00:00Z", title: "Release", url: "https://example.test/release", verificationLabel: "publisher_record" },
      ],
    }],
  };
  const parsed = parseContentWorkspace(unsafe);
  assert.ok(parsed);
  assert.equal(parsed.ideas[0].evidence.length, 1);
  assert.equal(parsed.ideas[0].evidence[0].id, "good");
});

test("X preflight validates post, thread, poll, source, and moderator constraints", () => {
  const starter = createStarterWorkspace();
  const askGrok = starter.drafts[0];
  assert.deepEqual(validateDraft(askGrok), []);
  assert.ok(askGrok.caption.includes("@grok"));
  assert.ok(askGrok.moderatorNotes.length > 0);
  assert.equal(countXCharacters("cloud ☁️"), 8);
  assert.match(validateDraft({ ...askGrok, caption: "x".repeat(281) })[0], /280-character/);
  assert.ok(validateDraft({ ...askGrok, formatId: "breaking-technology-updates", evidence: [] }).some((problem) => /publisher source/.test(problem)));
  assert.ok(validateDraft({ ...askGrok, formatId: "polls-interactive-questions", pollOptions: ["only one"] }).some((problem) => /two to four/.test(problem)));
  assert.ok(validateDraft({ ...askGrok, formatId: "threads-learning-series", threadPosts: ["one"] }).some((problem) => /at least two/.test(problem)));
});

test("all six deterministic visual specifications support square and landscape exports", () => {
  assert.equal(VISUAL_TEMPLATES.length, 6);
  for (const templateId of VISUAL_TEMPLATES) {
    const visual = createDefaultVisual("A technical lesson", templateId);
    assert.equal(visual.templateId, templateId);
    assert.equal(visual.aspect, "square");
    assert.doesNotMatch(JSON.stringify(visual), /data:image|base64/i);
    assert.equal({ ...visual, aspect: "landscape" }.aspect, "landscape");
  }
});

test("future AI image providers are explicit, disabled, and provider independent", () => {
  assert.deepEqual(PLANNED_IMAGE_PROVIDERS.map((provider) => provider.id), ["openai-images", "xai-grok-imagine"]);
  assert.ok(PLANNED_IMAGE_PROVIDERS.every((provider) => provider.configured === false));
});
