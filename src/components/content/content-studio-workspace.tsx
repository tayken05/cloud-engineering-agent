"use client";

import { useMemo, useState, type FormEvent } from "react";

import { CONTENT_FORMATS, getContentFormat, type ContentFormatId } from "@/features/content-studio/content-formats";
import { PLANNED_IMAGE_PROVIDERS } from "@/features/content-studio/image-provider";
import type { ContentDraft, EvidenceOption } from "@/features/content-studio/content-types";
import {
  countXCharacters,
  createDefaultVisual,
  validateDraft,
  X_POST_CHARACTER_LIMIT,
  X_POLL_OPTION_LIMIT,
} from "@/features/content-studio/content-workspace";
import { useContentWorkspace } from "./content-workspace-store";
import { VisualCreator } from "./visual-creator";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatName(value: string): string {
  return value.replaceAll("_", " ").replace(/(^|\s)\S/g, (character) => character.toUpperCase());
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
  evidenceOptions,
  evidenceUnavailable,
  initialDraftId,
}: {
  evidenceOptions: readonly EvidenceOption[];
  evidenceUnavailable: boolean;
  initialDraftId?: string;
}) {
  const workspace = useContentWorkspace();
  const [selectedId, setSelectedId] = useState(initialDraftId ?? "");
  const [draftEdits, setDraftEdits] = useState<Readonly<Record<string, ContentDraft>>>({});
  const [feedback, setFeedback] = useState<string>("");
  const [reviewProblems, setReviewProblems] = useState<readonly string[]>([]);

  const storedDraft = workspace.state?.drafts.find((draft) => draft.id === selectedId)
    ?? workspace.state?.drafts.find((draft) => draft.id === initialDraftId)
    ?? workspace.state?.drafts[0]
    ?? null;
  const editing = storedDraft ? draftEdits[storedDraft.id] ?? storedDraft : null;

  const format = editing ? getContentFormat(editing.formatId) : null;
  const evidencePool = useMemo(() => new Map([
    ...evidenceOptions.map((item) => [item.id, item] as const),
    ...(editing?.evidence ?? []).map((item) => [item.id, item] as const),
  ]), [editing?.evidence, evidenceOptions]);

  function selectDraft(id: string) {
    setSelectedId(id);
    setFeedback("");
    setReviewProblems([]);
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

  function newDraft() {
    const id = workspace.createDraft("beginner-friendly-education");
    setSelectedId(id);
    setFeedback("New draft created in this browser.");
  }

  function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!editing) return;
    workspace.saveDraft(editing);
    setDraftEdits((current) => {
      const next: Record<string, ContentDraft> = { ...current };
      delete next[editing.id];
      return next;
    });
    setFeedback("Draft saved locally. A revision checkpoint was added when the content changed.");
    setReviewProblems([]);
  }

  function markReady() {
    if (!editing) return;
    const problems = validateDraft(editing);
    setReviewProblems(problems);
    if (problems.length > 0) {
      setFeedback("Resolve the review checks before marking this draft ready.");
      return;
    }
    const ready = { ...editing, status: "ready_for_review" as const };
    workspace.saveDraft(ready);
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
      ? posts.map((post, index) => `${index + 1}/${posts.length} ${post}`).join("\n\n")
      : editing.caption;
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Finished text copied to the clipboard.");
    } catch {
      setFeedback("Clipboard access was unavailable. Select the preview text and copy it manually.");
    }
  }

  if (!workspace.state) return <div className="studio-state" aria-live="polite">Opening the device-local Content Studio…</div>;

  return (
    <div className="content-workspace">
      <aside className="operator-notice">
        <div><strong>Private device workspace</strong><p>Drafts and revisions stay in this browser. The server exposes no draft mutation endpoint, X publisher, Grok request, or image-generation call.</p></div>
        <span className="status-chip status-safe">Human review required</span>
      </aside>
      {workspace.storageError ? <p className="studio-alert" role="alert">{workspace.storageError}</p> : null}

      <section className="draft-toolbar" aria-label="Draft selection">
        <label>Working draft
          <select value={editing?.id ?? ""} onChange={(event) => selectDraft(event.target.value)}>
            {workspace.state.drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.title || "Untitled draft"} · {formatName(draft.status)}</option>)}
          </select>
        </label>
        <button type="button" className="secondary-action" onClick={newDraft}>New blank draft</button>
      </section>

      {editing && format ? (
        <>
          <form className="studio-panel draft-editor" onSubmit={save}>
            <div className="studio-panel-heading">
              <div><p className="eyebrow">Drafting workflow</p><h2>Write and review</h2></div>
              <span className={editing.status === "ready_for_review" ? "status-chip status-safe" : "status-chip"}>{formatName(editing.status)}</span>
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
              <button className="primary-action" type="submit">Save draft</button>
              <button className="secondary-action" type="button" onClick={markReady}>Mark ready for review</button>
              <button className="secondary-action" type="button" onClick={copyDraft}>Copy finished text</button>
              <button className="quiet-action" type="button" onClick={() => update("visual", editing.visual ? null : createDefaultVisual(editing.title))}>{editing.visual ? "Remove visual" : "Add visual"}</button>
            </div>
            <p className="field-note" aria-live="polite">{feedback || `${editing.revisions.length} saved revision checkpoint${editing.revisions.length === 1 ? "" : "s"}. Last saved ${formatDate(editing.updatedAt)}.`}</p>
          </form>

          <XPreview draft={editing} />

          {editing.visual ? <VisualCreator spec={editing.visual} onChange={(visual) => update("visual", visual)} /> : (
            <section className="studio-panel visual-empty"><p className="eyebrow">Visual Content Creator</p><h2>Add a deterministic visual</h2><p>Choose a format above to create a branded preview and downloadable PNG without a paid image API.</p><button type="button" className="primary-action" onClick={() => update("visual", createDefaultVisual(editing.title))}>Create visual specification</button></section>
          )}

          <section className="studio-panel" aria-labelledby="ai-provider-heading">
            <div className="studio-panel-heading"><div><p className="eyebrow">Future integration</p><h2 id="ai-provider-heading">AI image providers</h2></div><span className="status-chip">Disabled</span></div>
            <p className="studio-intro">No API key is required and no billable image request can be made in this release. Provider adapters will require an operator budget, explicit generation approval, and durable asset storage.</p>
            <ul className="provider-list">{PLANNED_IMAGE_PROVIDERS.map((provider) => <li key={provider.id}><strong>{provider.label}</strong><span>{provider.note}</span><span className="status-chip">Not configured</span></li>)}</ul>
          </section>
        </>
      ) : <div className="studio-state">Create a draft to begin writing.</div>}
    </div>
  );
}
