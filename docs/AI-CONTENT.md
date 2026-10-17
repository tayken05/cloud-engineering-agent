# AI Content Intelligence and Drafting

Status: implemented behind owner authorization. Production text generation uses the owner-approved $2 application allowance. Image generation is owner initiated only and shares that allowance; no paid image request was made during this follow-up.

## Boundaries

The system supports owner-triggered idea batches, draft generation, and deliberately initiated image packages. Manual ideas, editing, deterministic visuals, revisions, and export continue to work without an AI provider. There is no public generation endpoint, scheduled AI job, X action, or automatic approval.

`src/features/ai-content/` contains provider-independent types, prompt construction, structured schemas, validation, duplicate checks, factual-review rules, and cost calculations. `src/server/ai/` contains owner-authorized Server Actions, the OpenAI adapter, configuration, and PostgreSQL run repository. Provider data does not enter Client Component environment variables or browser bundles.

## Research and editorial behavior

Autonomous preparation receives a bounded, varied evidence set selected across topics and publishers rather than a newest-only slice. An official publisher record can support a narrowly attributed announcement without claiming independent corroboration. Independently supported facts require verified evidence or multiple publishers; unverified claims stay in Needs Review. Publisher data remains untrusted input and cannot alter system rules.

All 20 Content Studio formats remain available through one registry. Historical Evolution & First Principles requires the original problem, early mechanisms, limitations, later changes, and careful chronology. Real-World Analogies separately requires a physical mapping, the real technical mechanism, and the analogy's limits. Other formats receive their own established guidance.

Ideas may still be generated as a reviewable 3–5 proposal batch. The primary Studio path now prepares one finished package directly. In the same bounded provider request, it returns zero to three compact creative candidates, selects one only when it has a worthwhile premise, and atomically saves the chosen idea and draft. Optional owner direction never becomes a required topic or format. Zero worthwhile candidates is an honest successful result and creates no draft. Nothing is marked published.

Primary editorial subjects are Cloud Engineering, Networking, Linux, DevOps, Infrastructure, Kubernetes, and related Security. Generic programming examples are used only when they directly clarify those domains. Format-specific guidance varies hook, depth, shape, and ending, while forbidding fabricated experiences, invented quotes, forced engagement, and generic textbook definitions. Generated publishable copy and visual text reject Unicode em and en dashes; ordinary technical hyphens remain valid.

## Provider integration

The OpenAI SDK is pinned at 7.34.0. The adapter uses the Responses API, `text.format` JSON Schema with strict output, `store: false`, configurable model selection, a default 45-second deadline, at most one retry, and an AbortSignal. The current default is `gpt-6-luna`, chosen for cost-sensitive bounded text work. Official references:

- [Responses API](https://developers.openai.com/api/reference/typescript/resources/responses)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Models](https://developers.openai.com/api/docs/models)
- [Pricing](https://developers.openai.com/api/docs/pricing)

Model availability and pricing can change. Review those sources and update the configured rates before changing the approved allowance or model.

OpenAI image generation uses the direct Images API with `gpt-image-2.5-flare`, one PNG at a time, low quality by default, and a 120-second bounded request. A second bounded Responses API request inspects the actual pixels before image-first copy is written. Square output is 1024 by 1024; landscape is 1536 by 1024. Generated and owner-provided PNGs are stored in private Vercel Blob storage, while PostgreSQL stores owner-scoped metadata and relationships only. Private authenticated handlers stream and download assets. Official references: [image generation](https://developers.openai.com/api/docs/guides/image-generation) and [Vercel private Blob storage](https://vercel.com/docs/vercel-blob/private-storage).

The three editorial paths are text-only, text-first, and image-first. Image-first generation cannot write a caption until inspection returns a description of what is actually visible. Ask Grok image-first prompts must ask about that description and keep the correct answer in private moderator notes. Generated photorealistic images are editorial artwork, never documentary evidence.

## Validation and factual safeguards

Structured results are rejected unless they match the expected counts, enums, bounds, X limits, evidence IDs, factual-claim classifications, and visual allowlist. Source-backed facts, interpretations, and hypothetical examples remain distinct. Missing evidence, unsafe technical commands, unsupported historical claims, incomplete analogies, and other review flags force Needs Review. Only the six deterministic visual templates, declared aspect ratios, four accent colors, and bounded text labels are accepted; executable SVG, HTML, and JavaScript are never accepted as model output.

Validation does not establish truth. Editorial review must compare important claims and commands with primary sources before approval.

## Spending and reliability controls

Fail-closed defaults:

```text
AI_GENERATION_ENABLED=false
AI_MONTHLY_BUDGET_USD=0
AI_TEXT_MODEL=gpt-6-luna
AI_IMAGE_GENERATION_ENABLED=false
AI_IMAGE_MODEL=gpt-image-2.5-flare
AI_IMAGE_MAX_COST_USD=0.03
```

A request can proceed only when the authenticated user is the exact configured owner, generation is enabled, the server key exists, and the shared allowance is positive. PostgreSQL serializes reservations per owner, permits one running request, reserves a conservative maximum cost before provider access, and releases the reservation after success or failure. Image generation and inspection reserve up to the configured per-request amount; image-first grounded copy is a separate bounded text request under the same monthly allowance. Idempotency keys prevent retry duplication, while a six-minute database lease covers the bounded image, inspection, and caption sequence and then permits crash recovery. Provider/model, timestamps, response ID, token usage, estimated cost, and safe error codes are retained.

The application allowance is not a provider billing ceiling. Provider project budgets and alerts should also be configured before activation.

## Current production controls

The owner-approved production allowance is `$2` per calendar month at the application layer. Text generation is enabled. Image generation is also enabled for deliberate owner actions at low quality, with a conservative `$0.03` reservation for one image plus inspection. The private Blob store is linked, but this follow-up made no real image request and the store remained empty after deployment.

Before increasing the allowance, changing model or quality, or running a first paid image request, review current provider pricing and the remaining application allowance. Keep provider-side budgets and alerts in place. Do not prefix any credential or control with `NEXT_PUBLIC_`.

## Intelligent Newsroom editorial flow

The prepared package carries finished X copy, format-specific explanation, classified claims, evidence IDs, media recommendation, and private review notes. Text-only packages can enter `ready_for_review`; unsupported facts, validation flags, and packages awaiting media enter `needs_review`. The owner may approve, revise, reject with optional feedback, or copy only the final post text. Revision preserves prior copy through the existing revision mechanism. Approved remains an editorial state and never means published.

The autonomous contract uses a broad editorial purpose, such as discovery, entertainment, story, observation, humor, interaction, discussion, or education. It sends only the 20 capability names and applies the selected format's constraints after selection, rather than injecting every format template into each request. Historical/first-principles and analogy safeguards remain distinct when those capabilities are selected.

Each internal candidate records its premise, interesting reason, creative approach, intended reader experience, evidence basis, presentation medium, and editorial risks. Deterministic validation rejects lookalike premises or mechanisms, unsupported evidence classifications, recent premise/mechanism repetition, invalid media state, typographic dashes, and invalid X output. Recent ideas, drafts, revisions, formats, hooks, visual concepts, approval states, and rejection feedback form a compact creative-memory input. This memory discourages repetition without permanently banning a technical subject.

Standalone X copy uses platform-style weighted counting, including transformed URL length and Unicode weighting. Invalid copy is rejected before persistence rather than shown as X-ready. Creative quality and humor still require deliberate owner evaluation; mocked tests establish observable exploration, selection constraints, memory use, and safety rather than taste.
