import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { loadDevelopmentCredential } from "./source-catalog-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const credential = await loadDevelopmentCredential(root);
process.env.DATABASE_URL = credential.pooledConnectionString;
const { ContentConflictError, importContentWorkspace, loadContentWorkspace, restoreDraftRevision, saveContentDraft, saveContentIdea } = await import("../src/server/content/workspace-repository.ts");

const ownerId = `task12_test_${crypto.randomUUID().replaceAll("-", "_")}`;
const suffix = crypto.randomUUID();
const ideaId = `idea-${suffix}`;
const draftId = `draft-${suffix}`;
const now = new Date().toISOString();
const idea = { audience: "beginner", createdAt: now, educationalObjective: "Verify private persistence without retaining test data.", engagementStyle: "teach", evidence: [], formatId: "beginner-friendly-education", id: ideaId, notes: "Transactional development verification.", recordVersion: 1, status: "approved", subject: `Task 12 verification ${suffix}`, technicalCategory: "cloud_engineering", updatedAt: now };
const visual = { accent: "blue", aspect: "square", caption: "Verified", footer: "Test", leftLabel: "Input", rightLabel: "Output", subtitle: "Development-only verification", templateId: "cloud-architecture", title: "Persistence check" };
const draft = { caption: "A development-only persistence test.", createdAt: now, evidence: [], explanation: "No production data is involved.", formatId: "beginner-friendly-education", id: draftId, ideaId, moderatorNotes: "", pollOptions: [], recordVersion: 1, revisions: [], status: "draft", threadPosts: [], title: "Persistence check", updatedAt: now, visual };

const pool = new Pool({ connectionString: credential.connectionString, connectionTimeoutMillis: 15_000, max: 1 });
const keepAlive = setTimeout(() => undefined, 120_000);
try {
  console.log("Development persistence check connected to the validated endpoint.");
  await saveContentIdea(ownerId, idea);
  console.log("Development persistence check saved an owner-scoped idea.");
  await saveContentDraft(ownerId, draft);
  console.log("Development persistence check saved an owner-scoped draft.");
  let workspace = await loadContentWorkspace(ownerId);
  assert.equal(workspace.ideas.length, 1); assert.equal(workspace.drafts.length, 1); assert.deepEqual(workspace.drafts[0].visual, visual);
  await saveContentDraft(ownerId, { ...workspace.drafts[0], caption: "A newer cross-device-safe version." });
  workspace = await loadContentWorkspace(ownerId);
  assert.equal(workspace.drafts[0].recordVersion, 2); assert.equal(workspace.drafts[0].revisions.length, 1);
  await assert.rejects(() => saveContentDraft(ownerId, draft), ContentConflictError);
  await restoreDraftRevision(ownerId, draftId, workspace.drafts[0].revisions[0].id, 2);
  workspace = await loadContentWorkspace(ownerId); assert.equal(workspace.drafts[0].recordVersion, 3); assert.equal(workspace.drafts[0].caption, draft.caption);
  const imported = await importContentWorkspace(ownerId, { version: 1, ideas: [idea], drafts: [draft] });
  assert.deepEqual(imported, { imported: 0, skipped: 2, failed: 0 });
  console.log("Development content persistence verified: ownership, reload, visual specification, revisions, restore, optimistic concurrency, and idempotent import.");
} finally {
  const client = await pool.connect();
  try { await client.query("DELETE FROM public.content_drafts WHERE owner_id=$1", [ownerId]); await client.query("DELETE FROM public.content_ideas WHERE owner_id=$1", [ownerId]); } finally { client.release(); await pool.end(); clearTimeout(keepAlive); }
}
