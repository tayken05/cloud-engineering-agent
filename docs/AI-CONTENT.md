# AI Content Intelligence and Drafting

Status: implemented behind owner authorization, with paid generation disabled. No real provider request was made during Task 13.

## Boundaries

The system supports two owner-triggered operations: proposing 3–5 ideas and drafting one saved Content Studio record. Manual ideas, editing, visuals, revisions, and export continue to work without an AI provider. There is no public generation endpoint, scheduled AI job, X action, image-generation request, or automatic approval.

`src/features/ai-content/` contains provider-independent types, prompt construction, structured schemas, validation, duplicate checks, factual-review rules, and cost calculations. `src/server/ai/` contains owner-authorized Server Actions, the OpenAI adapter, configuration, and PostgreSQL run repository. Provider data does not enter Client Component environment variables or browser bundles.

## Research and editorial behavior

News requests receive at most 20 recent collected publisher records. Evergreen requests receive at most eight optional records and may propose source-independent teaching topics. Publisher data is untrusted input and cannot alter system rules. Evidence references must use IDs from the supplied records; absent support forces Needs Review.

All 20 Content Studio formats remain available through one registry. Historical Evolution & First Principles requires the original problem, early mechanisms, limitations, later changes, and careful chronology. Real-World Analogies separately requires a physical mapping, the real technical mechanism, and the analogy's limits. Other formats receive their own established guidance.

Ideas are stored as proposed AI suggestions. The owner may accept one into Content Ideas or reject it with feedback. Draft generation checks the saved draft version first, then persists validated output through the existing revision-preserving repository. Nothing is marked published.

## Provider integration

The OpenAI SDK is pinned at 7.34.0. The adapter uses the Responses API, `text.format` JSON Schema with strict output, `store: false`, configurable model selection, a default 45-second deadline, at most one retry, and an AbortSignal. The current default is `gpt-6-luna`, chosen for cost-sensitive bounded text work. Official references:

- [Responses API](https://developers.openai.com/api/reference/typescript/resources/responses)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Models](https://developers.openai.com/api/docs/models)
- [Pricing](https://developers.openai.com/api/docs/pricing)

Model availability and pricing can change. Review those sources and update the configured rates before enabling a positive allowance.

## Validation and factual safeguards

Structured results are rejected unless they match the expected counts, enums, bounds, X limits, evidence IDs, factual-claim classifications, and visual allowlist. Source-backed facts, interpretations, and hypothetical examples remain distinct. Missing evidence, unsafe technical commands, unsupported historical claims, incomplete analogies, and other review flags force Needs Review. Only the six deterministic visual templates, declared aspect ratios, four accent colors, and bounded text labels are accepted; executable SVG, HTML, and JavaScript are never accepted as model output.

Validation does not establish truth. Editorial review must compare important claims and commands with primary sources before approval.

## Spending and reliability controls

Default configuration:

```text
AI_GENERATION_ENABLED=false
AI_MONTHLY_BUDGET_USD=0
AI_TEXT_MODEL=gpt-6-luna
```

A request can proceed only when the authenticated user is the exact configured owner, generation is enabled, the server key exists, and the allowance is positive. PostgreSQL serializes reservations per owner, permits one running request, reserves a conservative maximum cost before provider access, and releases the reservation after success or failure. Idempotency keys prevent retry duplication, while a bounded lease recovers interrupted runs. Provider/model, timestamps, response ID, token usage, estimated cost, and safe error codes are retained.

The application allowance is not a provider billing ceiling. Provider project budgets and alerts should also be configured before activation.

## Activation procedure

Activation requires a separate explicit owner approval for a positive monthly amount and paid requests. Then:

1. Create or select an OpenAI project with an appropriate provider-side budget and alerts.
2. Create a restricted server credential and configure `OPENAI_API_KEY` only in the existing Vercel Production environment.
3. Set `AI_GENERATION_ENABLED=true` and `AI_MONTHLY_BUDGET_USD` to the approved amount.
4. Confirm `AI_TEXT_MODEL` and the input/output price variables against current official pricing.
5. Redeploy the existing project and perform one owner-authenticated bounded request while observing the stored run and provider usage.

Do not prefix these variables with `NEXT_PUBLIC_`. No activation is needed for manual authoring.
