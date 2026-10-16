"use client";

import { useMemo, useState, type FormEvent } from "react";

import { CONTENT_FORMATS, type ContentFormatId } from "@/features/content-studio/content-formats";
import { AUDIENCE_LEVELS, type AudienceLevel, type EvidenceOption } from "@/features/content-studio/content-types";
import { AI_RESEARCH_PATHS, type AiIdeaRequest, type AiPublicStatus } from "@/features/ai-content/types";
import { generateAiIdeasAction, reviewAiIdeaAction } from "@/server/ai/actions";
import type { AiSuggestionView } from "@/server/ai/repository";

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function unavailableMessage(status: AiPublicStatus): string {
  if (status.reason === "disabled") return "AI generation is disabled by server configuration. Manual creation remains available.";
  if (status.reason === "zero_budget") return "AI generation has a zero monthly allowance and cannot make paid requests.";
  if (status.reason === "missing_key") return "AI generation is enabled, but its server-only provider credential is missing.";
  return "AI generation configuration is incomplete. No provider request can be made.";
}

export function AiIdeaGenerator({
  evidenceOptions,
  initialStatus,
  initialSuggestions,
}: {
  evidenceOptions: readonly EvidenceOption[];
  initialStatus: AiPublicStatus;
  initialSuggestions: readonly AiSuggestionView[];
}) {
  const [topic, setTopic] = useState("");
  const [objective, setObjective] = useState("");
  const [researchPath, setResearchPath] = useState<(typeof AI_RESEARCH_PATHS)[number]>("evergreen");
  const [formatId, setFormatId] = useState<"" | ContentFormatId>("");
  const [audience, setAudience] = useState<"" | AudienceLevel>("");
  const [batchSize, setBatchSize] = useState(3);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const evidence = useMemo(() => new Map(evidenceOptions.map((item) => [item.id, item])), [evidenceOptions]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!initialStatus.available) return;
    const request: AiIdeaRequest = {
      audience: audience || null,
      batchSize,
      contentObjective: objective.trim(),
      formatId: formatId || null,
      idempotencyKey: `ai-ideas:${crypto.randomUUID()}`,
      researchPath,
      topic: topic.trim(),
    };
    setBusy(true); setFeedback("Generating a bounded, evidence-aware idea batch…");
    try {
      const result = await generateAiIdeasAction(request);
      if (result.ok && result.suggestions) { setSuggestions(result.suggestions); setFeedback("Validated proposals saved for editorial review. None were automatically approved."); }
      else setFeedback(result.error ?? "Idea generation failed.");
    } catch { setFeedback("The authenticated generation request failed."); }
    finally { setBusy(false); }
  }

  async function review(id: string, decision: "accept" | "reject") {
    const note = decision === "reject" ? window.prompt("Optional editorial feedback for this rejected proposal:", "") ?? "" : "";
    setBusy(true); setFeedback(decision === "accept" ? "Accepting idea into the private library…" : "Recording editorial rejection…");
    try {
      const result = await reviewAiIdeaAction(id, decision, note);
      if (result.ok && result.suggestions) { setSuggestions(result.suggestions); setFeedback(decision === "accept" ? "Idea accepted and saved as approved. Human fact review is still required." : "Proposal rejected and retained with its editorial decision."); }
      else setFeedback(result.error ?? "The editorial decision failed.");
    } catch { setFeedback("The authenticated editorial request failed."); }
    finally { setBusy(false); }
  }

  return (
    <section className="studio-panel ai-workspace-panel" aria-labelledby="ai-idea-heading">
      <div className="studio-panel-heading">
        <div><p className="eyebrow">AI content intelligence</p><h2 id="ai-idea-heading">Discover educational opportunities</h2></div>
        <span className={initialStatus.available ? "status-chip status-safe" : "status-chip"}>{initialStatus.available ? initialStatus.model : "Disabled"}</span>
      </div>
      {!initialStatus.available ? <div className="studio-state"><strong>Paid generation is unavailable</strong><p>{unavailableMessage(initialStatus)}</p></div> : (
        <form className="idea-form" onSubmit={generate}>
          <label>Research path<select value={researchPath} onChange={(event) => setResearchPath(event.target.value as typeof researchPath)}>{AI_RESEARCH_PATHS.map((value) => <option key={value} value={value}>{value === "news" ? "News and emerging developments" : "Evergreen education"}</option>)}</select></label>
          <label>Batch size<select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))}><option value={3}>3 ideas</option><option value={4}>4 ideas</option><option value={5}>5 ideas</option></select></label>
          <label className="wide-field">Topic focus<input maxLength={200} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Optional: Linux networking, Kubernetes debugging, cloud security…" /></label>
          <label>Preferred format<select value={formatId} onChange={(event) => setFormatId(event.target.value as "" | ContentFormatId)}><option value="">Choose for diversity</option>{CONTENT_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}</select></label>
          <label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value as "" | AudienceLevel)}><option value="">Mixed or model-selected</option>{AUDIENCE_LEVELS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label className="wide-field">Content objective<textarea rows={3} maxLength={500} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Optional: what should this batch help readers understand or discuss?" /></label>
          <div className="studio-actions wide-field"><button className="primary-action" disabled={busy} type="submit">{busy ? "Generating securely…" : "Generate 3–5 ideas"}</button><span className="field-note">Every result starts as an unapproved proposal and may be marked Needs Review.</span></div>
        </form>
      )}
      {feedback ? <p className="studio-alert" aria-live="polite">{feedback}</p> : null}
      {suggestions.length > 0 ? <ol className="idea-grid ai-suggestion-grid">{suggestions.map((suggestion) => {
        const item = suggestion.payload;
        return <li className="idea-card" key={suggestion.id}>
          <div className="idea-card-heading"><span className="status-chip">{label(suggestion.editorialStatus)}</span><span className={suggestion.verificationStatus === "evidence_backed" ? "status-chip status-safe" : "status-chip"}>{label(suggestion.verificationStatus)}</span></div>
          <h3>{item.title}</h3><p>{item.whyUseful}</p>
          <dl className="idea-metadata"><div><dt>Format</dt><dd>{CONTENT_FORMATS.find((format) => format.id === item.formatId)?.label}</dd></div><div><dt>Audience</dt><dd>{label(item.audience)}</dd></div><div><dt>Presentation</dt><dd>{label(item.recommendedPresentation)}</dd></div></dl>
          <p className="field-note"><strong>Angle:</strong> {item.contentAngle}</p>
          {item.evidenceSourceItemIds.length > 0 ? <ul className="ai-evidence-list">{item.evidenceSourceItemIds.map((id) => <li key={id}>{evidence.has(id) ? <a href={evidence.get(id)?.url} target="_blank" rel="noreferrer">{evidence.get(id)?.publisher} · {evidence.get(id)?.title}</a> : "Stored publisher evidence"}</li>)}</ul> : <p className="truth-note">No publisher evidence attached. Additional verification is required.</p>}
          {item.reviewFlags.length > 0 ? <ul className="review-problems">{item.reviewFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul> : null}
          {suggestion.editorialStatus === "proposed" ? <div className="studio-actions"><button className="primary-action" disabled={busy} type="button" onClick={() => review(suggestion.id, "accept")}>Accept idea</button><button className="quiet-action" disabled={busy} type="button" onClick={() => review(suggestion.id, "reject")}>Reject</button></div> : suggestion.editorialFeedback ? <p className="field-note">Editorial feedback: {suggestion.editorialFeedback}</p> : null}
        </li>;
      })}</ol> : null}
    </section>
  );
}
