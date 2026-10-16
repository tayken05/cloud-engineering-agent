import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { preparePostInput, preparePostInstructions } from "../src/features/ai-content/prompts.ts";
import { preparePost } from "../src/features/ai-content/service.ts";
import { AiGenerationError } from "../src/features/ai-content/types.ts";
import { validatePreparedPostOutput, validatePreparePostRequest } from "../src/features/ai-content/validation.ts";
import { DRAFT_STATUSES } from "../src/features/content-studio/content-types.ts";

const evidenceId = "11111111-1111-4111-8111-111111111111";
const evidence = [{
  id: evidenceId,
  primaryTopic: "networking",
  publishedAt: "2026-10-15T00:00:00.000Z",
  publisher: "Official Network Publisher",
  summary: "A vendor describes a change to route validation behavior.",
  title: "Route validation update",
  url: "https://example.com/network-update",
  verificationStatus: "unverified",
}];

const config = {
  enabled: true,
  inputCostPerMillionUsd: 0.05,
  maxRetries: 1,
  model: "gpt-6-luna",
  monthlyBudgetMicrousd: 2_000_000,
  outputCostPerMillionUsd: 0.25,
  provider: "openai",
  requestTimeoutMs: 5_000,
};

function preparedOutput(overrides = {}) {
  return {
    worthPublishing: true,
    selectionRationale: "A concrete operational consequence makes this more useful than a broad explainer.",
    idea: {
      audience: "intermediate",
      contentAngle: "Show how a small validation decision changes which route operators trust.",
      educationalObjective: "Help operators recognize the practical boundary between receiving a route and trusting it.",
      engagementStyle: "teach",
      evidenceSourceItemIds: [evidenceId],
      formatId: "engineering-observations",
      recommendedPresentation: "standalone",
      reviewFlags: [],
      seriesKey: null,
      seriesPosition: null,
      suggestedVisual: null,
      technicalCategory: "networking",
      technicalSubject: "route validation and operational trust",
      title: "A received route is not automatically a trusted route",
      verificationStatus: "evidence_backed",
      whyUseful: "It connects a protocol detail to an operational decision engineers make every day.",
    },
    draft: {
      caption: "A router can learn a path and still refuse to trust it.\n\nThat distinction matters: reachability answers where traffic could go. Route validation helps decide whether that path deserves to be used.\n\nSame route table, very different risk.",
      evidenceSourceItemIds: [evidenceId],
      explanation: "The post distinguishes route receipt from policy and validation decisions without claiming the publisher independently verifies every route.",
      factualClaims: [{
        evidenceSourceItemIds: [evidenceId],
        kind: "sourced_fact",
        reviewStatus: "supported",
        text: "The publisher describes a route validation behavior change.",
      }],
      mediaRecommendation: {
        altText: "",
        imagePrompt: "",
        path: "text_only",
        rationale: "The contrast is clear in concise copy and does not need an illustration.",
      },
      moderatorNotes: "Confirm the exact validation behavior against the linked publisher record before publication.",
      pollOptions: [],
      reviewFlags: [],
      threadPosts: [],
      title: "Received does not mean trusted",
      verificationStatus: "evidence_backed",
      visual: null,
    },
    ...overrides,
  };
}

class MemoryStore {
  constructor() { this.active = false; this.completed = []; this.failed = []; }
  async begin(input) {
    if (this.active) throw new AiGenerationError("already_running", "active");
    this.active = true;
    this.beginInput = input;
    return { duplicate: false, runId: "run-newsroom-1" };
  }
  async complete(input) { this.active = false; this.completed.push(input); }
  async fail(input) { this.active = false; this.failed.push(input); }
}

function provider(data) {
  return {
    id: "mock-openai",
    model: "mock-gpt-6-luna",
    calls: 0,
    async generateStructured(input) {
      this.calls += 1;
      assert.equal(input.schemaName, "cloud_prepared_post");
      return { data, inputTokens: 600, outputTokens: 800, responseId: "mock-newsroom-response" };
    },
  };
}

test("Prepare a Post accepts an empty direction and produces one persisted generation result", async () => {
  const store = new MemoryStore();
  const mock = provider(preparedOutput());
  const result = await preparePost({
    config,
    evidence,
    existingContent: ["Linux pressure stall information in capacity planning"],
    ownerId: "owner",
    provider: mock,
    request: { direction: "", idempotencyKey: "prepare-post:11111111-1111-4111-8111-111111111111" },
    store,
  });
  assert.equal(result.output.idea.formatId, "engineering-observations");
  assert.equal(result.output.draft.caption.includes("trust"), true);
  assert.equal(mock.calls, 1);
  assert.equal(store.completed.length, 1);
  assert.equal(store.completed[0].suggestions.length, 1);
  assert.equal(store.beginInput.requestedCount, 1);
});

test("the newsroom prompt chooses among capabilities without turning charter examples into defaults", () => {
  const instructions = preparePostInstructions();
  assert.match(instructions, /Silently explore three meaningfully different creative approaches/);
  assert.match(instructions, /Do not default to beginner education, questions, diagrams, polls, or Ask Grok/);
  assert.match(instructions, /complete X-ready copy/);
  assert.match(instructions, /worthwhile premise/);
  assert.doesNotMatch(instructions, /server = hotel|bandwidth = road/i);
  const input = preparePostInput("", evidence, ["A prior Kubernetes rollout post"]);
  assert.match(input, /optionalOwnerDirection/);
  assert.match(input, /existingContentToAvoidRepeating/);
  assert.match(input, /untrustedRecentPublisherRecords/);
});

test("validated packages may use genuinely different premises and formats", () => {
  const observation = validatePreparedPostOutput(preparedOutput(), new Set([evidenceId]));
  const history = validatePreparedPostOutput(preparedOutput({
    selectionRationale: "The historical constraint explains a modern operational habit that otherwise looks arbitrary.",
    idea: {
      ...preparedOutput().idea,
      contentAngle: "Trace how early name-service constraints shaped later resolver behavior without claiming a single linear invention path.",
      educationalObjective: "Connect an early distributed naming problem to one carefully bounded modern resolver behavior.",
      formatId: "historical-first-principles",
      technicalCategory: "linux",
      technicalSubject: "distributed naming constraints and resolver behavior",
      title: "Why name resolution still carries old constraints",
      whyUseful: "It makes a familiar operational behavior intelligible through accurate chronology.",
    },
    draft: {
      ...preparedOutput().draft,
      caption: "Name resolution was a coordination problem before it became a command you run. Early systems had to answer a hard question: how can many machines share names without one fragile list deciding everything? Modern resolvers still carry traces of that constraint.",
      explanation: "This historical treatment requires final chronology review against the supplied publisher evidence.",
      title: "The coordination problem behind name resolution",
    },
  }), new Set([evidenceId]));
  assert.equal(observation.idea.formatId, "engineering-observations");
  assert.equal(history.idea.formatId, "historical-first-principles");
  assert.notEqual(observation.idea.technicalSubject, history.idea.technicalSubject);
  assert.notEqual(observation.draft.caption, history.draft.caption);
});

test("weak, duplicate, and typographic-dash outputs fail before persistence", async () => {
  assert.throws(
    () => validatePreparedPostOutput({ ...preparedOutput(), worthPublishing: false }, new Set([evidenceId])),
    /worthwhile publishable premise/,
  );
  assert.throws(
    () => validatePreparedPostOutput({ ...preparedOutput(), draft: { ...preparedOutput().draft, caption: "Trust — but verify." } }, new Set([evidenceId])),
    /malformed draft fields/,
  );
  const store = new MemoryStore();
  await assert.rejects(
    preparePost({
      config,
      evidence,
      existingContent: ["A received route is not automatically a trusted route route validation and operational trust"],
      ownerId: "owner",
      provider: provider(preparedOutput()),
      request: { direction: "network operations", idempotencyKey: "prepare-post:22222222-2222-4222-8222-222222222222" },
      store,
    }),
    (error) => error.code === "invalid_output",
  );
  assert.equal(store.failed[0].errorCode, "invalid_output");
});

test("newsroom editorial states are distinct from publication", () => {
  for (const status of ["ready_for_review", "needs_review", "approved", "rejected"]) {
    assert.equal(DRAFT_STATUSES.includes(status), true);
  }
  assert.equal(DRAFT_STATUSES.includes("published"), false);
});

test("owner authorization precedes newsroom generation and editorial mutations", async () => {
  const aiActions = await readFile(new URL("../src/server/ai/actions.ts", import.meta.url), "utf8");
  const contentActions = await readFile(new URL("../src/server/content/workspace-actions.ts", import.meta.url), "utf8");
  for (const [source, name, sensitive] of [
    [aiActions, "prepareAiPostAction", "runtime()"],
    [contentActions, "reviewDraftAction", "loadContentWorkspace("],
  ]) {
    const start = source.indexOf(`export async function ${name}`);
    const end = source.indexOf("export async function ", start + 24);
    const body = source.slice(start, end < 0 ? undefined : end);
    assert.ok(start >= 0, `${name} must exist`);
    assert.ok(body.indexOf("getRequiredOwnerId()") >= 0);
    assert.ok(body.indexOf("getRequiredOwnerId()") < body.indexOf(sensitive));
  }
});

test("media approval remains explicit and duplicate billable requests use idempotency", async () => {
  const component = await readFile(new URL("../src/components/content/content-studio-workspace.tsx", import.meta.url), "utf8");
  const imageActions = await readFile(new URL("../src/server/ai/image-actions.ts", import.meta.url), "utf8");
  assert.match(component, /Allow a recommended AI image/);
  assert.match(component, /maximum \$/);
  assert.match(component, /ai-image:\$\{crypto\.randomUUID\(\)\}/);
  assert.match(imageActions, /duplicate/);
  assert.match(imageActions, /getRequiredOwnerId\(\)/);
});

test("the connected Studio exposes persisted review, revision, rejection, and final-copy actions", async () => {
  const component = await readFile(new URL("../src/components/content/content-studio-workspace.tsx", import.meta.url), "utf8");
  const store = await readFile(new URL("../src/components/content/content-workspace-store.ts", import.meta.url), "utf8");
  for (const label of ["Approve", "Revise", "Reject", "Copy"]) assert.equal(component.includes(label), true);
  assert.match(component, /reviewPreparedPost\("approve"\)/);
  assert.match(component, /reviewPreparedPost\("reject"\)/);
  assert.match(component, /generateAiDraftAction/);
  assert.match(component, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(component, /posts\.join\("\\n\\n"\)/);
  assert.match(component, /url\.searchParams\.set\("draft", id\)/);
  assert.match(store, /reviewDraftAction/);
});

test("request validation is bounded and provider input remains untrusted", () => {
  assert.deepEqual(
    validatePreparePostRequest({ direction: "Prefer a Linux operations observation", idempotencyKey: "prepare-post:33333333-3333-4333-8333-333333333333" }),
    { direction: "Prefer a Linux operations observation", idempotencyKey: "prepare-post:33333333-3333-4333-8333-333333333333" },
  );
  assert.throws(() => validatePreparePostRequest({ direction: "x", idempotencyKey: "short" }), /invalid/);
});
