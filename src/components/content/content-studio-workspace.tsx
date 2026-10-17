"use client";

import Image from "next/image";
import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";

import type { AiDraftIntent, AiPublicStatus } from "@/features/ai-content/types";
import { aiStatusLabel, aiStatusMessage } from "@/features/ai-content/status-copy";
import { CONTENT_FORMATS, getContentFormat, type ContentFormatId } from "@/features/content-studio/content-formats";
import type { ContentDraft, ContentWorkspaceState, EvidenceOption } from "@/features/content-studio/content-types";
import type { ContentMediaAsset, ContentMediaPath } from "@/features/content-studio/content-types";
import {
  countXCharacters,
  createDefaultVisual,
  validateDraft,
  X_POST_CHARACTER_LIMIT,
  X_POLL_OPTION_LIMIT,
} from "@/features/content-studio/content-workspace";
import { useContentWorkspace } from "./content-workspace-store";
import { VisualCreator } from "./visual-creator";
import { generateAiDraftAction, prepareAiPostAction } from "@/server/ai/actions";
import { generateAiImageAction } from "@/server/ai/image-actions";
import type { AiImagePublicStatus } from "@/server/ai/image-config";

const NEWSROOM_IMAGE_APPROVAL_KEY = "cloud-engineering-agent:newsroom-image-approval:v1";
const NEWSROOM_IMAGE_APPROVAL_EVENT = "cloud-engineering-agent:image-approval-changed";

function subscribeImageApproval(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === NEWSROOM_IMAGE_APPROVAL_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(NEWSROOM_IMAGE_APPROVAL_EVENT, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(NEWSROOM_IMAGE_APPROVAL_EVENT, notify);
  };
}

function readImageApproval() {
  return window.localStorage.getItem(NEWSROOM_IMAGE_APPROVAL_KEY) === "approved";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatName(value: string): string {
  return value.replaceAll("_", " ").replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function noteValue(notes: string, label: string): string {
  const line = notes.split("\n").find((entry) => entry.startsWith(label));
  return line?.slice(label.length).trim() ?? "";
}

function editorialStatusClass(status: ContentDraft["status"]): string {
  if (status === "approved" || status === "ready_for_review") return "status-chip status-safe";
  if (status === "rejected") return "status-chip status-rejected";
  return "status-chip";
}

function Counter({ value, limit = X_POST_CHARACTER_LIMIT }: { value: string; limit?: number }) {
  const count = countXCharacters(value);
  return <span className={count > limit ? "character-count character-count-over" : "character-count"}>{count}/{limit}</span>;
}

function XPreview({ draft }: { draft: ContentDraft }) {
  const posts = draft.threadPosts.filter((post) => post.trim());
  const displayPosts = posts.length > 0 ? posts : draft.caption.trim() ? [draft.caption] : [];
  return (
    <section className="studio-panel x-preview" aria-labelledby="x-preview-heading">
      <div className="studio-panel-heading">
        <div><p className="eyebrow">Presentation preview</p><h2 id="x-preview-heading">X draft preview</h2></div>
        <span className="status-chip">No publishing connection</span>
      </div>
      {displayPosts.length > 0 ? (
        <ol className="x-post-list">
          {displayPosts.map((post, index) => (
            <li key={`${index}-${post.slice(0, 16)}`}>
              <div className="x-avatar" aria-hidden="true">CE</div>
              <div><p className="x-author">Cloud Engineering Agent <span>@account-not-connected</span></p><p className="x-copy">{post}</p>{displayPosts.length > 1 ? <small>{index + 1}/{displayPosts.length}</small> : null}</div>
            </li>
          ))}
        </ol>
      ) : <div className="studio-state">Write a caption or thread to preview it here.</div>}
      {draft.formatId === "polls-interactive-questions" ? (
        <div className="poll-preview">{draft.pollOptions.filter(Boolean).map((option) => <span key={option}>{option}</span>)}</div>
      ) : null}
      {draft.formatId === "ask-grok" ? <p className="truth-note">Prepared conversation starter only. No Grok response has been requested or received.</p> : null}
    </section>
  );
}

export function ContentStudioWorkspace({
  aiStatus,
  imageStatus,
  initialMediaAssets,
  evidenceOptions,
  evidenceUnavailable,
  initialDraftId,
  initialState,
}: {
  aiStatus: AiPublicStatus;
  imageStatus: AiImagePublicStatus;
  initialMediaAssets: readonly ContentMediaAsset[];
  evidenceOptions: readonly EvidenceOption[];
  evidenceUnavailable: boolean;
  initialDraftId?: string;
  initialState: ContentWorkspaceState;
}) {
  const workspace = useContentWorkspace(initialState);
  const [selectedId, setSelectedId] = useState(initialDraftId ?? "");
  const [draftEdits, setDraftEdits] = useState<Readonly<Record<string, ContentDraft>>>({});
  const [feedback, setFeedback] = useState<string>("");
  const [reviewProblems, setReviewProblems] = useState<readonly string[]>([]);
  const [aiAngle, setAiAngle] = useState("");
  const [aiIntent, setAiIntent] = useState<AiDraftIntent>("new_subject");
  const [aiSubject, setAiSubject] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [newDraftFormat, setNewDraftFormat] = useState<ContentFormatId>("beginner-friendly-education");
  const [mediaAssets, setMediaAssets] = useState(initialMediaAssets);
  const [imageAspect, setImageAspect] = useState<"square" | "landscape">("landscape");
  const [imageBusy, setImageBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [prepareBusy, setPrepareBusy] = useState(false);
  const [prepareDirection, setPrepareDirection] = useState("");
  const [prepareProgress, setPrepareProgress] = useState("");
  const [revisionDirection, setRevisionDirection] = useState("");
  const allowRecommendedImage = useSyncExternalStore(subscribeImageApproval, readImageApproval, () => false);

  const storedDraft = workspace.state?.drafts.find((draft) => draft.id === selectedId)
    ?? workspace.state?.drafts.find((draft) => draft.id === initialDraftId)
    ?? workspace.state?.drafts[0]
    ?? null;
  const editing = storedDraft ? draftEdits[storedDraft.id] ?? storedDraft : null;
  const selectedIdea = editing?.ideaId ? workspace.state.ideas.find((idea) => idea.id === editing.ideaId) ?? null : null;

  const format = editing ? getContentFormat(editing.formatId) : null;
  const preparedAssets = editing ? mediaAssets.filter((asset) => asset.draftId === editing.id) : [];
  const hasFinishedCopy = Boolean(editing && (editing.caption.trim() || editing.threadPosts.some((post) => post.trim())));
  const evidencePool = useMemo(() => new Map([
    ...evidenceOptions.map((item) => [item.id, item] as const),
    ...(editing?.evidence ?? []).map((item) => [item.id, item] as const),
  ]), [editing?.evidence, evidenceOptions]);

  function rememberSelectedDraft(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("draft", id);
    window.history.replaceState({}, "", url);
  }

  function selectDraft(id: string) {
    setSelectedId(id);
    const selected = workspace.state.drafts.find((draft) => draft.id === id);
    setAiIntent(selected?.ideaId ? "develop_current" : "new_subject");
    setAiSubject(selected?.ideaId ? "" : selected?.title ?? "");
    setAiAngle("");
    setFeedback("");
    setReviewProblems([]);
    rememberSelectedDraft(id);
  }

  function setImageApproval(approved: boolean) {
    if (approved) window.localStorage.setItem(NEWSROOM_IMAGE_APPROVAL_KEY, "approved");
    else window.localStorage.removeItem(NEWSROOM_IMAGE_APPROVAL_KEY);
    window.dispatchEvent(new Event(NEWSROOM_IMAGE_APPROVAL_EVENT));
  }

  function update<K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) {
    if (!editing) return;
    setDraftEdits((current) => ({
      ...current,
      [editing.id]: { ...editing, [key]: value, status: key === "status" ? editing.status : "draft" },
    }));
  }

  function changeFormat(formatId: ContentFormatId) {
    if (!editing) return;
    const next = getContentFormat(formatId);
    setDraftEdits((current) => ({ ...current, [editing.id]: {
      ...editing,
      formatId,
      pollOptions: next.mode === "poll" && editing.pollOptions.length < 2 ? ["", ""] : editing.pollOptions,
      status: "draft",
      threadPosts: next.mode === "thread" && editing.threadPosts.length < 2 ? ["", ""] : editing.threadPosts,
    } }));
  }

  async function newDraft() {
    const id = await workspace.createDraft(newDraftFormat);
    if (id) {
      setSelectedId(id); setAiIntent("new_subject"); setAiSubject(""); setAiAngle("");
      rememberSelectedDraft(id);
      setFeedback(`New ${getContentFormat(newDraftFormat).label} draft saved to the private workspace.`);
    }
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!editing) return;
    const result = await workspace.saveDraft(editing);
    if (!result.ok) { setFeedback(result.error ?? "Save failed."); return; }
    setDraftEdits((current) => {
      const next: Record<string, ContentDraft> = { ...current };
      delete next[editing.id];
      return next;
    });
    setFeedback("Draft saved to PostgreSQL. A revision checkpoint was added when the content changed.");
    setReviewProblems([]);
  }

  async function markReady() {
    if (!editing) return;
    const problems = validateDraft(editing);
    setReviewProblems(problems);
    if (problems.length > 0) {
      setFeedback("Resolve the review checks before marking this draft ready.");
      return;
    }
    const ready = { ...editing, status: "ready_for_review" as const };
    const result = await workspace.saveDraft(ready);
    if (!result.ok) { setFeedback(result.error ?? "Save failed."); return; }
    setDraftEdits((current) => {
      const next: Record<string, ContentDraft> = { ...current };
      delete next[editing.id];
      return next;
    });
    setFeedback("Draft marked ready for future human publication review. Nothing was published.");
  }

  async function copyDraft() {
    if (!editing) return;
    const posts = editing.threadPosts.filter((post) => post.trim());
    const text = posts.length > 0
      ? posts.join("\n\n")
      : editing.caption;
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Finished text copied to the clipboard.");
    } catch {
      setFeedback("Clipboard access was unavailable. Select the preview text and copy it manually.");
    }
  }

  async function prepareOnePost() {
    if (!aiStatus.available || prepareBusy) return;
    setPrepareBusy(true);
    setPrepareProgress("Finding a worthwhile opportunity, checking content history, and developing the strongest approach…");
    setFeedback("");
    try {
      const result = await prepareAiPostAction({
        direction: prepareDirection.trim(),
        idempotencyKey: `prepare-post:${crypto.randomUUID()}`,
      });
      if (result.ok && result.noOpportunity) {
        if (result.state) workspace.replaceState(result.state);
        setPrepareProgress(result.message ?? "The newsroom found no premise strong enough to prepare. No draft was created and no image was requested.");
        return;
      }
      if (!result.ok || !result.state || !result.draftId) {
        setPrepareProgress(result.error ?? "The newsroom could not prepare a validated post.");
        return;
      }
      workspace.replaceState(result.state);
      setSelectedId(result.draftId);
      setDraftEdits({});
      setReviewProblems([]);
      setRevisionDirection("");
      rememberSelectedDraft(result.draftId);
      const preparedDraft = result.state.drafts.find((draft) => draft.id === result.draftId);
      if (!preparedDraft) {
        setPrepareProgress("The post was saved, but the refreshed workspace did not return it. Reload the page to continue.");
        return;
      }
      if (preparedDraft.mediaPath !== "text_only" && allowRecommendedImage && imageStatus.available) {
        setPrepareProgress(`The post is saved. Generating and inspecting its recommended image with a maximum $${imageStatus.maxEstimatedCostUsd.toFixed(2)} application reservation…`);
        const imageResult = await generateAiImageAction({
          aspect: imageAspect,
          draftId: preparedDraft.id,
          expectedVersion: preparedDraft.recordVersion,
          idempotencyKey: `ai-image:${crypto.randomUUID()}`,
        });
        if (imageResult.ok && imageResult.asset) {
          if (imageResult.state) workspace.replaceState(imageResult.state);
          setMediaAssets((current) => [imageResult.asset!, ...current.filter((asset) => asset.id !== imageResult.asset!.id)]);
          setPrepareProgress(imageResult.warning ?? "Complete post package prepared, inspected, saved, and ready for editorial review.");
        } else {
          setPrepareProgress(`${imageResult.error ?? "The image request did not complete."} The saved text remains available for review, and no image is shown as generated.`);
        }
      } else if (preparedDraft.mediaPath !== "text_only") {
        const reason = imageStatus.available
          ? `Image generation was not authorized for this request. Enable the reusable image allowance below or use Generate image after reviewing the brief.`
          : "AI image generation or private storage is unavailable. The completed text is saved, and the media recommendation remains clearly marked as pending.";
        setPrepareProgress(`Post prepared and saved. ${reason}`);
      } else {
        setPrepareProgress("Complete text-only post prepared, saved, and ready for editorial review.");
      }
    } catch {
      setPrepareProgress("The authenticated newsroom request failed without recording a successful post.");
    } finally {
      setPrepareBusy(false);
    }
  }

  async function reviewPreparedPost(decision: "approve" | "reject") {
    if (!editing) return;
    const note = decision === "reject" ? window.prompt("Optional feedback for this rejected post:", "") ?? "" : "";
    const result = await workspace.reviewDraft(editing.id, editing.recordVersion, decision, note);
    if (result.ok) {
      setDraftEdits({});
      setFeedback(decision === "approve" ? "Post approved for the future manual publishing workflow. Nothing was published to X." : "Post rejected and retained with its history.");
    } else setFeedback(result.error ?? "The editorial decision could not be saved.");
  }

  async function revisePreparedPost() {
    if (!editing || !aiStatus.available || aiBusy) return;
    setAiBusy(true);
    setFeedback("Saving the current version before preparing a revision…");
    try {
      const saved = await workspace.saveDraft(editing);
      if (!saved.ok || !("state" in saved) || !saved.state) {
        setFeedback(saved.error ?? "The current version could not be saved before revision.");
        return;
      }
      const persisted = saved.state.drafts.find((draft) => draft.id === editing.id);
      if (!persisted) {
        setFeedback("The current version could not be found after saving.");
        return;
      }
      const result = await generateAiDraftAction({
        angle: revisionDirection.trim() || "Develop a meaningfully different treatment of the same worthwhile premise. Vary the hook, structure, and emphasis without changing supported facts.",
        draftId: persisted.id,
        expectedVersion: persisted.recordVersion,
        idempotencyKey: `ai-draft:${crypto.randomUUID()}`,
        intent: "develop_current",
        subject: "",
      });
      if (!result.ok || !result.state) {
        setFeedback(result.error ?? "The revision did not complete. The saved version remains unchanged.");
        return;
      }
      workspace.replaceState(result.state);
      setDraftEdits({});
      setRevisionDirection("");
      setFeedback("Revised post saved. The previous copy remains available in revision history.");
    } catch {
      setFeedback("The authenticated revision request failed. The saved version remains available.");
    } finally {
      setAiBusy(false);
    }
  }

  async function generateWithAi() {
    if (!editing || !aiStatus.available) return;
    if (aiIntent === "new_subject" && !aiSubject.trim()) {
      setFeedback("Name the new technical subject before generating. AI will not guess a topic for a blank draft.");
      return;
    }
    setAiBusy(true);
    setFeedback("Saving the selected format before starting the AI request…");
    try {
      const saved = await workspace.saveDraft(editing);
      if (!saved.ok || !saved.state) {
        setFeedback(saved.error ?? "The selected format could not be saved before generation.");
        return;
      }
      const persistedDraft = saved.state.drafts.find((draft) => draft.id === editing.id);
      if (!persistedDraft) {
        setFeedback("The saved draft could not be reloaded for generation.");
        return;
      }
      setFeedback("Generating a validated draft with the server-only AI provider…");
      const result = await generateAiDraftAction({
        angle: aiAngle.trim(),
        draftId: persistedDraft.id,
        expectedVersion: persistedDraft.recordVersion,
        idempotencyKey: `ai-draft:${crypto.randomUUID()}`,
        intent: aiIntent,
        subject: aiIntent === "new_subject" ? aiSubject.trim() : "",
      });
      if (!result.ok || !result.state) {
        setFeedback(result.error ?? "AI drafting failed without changing the saved draft.");
        return;
      }
      workspace.replaceState(result.state);
      setDraftEdits((current) => {
        const next: Record<string, ContentDraft> = { ...current };
        delete next[editing.id];
        return next;
      });
      setReviewProblems([]);
      setAiSubject("");
      setFeedback("AI-assisted draft saved with a revision checkpoint. Review every technical claim before approval.");
    } catch {
      setFeedback("The authenticated AI drafting request failed without changing the saved draft.");
    } finally {
      setAiBusy(false);
    }
  }

  async function generateImage() {
    if (!editing || !imageStatus.available || editing.mediaPath === "text_only") return;
    setImageBusy(true);
    setFeedback(`Preparing one ${editing.mediaPath === "image_first" ? "image-first content package" : "supporting image"}. The server may reserve up to $${imageStatus.maxEstimatedCostUsd.toFixed(2)} from the shared allowance.`);
    try {
      const saved = await workspace.saveDraft(editing);
      const persisted = "state" in saved ? saved.state?.drafts.find((draft: ContentDraft) => draft.id === editing.id) : undefined;
      if (!saved.ok || !persisted) { setFeedback(("error" in saved ? saved.error : undefined) ?? "Save the image brief before generation."); return; }
      const result = await generateAiImageAction({ aspect: imageAspect, draftId: persisted.id, expectedVersion: persisted.recordVersion, idempotencyKey: `ai-image:${crypto.randomUUID()}` });
      if (!result.ok || !result.asset) { setFeedback(result.error ?? "Image generation did not complete."); return; }
      if (result.state) workspace.replaceState(result.state);
      setMediaAssets((current) => [result.asset!, ...current.filter((asset) => asset.id !== result.asset!.id)]);
      setDraftEdits((current) => { const next = { ...current }; delete next[editing.id]; return next; });
      setFeedback(result.warning ?? (result.groundedDraftSaved ? "The image was generated, inspected, stored privately, and used to create a grounded draft. Review the image and every claim." : "The supporting image was generated, inspected, and stored privately. Review it before use."));
    } catch {
      setFeedback("The authenticated image request failed without recording a successful generation.");
    } finally { setImageBusy(false); }
  }

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("draftId", editing.id);
    setUploadBusy(true);
    try {
      const response = await fetch("/api/content/media/upload", { body: data, method: "POST" });
      const body = await response.json() as { asset?: ContentMediaAsset; error?: string };
      if (!response.ok || !body.asset) { setFeedback(body.error ?? "The image upload failed."); return; }
      setMediaAssets((current) => [body.asset!, ...current]);
      form.reset();
      setFeedback("The owner-provided PNG was stored privately and attached to this draft. Its description still requires editorial review.");
    } catch { setFeedback("The authenticated image upload failed."); }
    finally { setUploadBusy(false); }
  }

  return (
    <div className="content-workspace">
      <aside className="operator-notice"><div><strong>Persistent private drafting</strong><p>Saves complete on the server before confirmation. Version checks prevent a second browser session from silently replacing a newer draft.</p></div><span className="status-chip status-safe">Human review required</span></aside>
      {workspace.storageError ? <p className="studio-alert" role="alert">{workspace.storageError}</p> : null}

      <section className="studio-panel newsroom-command" aria-labelledby="prepare-post-heading">
        <div className="studio-panel-heading">
          <div><p className="eyebrow">Intelligent Cloud Newsroom</p><h2 id="prepare-post-heading">Prepare one complete post</h2></div>
          <span className={aiStatus.available ? "status-chip status-safe" : "status-chip"}>{aiStatusLabel(aiStatus)}</span>
        </div>
        <p className="newsroom-lede">The newsroom chooses a worthwhile subject, checks your content history, develops the strongest treatment, verifies what it can, and saves finished X-ready copy. A topic or format is optional.</p>
        {aiStatus.available ? <>
          <label className="newsroom-direction">Optional subject or direction
            <textarea rows={2} maxLength={500} value={prepareDirection} onChange={(event) => setPrepareDirection(event.target.value)} placeholder="Leave blank for autonomous discovery, or add a light direction such as Linux, cloud security, or something playful." />
          </label>
          <label className={imageStatus.available ? "newsroom-image-consent" : "newsroom-image-consent is-disabled"}>
            <input type="checkbox" checked={allowRecommendedImage} disabled={!imageStatus.available} onChange={(event) => setImageApproval(event.target.checked)} />
            <span><strong>Allow a recommended AI image</strong><small>{imageStatus.available ? `Remember this owner approval on this device. Each prepared post may use at most one image request with up to $${imageStatus.maxEstimatedCostUsd.toFixed(2)} reserved from the shared $2 allowance.` : "Image generation or private media storage is unavailable. Text preparation still works."}</small></span>
          </label>
          <div className="newsroom-command-row">
            <button type="button" className="primary-action newsroom-primary-action" disabled={prepareBusy || workspace.busy || aiBusy || imageBusy} onClick={prepareOnePost}>{prepareBusy ? "Preparing your post…" : "Prepare a Post"}</button>
            <span className="field-note">One click creates one saved editorial package. It never publishes to X.</span>
          </div>
        </> : <div className="studio-state"><strong>AI preparation is unavailable</strong><p>{aiStatusMessage(aiStatus)}</p></div>}
        {prepareProgress ? <p className="newsroom-progress" role="status" aria-live="polite">{prepareProgress}</p> : null}
      </section>

      {editing && hasFinishedCopy ? <section className="studio-panel newsroom-result" aria-labelledby="prepared-post-heading">
        <div className="studio-panel-heading">
          <div><p className="eyebrow">Selected content package</p><h2 id="prepared-post-heading">{editing.title || "Prepared post"}</h2></div>
          <span className={editorialStatusClass(editing.status)}>{formatName(editing.status)}</span>
        </div>
        <XPreview draft={editing} />
        {preparedAssets.length > 0 ? <div className="newsroom-media">
          {preparedAssets.map((asset) => <figure key={asset.id}>
            <Image unoptimized src={`/api/content/media/${asset.id}`} alt={asset.altText} width={asset.width} height={asset.height} />
            <figcaption>{asset.origin === "ai_generated" ? "AI-generated and inspected editorial image" : "Owner-provided editorial image"}. {asset.imageDescription}</figcaption>
          </figure>)}
        </div> : editing.mediaPath !== "text_only" ? <div className="newsroom-media-pending">
          <strong>Recommended image has not been generated</strong>
          <p>The post remains saved. No visual description is being presented as an actual image.</p>
          <button type="button" className="secondary-action" disabled={!imageStatus.available || imageBusy || workspace.busy || !editing.imagePrompt.trim()} onClick={generateImage}>{imageBusy ? "Generating and inspecting…" : imageStatus.available ? `Generate image, up to $${imageStatus.maxEstimatedCostUsd.toFixed(2)}` : "Image generation unavailable"}</button>
        </div> : null}
        <div className="newsroom-review-actions">
          <button type="button" className="primary-action" disabled={workspace.busy || editing.status === "approved"} onClick={() => reviewPreparedPost("approve")}>{editing.status === "approved" ? "Approved" : "Approve"}</button>
          <button type="button" className="secondary-action" disabled={aiBusy || workspace.busy || !aiStatus.available} onClick={revisePreparedPost}>{aiBusy ? "Revising…" : "Revise"}</button>
          <button type="button" className="quiet-action" disabled={workspace.busy || editing.status === "rejected"} onClick={() => reviewPreparedPost("reject")}>{editing.status === "rejected" ? "Rejected" : "Reject"}</button>
          <button type="button" className="secondary-action" onClick={copyDraft}>Copy</button>
        </div>
        <label className="newsroom-revision-direction">Optional revision direction
          <input maxLength={500} value={revisionDirection} onChange={(event) => setRevisionDirection(event.target.value)} placeholder="Leave blank for a genuinely different treatment, or describe what should change." />
        </label>
        <details className="newsroom-review-details">
          <summary>Evidence and technical review</summary>
          <div>
            {selectedIdea ? <><h3>Why this treatment</h3><p>{noteValue(selectedIdea.notes, "Selected premise:") || selectedIdea.educationalObjective}</p><p><strong>Creative approach:</strong> {noteValue(selectedIdea.notes, "Creative approach:") || "Not recorded for this earlier draft."}</p></> : null}
            <h3>Supporting publisher records</h3>
            {editing.evidence.length ? <ul>{editing.evidence.map((item) => <li key={item.id}><a href={item.url} target="_blank" rel="noreferrer">{item.publisher}: {item.title}</a></li>)}</ul> : <p>No publisher record supports this evergreen package. Factual claims require owner review.</p>}
            <h3>Technical explanation</h3><p className="preserve-lines">{editing.explanation}</p>
            <h3>Private review notes</h3><p className="preserve-lines">{editing.moderatorNotes || "No additional review notes."}</p>
          </div>
        </details>
        <p className="field-note" aria-live="polite">{feedback || `Saved version ${editing.recordVersion}. Last updated ${formatDate(editing.updatedAt)}.`}</p>
      </section> : <div className="studio-state newsroom-empty"><strong>No prepared post selected</strong><p>Use Prepare a Post above. The finished result will appear here without a manual setup form.</p></div>}

      <details className="manual-workspace" open={!hasFinishedCopy}>
        <summary>Manual drafting and advanced tools</summary>
        <div className="manual-workspace-body">

      <section className="draft-toolbar" aria-label="Draft selection">
        <label>Working draft
          <select value={editing?.id ?? ""} onChange={(event) => selectDraft(event.target.value)}>
            {workspace.state.drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.title || "Untitled draft"} · {formatName(draft.status)}</option>)}
          </select>
        </label>
        <label>New draft format
          <select value={newDraftFormat} onChange={(event) => setNewDraftFormat(event.target.value as ContentFormatId)}>
            {CONTENT_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" className="secondary-action" disabled={workspace.busy} onClick={newDraft}>New blank draft</button>
      </section>

      {editing && format ? (
        <>
          <section className="studio-panel ai-workspace-panel" aria-labelledby="ai-draft-heading">
            <div className="studio-panel-heading">
              <div><p className="eyebrow">AI drafting assistant</p><h2 id="ai-draft-heading">Build a deliberate content package</h2></div>
              <span className={aiStatus.available ? "status-chip status-safe" : "status-chip"}>{aiStatusLabel(aiStatus)}</span>
            </div>
            {aiStatus.available ? (
              <div className="draft-fields">
                <label>Generation goal
                  <select value={aiIntent} onChange={(event) => setAiIntent(event.target.value as AiDraftIntent)}>
                    <option value="new_subject">Start a completely new subject</option>
                    <option value="develop_current" disabled={!editing.ideaId && !editing.title.trim()}>Create a different version of the current idea or draft</option>
                  </select>
                </label>
                {aiIntent === "new_subject" ? (
                  <label className="wide-field">New technical subject
                    <input maxLength={300} value={aiSubject} onChange={(event) => setAiSubject(event.target.value)} placeholder="Example: Why Linux namespaces matter to containers" />
                    <span className="field-note">Required. Starting a new subject detaches this draft from any earlier idea and does not reuse its copy.</span>
                  </label>
                ) : (
                  <p className="field-note wide-field">This creates a new treatment of <strong>{editing.ideaId ? workspace.state.ideas.find((idea) => idea.id === editing.ideaId)?.subject ?? editing.title : editing.title}</strong> in the currently selected <strong>{format.label}</strong> format.</p>
                )}
                <label className="wide-field">Different angle or writing direction
                  <textarea rows={3} maxLength={600} value={aiAngle} onChange={(event) => setAiAngle(event.target.value)} placeholder="Optional: emphasize first principles, make the troubleshooting scenario harder, or use a more concise hook." />
                </label>
                <div className="studio-actions wide-field">
                  <button className="primary-action" disabled={aiBusy || workspace.busy || (aiIntent === "new_subject" && !aiSubject.trim())} type="button" onClick={generateWithAi}>{aiBusy ? "Generating securely…" : aiIntent === "new_subject" ? "Generate new subject" : "Generate different version"}</button>
                  <span className="field-note">The output is validated, saved as a new revision, and always requires human technical review.</span>
                </div>
              </div>
            ) : (
              <div className="studio-state"><strong>Paid generation is unavailable</strong><p>{aiStatusMessage(aiStatus)}</p></div>
            )}
          </section>

          <form className="studio-panel draft-editor" onSubmit={save}>
            <div className="studio-panel-heading">
              <div><p className="eyebrow">Drafting workflow</p><h2>Write and review</h2></div>
              <span className={editorialStatusClass(editing.status)}>{formatName(editing.status)}</span>
            </div>
            <div className="format-guide">
              <strong>{format.label}</strong>
              <p>{format.guidance}</p>
              <ol>{format.template.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
            <div className="draft-fields">
              <label>Content format
                <select value={editing.formatId} onChange={(event) => changeFormat(event.target.value as ContentFormatId)}>
                  {CONTENT_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label>Editorial media path
                <select value={editing.mediaPath} onChange={(event) => update("mediaPath", event.target.value as ContentMediaPath)}>
                  <option value="text_only">Text only</option>
                  <option value="text_first">Text first, image when useful</option>
                  <option value="image_first">Image first, then grounded copy</option>
                </select>
              </label>
              <label className="wide-field">Title or hook
                <input maxLength={300} value={editing.title} onChange={(event) => update("title", event.target.value)} />
              </label>
              <label className="wide-field">Main X caption
                <textarea rows={5} value={editing.caption} onChange={(event) => update("caption", event.target.value)} />
                <Counter value={editing.caption} />
              </label>
              <label className="wide-field">Technical explanation and research notes
                <textarea rows={7} maxLength={12_000} value={editing.explanation} onChange={(event) => update("explanation", event.target.value)} placeholder="Keep factual claims, mechanisms, limitations, and hypothetical examples distinguishable." />
              </label>
              {editing.mediaPath !== "text_only" ? <>
                <label className="wide-field">Reviewed image brief
                  <textarea rows={5} maxLength={4000} value={editing.imagePrompt} onChange={(event) => update("imagePrompt", event.target.value)} placeholder="Describe the subject, composition, labels, and what the visual must teach. Do not request fabricated documentary evidence." />
                </label>
                <label className="wide-field">Planned alt text
                  <textarea rows={3} maxLength={1000} value={editing.imageAltText} onChange={(event) => update("imageAltText", event.target.value)} />
                </label>
              </> : null}
              <label className="wide-field">Factual source references
                <select
                  multiple
                  size={Math.min(7, Math.max(3, evidenceOptions.length))}
                  value={editing.evidence.map((item) => item.id)}
                  onChange={(event) => update("evidence", Array.from(event.target.selectedOptions, (option) => evidencePool.get(option.value)).filter((item): item is EvidenceOption => Boolean(item)).slice(0, 12))}
                  disabled={evidencePool.size === 0}
                >
                  {[...evidencePool.values()].map((option) => <option key={option.id} value={option.id}>{option.publisher} · {option.title}</option>)}
                </select>
                <span className="field-note">{evidenceUnavailable ? "Publisher evidence is temporarily unavailable." : "These are publisher records and original links. They are not independent verification by this platform."}</span>
              </label>
            </div>

            {format.mode === "thread" ? (
              <fieldset className="thread-editor">
                <legend>Thread posts</legend>
                {editing.threadPosts.map((post, index) => (
                  <label key={index}>Post {index + 1}
                    <textarea rows={4} value={post} onChange={(event) => update("threadPosts", editing.threadPosts.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
                    <Counter value={post} />
                  </label>
                ))}
                <div className="studio-actions">
                  <button type="button" className="secondary-action" onClick={() => update("threadPosts", [...editing.threadPosts, ""].slice(0, 20))} disabled={editing.threadPosts.length >= 20}>Add post</button>
                  <button type="button" className="quiet-action" onClick={() => update("threadPosts", editing.threadPosts.slice(0, -1))} disabled={editing.threadPosts.length <= 2}>Remove last</button>
                </div>
              </fieldset>
            ) : null}

            {format.mode === "poll" ? (
              <fieldset className="poll-editor">
                <legend>Poll options</legend>
                {editing.pollOptions.map((option, index) => (
                  <label key={index}>Option {index + 1}<input value={option} onChange={(event) => update("pollOptions", editing.pollOptions.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><Counter value={option} limit={X_POLL_OPTION_LIMIT} /></label>
                ))}
                <div className="studio-actions">
                  <button type="button" className="secondary-action" onClick={() => update("pollOptions", [...editing.pollOptions, ""].slice(0, 4))} disabled={editing.pollOptions.length >= 4}>Add option</button>
                  <button type="button" className="quiet-action" onClick={() => update("pollOptions", editing.pollOptions.slice(0, -1))} disabled={editing.pollOptions.length <= 2}>Remove last</button>
                </div>
              </fieldset>
            ) : null}

            <label className="moderator-field">Correct answer / moderator notes
              <textarea rows={5} maxLength={6000} value={editing.moderatorNotes} onChange={(event) => update("moderatorNotes", event.target.value)} placeholder="Keep challenge answers, caveats, and review instructions private until you choose to reveal them." />
            </label>
            <p className="field-note">The counters use a conservative Unicode-aware 280-character preflight. Links and platform-specific weighting still require final validation in X before manual publication.</p>

            {reviewProblems.length > 0 ? <div className="review-problems" role="alert"><strong>Review checks</strong><ul>{reviewProblems.map((problem) => <li key={problem}>{problem}</li>)}</ul></div> : null}
            <div className="studio-actions">
              <button className="primary-action" disabled={workspace.busy} type="submit">Save draft</button>
              <button className="secondary-action" disabled={workspace.busy} type="button" onClick={markReady}>Mark ready for review</button>
              <button className="secondary-action" type="button" onClick={copyDraft}>Copy finished text</button>
              <button className="quiet-action" type="button" onClick={() => update("visual", editing.visual ? null : createDefaultVisual(editing.title))}>{editing.visual ? "Remove visual" : "Add visual"}</button>
            </div>
            <p className="field-note" aria-live="polite">{feedback || `${editing.revisions.length} saved revision checkpoint${editing.revisions.length === 1 ? "" : "s"}. Last saved ${formatDate(editing.updatedAt)}.`}</p>
          </form>

          {editing.revisions.length > 0 ? <section className="studio-panel" aria-labelledby="revision-history-heading"><div className="studio-panel-heading"><div><p className="eyebrow">Recovery</p><h2 id="revision-history-heading">Revision history</h2></div><span className="status-chip">{editing.revisions.length} checkpoints</span></div><ol className="revision-list">{editing.revisions.map((revision) => <li key={revision.id}><span>Version {revision.version} · {formatDate(revision.savedAt)}</span><button type="button" className="secondary-action" disabled={workspace.busy} onClick={async () => { if (window.confirm("Restore this revision as a new saved version?")) { const result = await workspace.restoreRevision(editing.id, revision.id, editing.recordVersion); setFeedback(result.error ?? (result.ok ? "Revision restored as the latest version." : "Restore failed.")); setDraftEdits({}); } }}>Restore</button></li>)}</ol></section> : null}

          <XPreview draft={editing} />

          {editing.visual ? <VisualCreator spec={editing.visual} onChange={(visual) => update("visual", visual)} /> : (
            <section className="studio-panel visual-empty"><p className="eyebrow">Visual Content Creator</p><h2>Add a deterministic visual</h2><p>Choose a format above to create a branded preview and downloadable PNG without a paid image API.</p><button type="button" className="primary-action" onClick={() => update("visual", createDefaultVisual(editing.title))}>Create visual specification</button></section>
          )}

          <section className="studio-panel" aria-labelledby="ai-provider-heading">
            <div className="studio-panel-heading"><div><p className="eyebrow">Visual production</p><h2 id="ai-provider-heading">AI image package</h2></div><span className={imageStatus.available ? "status-chip status-safe" : "status-chip"}>{imageStatus.available ? "Owner initiated" : "Unavailable"}</span></div>
            <p className="studio-intro">Choose Text only, Text first, or Image first above. Every paid image request is explicit, owner-only, idempotent, and shares the monthly AI allowance. Automated tests use mocks and never spend API credits.</p>
            {imageStatus.available ? <div className="draft-fields">
              <label>Image shape<select value={imageAspect} onChange={(event) => setImageAspect(event.target.value as "square" | "landscape")}><option value="square">Square, 1024 × 1024</option><option value="landscape">Landscape, 1536 × 1024</option></select></label>
              <div className="studio-actions wide-field"><button type="button" className="primary-action" onClick={generateImage} disabled={imageBusy || workspace.busy || editing.mediaPath === "text_only" || !editing.imagePrompt.trim()}>{imageBusy ? "Generating and inspecting…" : `Generate one image, reserve up to $${imageStatus.maxEstimatedCostUsd.toFixed(2)}`}</button><span className="field-note">The image and inspection may reserve up to the displayed amount. Image-first grounded copy also uses one bounded text request from the same monthly allowance. This is an application estimate, not a provider-side billing ceiling. No request runs until this button is pressed.</span></div>
            </div> : <div className="studio-state"><strong>AI image generation is not configured</strong><p>{imageStatus.reason === "missing_storage" ? "Private durable storage is required before images can be generated." : imageStatus.reason === "shared_ai_unavailable" ? "The shared AI allowance or provider configuration is unavailable." : "The server-side image-generation switch is off."}</p></div>}

            <form className="media-upload-form" onSubmit={uploadImage}>
              <h3>Attach an owner-provided image</h3>
              <p className="field-note">PNG only, up to 4 MB. Use images you created or are authorized to use.</p>
              <label>PNG file<input name="file" type="file" accept="image/png" required /></label>
              <label>What the image actually shows<textarea name="imageDescription" rows={3} maxLength={2000} required /></label>
              <label>Accessible alt text<textarea name="altText" rows={3} maxLength={1000} required /></label>
              <button type="submit" className="secondary-action" disabled={uploadBusy}>{uploadBusy ? "Uploading privately…" : "Attach private image"}</button>
            </form>

            <div className="media-asset-grid">
              {mediaAssets.filter((asset) => asset.draftId === editing.id).map((asset) => <article className="media-asset-card" key={asset.id}>
                <Image unoptimized src={`/api/content/media/${asset.id}`} alt={asset.altText} width={asset.width} height={asset.height} />
                <div><strong>{asset.origin === "ai_generated" ? "AI-generated editorial image" : "Owner-provided image"}</strong><p>{asset.imageDescription}</p><small>{asset.width} × {asset.height} · {formatDate(asset.createdAt)}</small><a className="secondary-action" href={`/api/content/media/${asset.id}?download=1`}>Download PNG</a></div>
              </article>)}
            </div>
          </section>
        </>
      ) : <div className="studio-state">Create a draft to begin writing.</div>}
        </div>
      </details>
    </div>
  );
}
