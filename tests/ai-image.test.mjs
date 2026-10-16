import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { prepareDraftGenerationContext } from "../src/features/ai-content/draft-context.ts";
import { generateEditorialImage } from "../src/features/ai-content/image-service.ts";
import { draftInput, draftInstructions } from "../src/features/ai-content/prompts.ts";
import { readPngDimensions } from "../src/features/content-studio/image-provider.ts";
import { getAiImagePublicStatus, readAiImageRuntimeConfig } from "../src/server/ai/image-config.ts";

const draft = {
  caption: "Old unrelated copy", createdAt: "2026-10-16T00:00:00.000Z", evidence: [], explanation: "Old notes",
  formatId: "ask-grok", id: "draft-11111111-1111-4111-8111-111111111111", ideaId: "idea-linux",
  imageAltText: "Old alt", imagePrompt: "Old image", mediaPath: "image_first", moderatorNotes: "Private answer",
  pollOptions: [], recordVersion: 3, revisions: [], status: "draft", threadPosts: [], title: "Inspect this network path",
  updatedAt: "2026-10-16T00:00:00.000Z", visual: null,
};

const idea = {
  audience: "intermediate", createdAt: draft.createdAt, educationalObjective: "Diagnose the visible route",
  engagementStyle: "challenge", evidence: [], formatId: "beginner-friendly-education", id: "idea-linux", notes: "",
  recordVersion: 1, status: "approved", subject: "A broken network route", technicalCategory: "networking", updatedAt: draft.updatedAt,
};

test("selected Ask Grok format remains authoritative when developing an attached idea", () => {
  const context = prepareDraftGenerationContext({ draft, idea, intent: "develop_current", requestedSubject: "" });
  assert.equal(context.draft.formatId, "ask-grok");
  assert.equal(context.idea.id, idea.id);
  assert.equal(context.subject, idea.subject);
  assert.match(draftInstructions(context.draft.formatId), /specific evidence visible/i);
});

test("starting a new subject detaches stale idea and content without changing selected format", () => {
  const context = prepareDraftGenerationContext({ draft, idea, intent: "new_subject", requestedSubject: "Kubernetes readiness probe failure" });
  assert.equal(context.draft.formatId, "ask-grok");
  assert.equal(context.draft.ideaId, null);
  assert.equal(context.draft.caption, "");
  assert.equal(context.draft.title, "Kubernetes readiness probe failure");
  assert.equal(context.idea, null);
});

test("image-first draft input is grounded in an inspected image description", () => {
  const input = draftInput(draft, idea, "Ask about the visible misroute", [], "develop_current", idea.subject, [], "The diagram visibly sends the private subnet to an internet gateway.");
  assert.match(input, /inspectedImageDescription/);
  assert.match(input, /private subnet to an internet gateway/);
});

test("PNG validation reads dimensions and rejects arbitrary bytes", () => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 1024);
  new DataView(bytes.buffer).setUint32(20, 1024);
  assert.deepEqual(readPngDimensions(bytes), { height: 1024, width: 1024 });
  assert.throws(() => readPngDimensions(new Uint8Array(24)), /invalid PNG/);
});

test("image generation uses one shared-budget reservation and persists only inspected metadata", async () => {
  const events = [];
  const asset = { altText: "A cloud route diagram", contentType: "image/png", createdAt: draft.createdAt, draftId: draft.id, height: 1024, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", imageDescription: "A route from a subnet to a gateway is visible.", origin: "ai_generated", provider: "openai", width: 1024 };
  const result = await generateEditorialImage({
    aspect: "square", draftId: draft.id, idempotencyKey: "ai-image:11111111-1111-4111-8111-111111111111",
    imageConfig: { enabled: true, maxEstimatedCostMicrousd: 30_000, model: "mock-image", quality: "low", requestTimeoutMs: 5_000 },
    ownerId: "owner", prompt: "A precise cloud route diagram", subject: draft.title,
    textConfig: { enabled: true, inputCostPerMillionUsd: 0.05, maxRetries: 0, model: "mock-text", monthlyBudgetMicrousd: 2_000_000, outputCostPerMillionUsd: 0.25, provider: "openai", requestTimeoutMs: 5_000 },
    provider: { id: "openai", model: "mock-image", async generate() { events.push("generate"); return { bytes: new Uint8Array([1]), contentType: "image/png", height: 1024, inputTokens: 10, model: "mock-image", outputTokens: 20, providerRequestId: "image-response", width: 1024 }; }, async inspect() { events.push("inspect"); return { altText: asset.altText, description: asset.imageDescription, fidelityWarnings: [], inputTokens: 30, outputTokens: 40, responseId: "inspection-response" }; } },
    runStore: { async begin(value) { events.push(["reserve", value.kind, value.reservationMicrousd]); return { duplicate: false, runId: "run-1" }; }, async complete(value) { events.push(["complete", value.estimatedCostMicrousd, value.inputTokens, value.outputTokens]); }, async fail() { events.push("fail"); } },
    assetStore: { async findByRun() { return null; }, async save(value) { events.push(["save", value.generationRunId, value.bytes.byteLength]); return asset; } },
  });
  assert.equal(result.asset.id, asset.id);
  assert.deepEqual(events, [["reserve", "image", 30000], "generate", "inspect", ["save", "run-1", 1], ["complete", 30000, 40, 60]]);
});

test("image generation is disabled by default and requires durable storage", () => {
  assert.equal(readAiImageRuntimeConfig({}).enabled, false);
  assert.equal(getAiImagePublicStatus({ AI_IMAGE_GENERATION_ENABLED: "true" }).reason, "missing_storage");
  assert.equal(getAiImagePublicStatus({ AI_IMAGE_GENERATION_ENABLED: "true", BLOB_STORE_ID: "store_123" }).reason, "available");
});

test("the studio persists selected format before AI generation and sends explicit intent", async () => {
  const source = await readFile(new URL("../src/components/content/content-studio-workspace.tsx", import.meta.url), "utf8");
  const start = source.indexOf("async function generateWithAi");
  const end = source.indexOf("async function generateImage", start);
  const body = source.slice(start, end);
  assert.ok(body.indexOf("workspace.saveDraft(editing)") < body.indexOf("generateAiDraftAction"));
  assert.match(body, /expectedVersion: persistedDraft\.recordVersion/);
  assert.match(body, /intent: aiIntent/);
  assert.match(body, /subject: aiIntent === "new_subject"/);
});

test("image generation and upload mutations authorize the owner and fail closed", async () => {
  const [action, upload] = await Promise.all([
    readFile(new URL("../src/server/ai/image-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/content/media/upload/route.ts", import.meta.url), "utf8"),
  ]);
  assert.ok(action.indexOf("getRequiredOwnerId()") < action.indexOf("generateEditorialImage("));
  assert.ok(upload.indexOf("getRequiredOwnerId()") < upload.indexOf("request.formData()"));
  assert.match(upload, /sameOrigin\(request\)/);
  assert.doesNotMatch(action, /OPENAI_API_KEY\s*=/);
});
