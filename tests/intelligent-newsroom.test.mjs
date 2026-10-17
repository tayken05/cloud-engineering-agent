import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { preparePostInput, preparePostInstructions } from "../src/features/ai-content/prompts.ts";
import { selectVariedEvidence } from "../src/features/ai-content/evidence-selection.ts";
import { preparePost } from "../src/features/ai-content/service.ts";
import { AiGenerationError } from "../src/features/ai-content/types.ts";
import { validatePreparedPostOutput, validatePreparePostRequest } from "../src/features/ai-content/validation.ts";
import { DRAFT_STATUSES } from "../src/features/content-studio/content-types.ts";
import { CREATIVE_OPPORTUNITY_EVALUATION } from "./fixtures/creative-opportunity-evaluation.mjs";

const evidenceId = "11111111-1111-4111-8111-111111111111";
const evidence = [{
  id: evidenceId,
  primaryTopic: "networking",
  publishedAt: "2026-10-15T00:00:00.000Z",
  publisher: "Official Network Publisher",
  publisherKind: "official_feed",
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
    candidates: [{
      centralPremise: "Receiving a network route and trusting it are separate operational decisions.",
      creativeApproach: "A concise contrast that overturns an assumption about route tables.",
      editorialRisks: ["Keep the announcement scoped to the publisher record."],
      evidenceBasis: "official_publisher_announcement",
      evidenceSourceItemIds: [evidenceId],
      formatId: "engineering-observations",
      interestingReason: "The same route can be visible yet deliberately unusable, which is a useful contradiction.",
      mediaPath: "text_only",
      proposedPresentation: "standalone",
      readerExperience: "A quick technical double take followed by a clear operational insight.",
    }, {
      centralPremise: "A fictional border officer interviews network routes about their paperwork.",
      creativeApproach: "Clearly framed personification and dry bureaucratic satire.",
      editorialRisks: ["Keep the scene unmistakably fictional."],
      evidenceBasis: "fictional_premise",
      evidenceSourceItemIds: [],
      formatId: "tech-humor-memes",
      interestingReason: "Route policy already behaves like selective admission, so bureaucracy creates recognizable comedy.",
      mediaPath: "text_only",
      proposedPresentation: "standalone",
      readerExperience: "Recognition and a concise laugh without an attached lesson.",
    }],
    selectedCandidateIndex: 0,
    selectionRationale: "A concrete operational consequence makes this more useful than a broad explainer.",
    idea: {
      audience: "intermediate",
      contentAngle: "Show how a small validation decision changes which route operators trust.",
      editorialPurpose: "Reveal a counterintuitive distinction in one concise observation.",
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
      whyInteresting: "It connects a protocol detail to an operational decision engineers make every day.",
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

function creativeMemory(overrides = {}) {
  return [{
    approach: "A compact capacity-planning discovery",
    feedback: "",
    formatId: "engineering-observations",
    hook: "Linux pressure signals expose stalled work.",
    mediaPath: "text_only",
    premise: "Pressure stall information changes how teams interpret host saturation.",
    status: "approved",
    subject: "Linux pressure stall information",
    updatedAt: "2026-10-14T00:00:00.000Z",
    visualConcept: "",
    ...overrides,
  }];
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
    creativeMemory: creativeMemory(),
    ownerId: "owner",
    provider: mock,
    request: { direction: "", idempotencyKey: "prepare-post:11111111-1111-4111-8111-111111111111" },
    store,
  });
  assert.equal(result.output.idea.formatId, "engineering-observations");
  assert.equal(result.output.candidates.length, 2);
  assert.equal(result.output.selectedCandidateIndex, 0);
  assert.equal(result.output.draft.caption.includes("trust"), true);
  assert.equal(mock.calls, 1);
  assert.equal(store.completed.length, 1);
  assert.equal(store.completed[0].suggestions.length, 1);
  assert.equal(store.beginInput.requestedCount, 1);
});

test("the real pipeline rejects lookalike candidates and accepts a truthful no-opportunity result", async () => {
  const duplicate = preparedOutput({
    candidates: [preparedOutput().candidates[0], {
      ...preparedOutput().candidates[0],
      centralPremise: preparedOutput().candidates[0].centralPremise,
      creativeApproach: preparedOutput().candidates[0].creativeApproach,
    }],
  });
  assert.throws(() => validatePreparedPostOutput(duplicate, new Set([evidenceId])), /not meaningfully distinct/);
  const noOpportunityOutput = {
    candidates: [],
    draft: null,
    idea: null,
    selectedCandidateIndex: null,
    selectionRationale: "The available facts are routine release metadata with no worthwhile premise yet.",
    worthPublishing: false,
  };
  const none = validatePreparedPostOutput(noOpportunityOutput, new Set([evidenceId]));
  assert.equal(none.worthPublishing, false);
  assert.equal(none.draft, null);
  const rejectedStore = new MemoryStore();
  await assert.rejects(preparePost({
    config, creativeMemory: creativeMemory(), evidence, ownerId: "owner", provider: provider(duplicate),
    request: { direction: "", idempotencyKey: "prepare-post:44444444-4444-4444-8444-444444444444" }, store: rejectedStore,
  }), (error) => error.code === "invalid_output");
  assert.equal(rejectedStore.failed[0].errorCode, "invalid_output");
  const emptyStore = new MemoryStore();
  const emptyResult = await preparePost({
    config, creativeMemory: creativeMemory(), evidence, ownerId: "owner", provider: provider(noOpportunityOutput),
    request: { direction: "", idempotencyKey: "prepare-post:55555555-5555-4555-8555-555555555555" }, store: emptyStore,
  });
  assert.equal(emptyResult.output.worthPublishing, false);
  assert.equal(emptyStore.completed[0].suggestions[0].verificationStatus, "needs_review");
});

test("a selected entertainment premise can remain noneducational in public copy", () => {
  const output = preparedOutput({
    candidates: [preparedOutput().candidates[1]],
    selectedCandidateIndex: 0,
    idea: {
      ...preparedOutput().idea,
      contentAngle: "A fictional border interview where a route has reachability but lacks acceptable paperwork.",
      editorialPurpose: "Create one recognizable piece of network-policy satire and stop at the punchline.",
      engagementStyle: "entertain",
      evidenceSourceItemIds: [],
      formatId: "tech-humor-memes",
      recommendedPresentation: "standalone",
      title: "Your route has been selected for additional screening",
      verificationStatus: "needs_review",
      whyInteresting: "Selective route policy maps naturally to deadpan border bureaucracy.",
    },
    draft: {
      ...preparedOutput().draft,
      caption: "Border control: Purpose of your visit?\n\nRoute: Reachability.\n\nBorder control: You have reachability. You do not have policy approval.",
      evidenceSourceItemIds: [],
      explanation: "Clearly fictional network-policy satire. The public copy ends at the punchline.",
      factualClaims: [{ evidenceSourceItemIds: [], kind: "hypothetical_example", reviewStatus: "supported", text: "The border interview is fictional." }],
      title: "Additional screening",
      verificationStatus: "needs_review",
    },
  });
  const result = validatePreparedPostOutput(output, new Set([evidenceId]));
  assert.equal(result.idea.editorialPurpose.includes("satire"), true);
  assert.doesNotMatch(result.draft.caption, /lesson|takeaway|what do you think/i);
});

test("creative memory sends rejection feedback and varied evidence avoids newest-publisher monoculture", () => {
  const input = preparePostInput("", evidence, creativeMemory({ feedback: "Too much explanation after the punchline." }));
  assert.match(input, /Too much explanation after the punchline/);
  const pool = [
    { ...evidence[0], id: "11111111-1111-4111-8111-111111111110", publisher: "Provider A", primaryTopic: "cloud_engineering" },
    { ...evidence[0], id: "11111111-1111-4111-8111-111111111109", publisher: "Provider A", primaryTopic: "cloud_engineering" },
    { ...evidence[0], id: "11111111-1111-4111-8111-111111111108", publisher: "Provider B", primaryTopic: "linux" },
  ];
  const selected = selectVariedEvidence(pool, 2);
  assert.deepEqual(selected.map((item) => item.publisher), ["Provider A", "Provider B"]);
});

test("official announcements require publisher provenance and unverified claims stay in review", async () => {
  const communityEvidence = [{ ...evidence[0], publisherKind: "community" }];
  await assert.rejects(preparePost({
    config, creativeMemory: creativeMemory(), evidence: communityEvidence, ownerId: "owner", provider: provider(preparedOutput()),
    request: { direction: "", idempotencyKey: "prepare-post:66666666-6666-4666-8666-666666666666" }, store: new MemoryStore(),
  }), (error) => error.code === "invalid_output");
  const unverified = preparedOutput({
    candidates: [{ ...preparedOutput().candidates[0], evidenceBasis: "unverified_claim" }],
  });
  const checked = validatePreparedPostOutput(unverified, new Set([evidenceId]));
  assert.equal(checked.draft.verificationStatus, "needs_review");
  assert.match(checked.draft.reviewFlags.join(" "), /unverified claim/i);
});

test("the newsroom prompt chooses among capabilities without turning charter examples into defaults", () => {
  const instructions = preparePostInstructions();
  assert.match(instructions, /Return zero to three compact creative candidates/);
  assert.match(instructions, /Three explanations with different titles are one candidate/);
  assert.match(instructions, /Do not default to beginner education, questions, diagrams, polls, or Ask Grok/);
  assert.match(instructions, /complete X-ready copy/);
  assert.match(instructions, /nothing deserves a post/);
  assert.doesNotMatch(instructions, /server = hotel|bandwidth = road/i);
  const input = preparePostInput("", evidence, creativeMemory());
  assert.match(input, /optionalOwnerDirection/);
  assert.match(input, /compactCreativeMemory/);
  assert.match(input, /untrustedVariedPublisherRecords/);
});

test("validated packages may use genuinely different premises and formats", () => {
  const observation = validatePreparedPostOutput(preparedOutput(), new Set([evidenceId]));
  const history = validatePreparedPostOutput(preparedOutput({
    candidates: [{
      ...preparedOutput().candidates[0],
      centralPremise: "Old coordination limits still shape how modern resolvers behave.",
      creativeApproach: "A carefully sourced historical narrative driven by constraints.",
      formatId: "historical-first-principles",
      proposedPresentation: "thread",
    }],
    selectedCandidateIndex: 0,
    selectionRationale: "The historical constraint explains a modern operational habit that otherwise looks arbitrary.",
    idea: {
      ...preparedOutput().idea,
      contentAngle: "Trace how early name-service constraints shaped later resolver behavior without claiming a single linear invention path.",
      editorialPurpose: "Tell a historically accurate story that makes a modern resolver behavior feel less arbitrary.",
      formatId: "historical-first-principles",
      recommendedPresentation: "thread",
      technicalCategory: "linux",
      technicalSubject: "distributed naming constraints and resolver behavior",
      title: "Why name resolution still carries old constraints",
      whyInteresting: "It makes a familiar operational behavior intelligible through accurate chronology.",
    },
    draft: {
      ...preparedOutput().draft,
      caption: "",
      explanation: "This historical treatment requires final chronology review against the supplied publisher evidence.",
      threadPosts: ["Name resolution was a coordination problem before it became a command you run.", "Many machines needed shared names without one fragile list deciding everything. Modern resolvers still carry traces of that constraint."],
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
    /rejected opportunity/,
  );
  assert.throws(
    () => validatePreparedPostOutput({ ...preparedOutput(), draft: { ...preparedOutput().draft, caption: "Trust — but verify." } }, new Set([evidenceId])),
    /malformed draft fields/,
  );
  assert.throws(
    () => validatePreparedPostOutput({ ...preparedOutput(), draft: { ...preparedOutput().draft, caption: "x".repeat(281) } }, new Set([evidenceId])),
    /weighted character limits/,
  );
  const store = new MemoryStore();
  await assert.rejects(
    preparePost({
      config,
      evidence,
      creativeMemory: creativeMemory({ premise: "Receiving a network route and trusting it are separate operational decisions.", subject: "Route validation and trust" }),
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

test("the unseen creative evaluation set covers opportunity, uncertainty, repetition, and rejection", () => {
  assert.equal(CREATIVE_OPPORTUNITY_EVALUATION.length, 9);
  assert.equal(new Set(CREATIVE_OPPORTUNITY_EVALUATION.map((scenario) => scenario.id)).size, 9);
  for (const id of ["official-cloud-news", "surprising-linux-behavior", "historical-event", "engineering-culture-humor", "visual-opportunity", "playful-grok", "conflicting-evidence", "recently-covered", "accurate-but-boring"]) {
    assert.equal(CREATIVE_OPPORTUNITY_EVALUATION.some((scenario) => scenario.id === id), true);
  }
  assert.equal(CREATIVE_OPPORTUNITY_EVALUATION.some((scenario) => /zero worthwhile candidates/i.test(scenario.expectedDecision)), true);
});
