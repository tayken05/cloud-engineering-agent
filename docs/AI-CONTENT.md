# AI Content Intelligence and Drafting

Status: implemented behind owner authorization. Production text generation uses the owner-approved $2 application allowance. Image generation is owner initiated only and shares that allowance; no paid image request was made during this follow-up.

## Boundaries

The system supports owner-triggered idea batches, draft generation, and deliberately initiated image packages. Manual ideas, editing, deterministic visuals, revisions, and export continue to work without an AI provider. There is no public generation endpoint, scheduled AI job, X action, or automatic approval.

`src/features/ai-content/` contains provider-independent types, prompt construction, structured schemas, validation, duplicate checks, factual-review rules, and cost calculations. `src/server/ai/` contains owner-authorized Server Actions, the OpenAI adapter, configuration, and PostgreSQL run repository. Provider data does not enter Client Component environment variables or browser bundles.

## Research and editorial behavior

News requests receive at most 20 recent collected publisher records. Evergreen requests receive at most eight optional records and may propose source-independent teaching topics. Publisher data is untrusted input and cannot alter system rules. Evidence references must use IDs from the supplied records; absent support forces Needs Review.

All 20 Content Studio formats remain available through one registry. Historical Evolution & First Principles requires the original problem, early mechanisms, limitations, later changes, and careful chronology. Real-World Analogies separately requires a physical mapping, the real technical mechanism, and the analogy's limits. Other formats receive their own established guidance.

Ideas are stored as proposed AI suggestions. The owner may accept one into Content Ideas or reject it with feedback. Draft generation checks and saves the selected format before the request, requires an explicit subject for a new blank draft, and distinguishes a new subject from another treatment of the current idea. A new subject detaches stale idea state. Existing idea and draft text is supplied for near-duplicate rejection. Nothing is marked published.

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
