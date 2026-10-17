"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { CONTENT_FORMATS, type ContentFormatId } from "@/features/content-studio/content-formats";
import {
  AUDIENCE_LEVELS,
  ENGAGEMENT_STYLES,
  IDEA_STATUSES,
  TECHNICAL_CATEGORIES,
  type AudienceLevel,
  type ContentIdea,
  type ContentWorkspaceState,
  type EngagementStyle,
  type EvidenceOption,
  type IdeaStatus,
  type TechnicalCategory,
} from "@/features/content-studio/content-types";
import { useContentWorkspace } from "./content-workspace-store";

type IdeaForm = Readonly<{
  audience: AudienceLevel;
  educationalObjective: string;
  engagementStyle: EngagementStyle;
  evidenceIds: readonly string[];
  formatId: ContentFormatId;
  id: string | null;
  notes: string;
  status: IdeaStatus;
  subject: string;
  technicalCategory: TechnicalCategory;
}>;

const EMPTY_FORM: IdeaForm = {
  audience: "beginner",
  educationalObjective: "",
  engagementStyle: "teach",
  evidenceIds: [],
  formatId: "beginner-friendly-education",
  id: null,
  notes: "",
  status: "captured",
  subject: "",
  technicalCategory: "cloud_engineering",
};

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

export function ContentIdeasWorkspace({
  evidenceOptions,
  evidenceUnavailable,
  initialState,
}: {
  evidenceOptions: readonly EvidenceOption[];
  evidenceUnavailable: boolean;
  initialState: ContentWorkspaceState;
}) {
  const router = useRouter();
  const workspace = useContentWorkspace(initialState);
  const [form, setForm] = useState<IdeaForm>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | IdeaStatus>("all");
  const [formatFilter, setFormatFilter] = useState<"all" | ContentFormatId>("all");
  const [importFeedback, setImportFeedback] = useState("");

  const filteredIdeas = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (workspace.state?.ideas ?? []).filter((idea) => {
      if (statusFilter !== "all" && idea.status !== statusFilter) return false;
      if (formatFilter !== "all" && idea.formatId !== formatFilter) return false;
      return !normalized || `${idea.subject} ${idea.educationalObjective} ${idea.notes}`.toLowerCase().includes(normalized);
    });
  }, [formatFilter, query, statusFilter, workspace.state?.ideas]);

  function set<K extends keyof IdeaForm>(key: K, value: IdeaForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = form.subject.trim();
    const objective = form.educationalObjective.trim();
    if (!subject || !objective) return;
    const previous = form.id ? workspace.state?.ideas.find((idea) => idea.id === form.id) : undefined;
    const now = new Date().toISOString();
    const evidencePool = new Map([
      ...evidenceOptions.map((option) => [option.id, option] as const),
      ...(previous?.evidence ?? []).map((option) => [option.id, option] as const),
    ]);
    const idea: ContentIdea = {
      audience: form.audience,
      createdAt: previous?.createdAt ?? now,
      educationalObjective: objective,
      engagementStyle: form.engagementStyle,
      evidence: form.evidenceIds.flatMap((id) => evidencePool.get(id) ?? []),
      formatId: form.formatId,
      id: previous?.id ?? `idea-${crypto.randomUUID()}`,
      notes: form.notes.trim(),
      recordVersion: previous?.recordVersion ?? 1,
      status: form.status,
      subject,
      technicalCategory: form.technicalCategory,
      updatedAt: now,
    };
    const result = await workspace.saveIdea(idea);
    if (result.ok) setForm(EMPTY_FORM);
  }

  function edit(idea: ContentIdea) {
    setForm({
      audience: idea.audience,
      educationalObjective: idea.educationalObjective,
      engagementStyle: idea.engagementStyle,
      evidenceIds: idea.evidence.map((item) => item.id),
      formatId: idea.formatId,
      id: idea.id,
      notes: idea.notes,
      status: idea.status,
      subject: idea.subject,
      technicalCategory: idea.technicalCategory,
    });
    document.getElementById("idea-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function openDraft(idea: ContentIdea) {
    const draftId = await workspace.createDraftFromIdea(idea);
    if (draftId) router.push(`/studio?draft=${encodeURIComponent(draftId)}`);
  }

  return (
    <div className="content-workspace">
      {workspace.legacyState ? <aside className="operator-notice"><div><strong>Browser workspace found</strong><p>{workspace.legacyState.ideas.length} ideas and {workspace.legacyState.drafts.length} drafts are available for explicit import. Preview: {[...workspace.legacyState.ideas.map((item) => item.subject), ...workspace.legacyState.drafts.map((item) => item.title || "Untitled draft")].slice(0, 5).join("; ") || "no named records"}. Export a backup first; the original browser records are retained.</p>{importFeedback ? <p className="field-note" aria-live="polite">{importFeedback}</p> : null}</div><div className="studio-actions"><button type="button" className="secondary-action" onClick={workspace.exportLegacy}>Export backup</button><button type="button" className="primary-action" disabled={workspace.busy} onClick={async () => { if (window.confirm("Import validated browser records? Existing database records with the same stable IDs will be skipped.")) { const result = await workspace.importLegacy(); const summary = result && "importResult" in result ? result.importResult : undefined; setImportFeedback(summary ? `Imported ${summary.imported}; skipped ${summary.skipped}; failed ${summary.failed}. Browser records were retained.` : result?.error ?? "Import was not completed."); } }}>Import browser records</button></div></aside> : null}
      {workspace.storageError ? <p className="studio-alert" role="alert">{workspace.storageError}</p> : null}

      <section className="studio-panel" id="idea-editor" aria-labelledby="idea-editor-heading">
        <div className="studio-panel-heading">
          <div><p className="eyebrow">Topic development</p><h2 id="idea-editor-heading">{form.id ? "Revise content idea" : "Capture a content idea"}</h2></div>
          <span className="status-chip">{CONTENT_FORMATS.length} formats</span>
        </div>
        <form className="idea-form" onSubmit={submit}>
          <label className="wide-field">Technical subject
            <input required maxLength={300} value={form.subject} onChange={(event) => set("subject", event.target.value)} placeholder="Example: How DNS evolved beyond a shared host file" />
          </label>
          <label>Content format
            <select value={form.formatId} onChange={(event) => set("formatId", event.target.value as ContentFormatId)}>
              {CONTENT_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}
            </select>
          </label>
          <label>Technical category
            <select value={form.technicalCategory} onChange={(event) => set("technicalCategory", event.target.value as TechnicalCategory)}>
              {TECHNICAL_CATEGORIES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </label>
          <label>Audience
            <select value={form.audience} onChange={(event) => set("audience", event.target.value as AudienceLevel)}>
              {AUDIENCE_LEVELS.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </label>
          <label>Engagement style
            <select value={form.engagementStyle} onChange={(event) => set("engagementStyle", event.target.value as EngagementStyle)}>
              {ENGAGEMENT_STYLES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </label>
          <label>Drafting status
            <select value={form.status} onChange={(event) => set("status", event.target.value as IdeaStatus)}>
              {IDEA_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </label>
          <label className="wide-field">Editorial purpose
            <textarea required rows={3} maxLength={1000} value={form.educationalObjective} onChange={(event) => set("educationalObjective", event.target.value)} placeholder="What should this make the reader discover, feel, discuss, enjoy, or understand?" />
          </label>
          <label className="wide-field">Optional publisher evidence
            <select
              multiple
              size={Math.min(7, Math.max(3, evidenceOptions.length))}
              value={[...form.evidenceIds]}
              onChange={(event) => set("evidenceIds", Array.from(event.target.selectedOptions, (option) => option.value).slice(0, 12))}
              disabled={evidenceOptions.length === 0}
            >
              {evidenceOptions.map((option) => <option key={option.id} value={option.id}>{option.publisher} · {option.title}</option>)}
            </select>
            <span className="field-note">
              {evidenceUnavailable
                ? "Collected publisher records are temporarily unavailable. Evergreen ideas can still be saved."
                : "Publisher records are supporting context, not independent verification. Use Command/Ctrl to select more than one."}
            </span>
          </label>
          <label className="wide-field">Research and creative notes
            <textarea rows={4} maxLength={4000} value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Separate sourced facts, planned analogies, hypothetical examples, and questions that still need checking." />
          </label>
          <div className="studio-actions wide-field">
            <button className="primary-action" disabled={workspace.busy} type="submit">{form.id ? "Save revision" : "Save idea"}</button>
            {form.id ? <button type="button" className="secondary-action" onClick={() => setForm(EMPTY_FORM)}>Cancel editing</button> : null}
          </div>
        </form>
      </section>

      <section className="studio-panel" aria-labelledby="idea-library-heading">
        <div className="studio-panel-heading">
          <div><p className="eyebrow">Idea library</p><h2 id="idea-library-heading">Educational opportunities</h2></div>
          <span className="status-chip">{filteredIdeas.length} shown</span>
        </div>
        <div className="idea-filter-row">
          <label>Search ideas<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Subject, objective, or notes" /></label>
          <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | IdeaStatus)}><option value="all">All statuses</option>{IDEA_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label>Format<select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value as "all" | ContentFormatId)}><option value="all">All formats</option>{CONTENT_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}</select></label>
        </div>
        {filteredIdeas.length > 0 ? (
          <ol className="idea-grid">
            {filteredIdeas.map((idea) => {
              const format = CONTENT_FORMATS.find((item) => item.id === idea.formatId);
              return (
                <li className="idea-card" key={idea.id}>
                  <div className="idea-card-heading"><span className="status-chip">{label(idea.status)}</span><span>{label(idea.audience)}</span></div>
                  <h3>{idea.subject}</h3>
                  <p>{idea.educationalObjective}</p>
                  <dl className="idea-metadata">
                    <div><dt>Format</dt><dd>{format?.label}</dd></div>
                    <div><dt>Engagement</dt><dd>{label(idea.engagementStyle)}</dd></div>
                    <div><dt>Evidence</dt><dd>{idea.evidence.length > 0 ? `${idea.evidence.length} publisher record${idea.evidence.length === 1 ? "" : "s"}` : "Evergreen · sources still needed"}</dd></div>
                  </dl>
                  <div className="studio-actions">
                    <button type="button" className="secondary-action" onClick={() => edit(idea)}>Edit</button>
                    {idea.status === "captured" ? <button type="button" className="secondary-action" disabled={workspace.busy} onClick={() => workspace.updateIdeaStatus(idea, "approved")}>Approve idea</button> : null}
                    {idea.status === "approved" || idea.status === "drafted" ? <button type="button" className="primary-action" onClick={() => openDraft(idea)}>Open in Studio</button> : null}
                    {idea.status !== "archived" ? <button type="button" className="quiet-action" disabled={workspace.busy} onClick={() => workspace.updateIdeaStatus(idea, "archived")}>Archive</button> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : <div className="studio-state">No ideas match these filters.</div>}
      </section>
    </div>
  );
}
