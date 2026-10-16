# Educational Content Studio

Status: Tasks 11–13 implement an owner-authenticated, PostgreSQL-backed Content Ideas workspace, drafting studio, X presentation preview, deterministic PNG visual creator, AI idea/draft generation, and owner-initiated AI image packages backed by private durable storage. No X account, publishing endpoint, or automatic paid generation is connected.

## Security boundary

Managed Neon Auth provides the application session. `/ideas`, `/studio`, every content query, and every mutation require that session and an exact `OWNER_AUTH_USER_ID` match. Public registration is disabled, private routes are dynamically rendered, and the query layer scopes every record by owner ID.

Ideas, drafts, revision checkpoints, moderator notes, evidence references, and visual specifications are stored in owner-scoped PostgreSQL tables. Record versions reject silent concurrent overwrites, and a prior revision is retained when draft content changes. The legacy versioned browser key `cloud-agent-content-workspace-v1` remains readable only for previewed, explicit, idempotent owner import and backup; successful import does not delete it.

The server performs one read-only query for up to 40 recent collected source items. Browser code receives only the item identifier, publisher name, title, original HTTPS URL, and publication timestamp. A publisher record is labelled as supporting context rather than independent verification. Database failure produces an honest error state.

## Twenty selectable formats

One drafting system supports all formats. Each format supplies its own guidance and outline instead of forcing a shared post shape.

1. Historical Evolution & First Principles.
2. Real-World Analogies.
3. Things You Probably Didn't Know.
4. Breaking Technology Updates.
5. Beginner-Friendly Education.
6. Deep Technical Education.
7. Practical Tutorials.
8. Troubleshooting Challenges.
9. Architecture Discussions.
10. Ask Grok.
11. Myths vs Facts.
12. Tech Humor & Memes.
13. Polls & Interactive Questions.
14. Engineering Observations.
15. Careers & Opportunities.
16. Projects & Hands-On Challenges.
17. Technical Comparisons.
18. Visual Education.
19. Community Engagement.
20. Threads & Learning Series.

Historical Evolution & First Principles and Real-World Analogies remain separate format identifiers and teaching guides. The Learning Series page explains both independently.

## Ideas and drafts

Ideas record a technical subject, format, audience, educational objective, engagement style, drafting status, optional publisher evidence, and research/creative notes. The notes field is where the operator should distinguish sourced facts, interpretation, analogies, and hypothetical examples. Approved ideas can create or reopen a related draft.

Drafts support a title or hook, main caption, technical explanation, evidence, format-specific thread posts or poll options, private correct-answer/moderator notes, status, visual specification, and up to 20 prior revision snapshots. Ready-for-review checks include a non-empty hook and post, the 280-character preflight, thread structure, poll constraints, evidence for breaking updates, and moderator notes for challenges and Ask Grok.

The character counter is a conservative Unicode-aware authoring check. X may apply platform-specific weighting to URLs and composed text, so a future publisher must perform authoritative validation again before posting. Copying text is a browser clipboard action. Marking a draft ready does not publish or schedule it.

Starter workspace examples are editable planning material, not verified citations. They cover a DNS history lesson, a VPC analogy idea, and an image-based DNS troubleshooting draft for `@grok`. The Grok preview explicitly says that no response was requested or received.

## Deterministic visual creator

The browser renders six reusable templates:

- Cloud architecture diagram.
- Network troubleshooting challenge.
- Educational fact card.
- Technical comparison.
- Question-and-answer challenge.
- Visual analogy.

Each template supports square `1080 × 1080` and landscape `1600 × 900` PNG output, four restrained accent palettes, editable labels, a title, subtitle, card copy, and branded footer. The live SVG preview and Canvas PNG renderer use the same compact specification. The browser generates PNG bytes only when the operator downloads an image. PostgreSQL stores no base64 payload, and the application does not write to Vercel's temporary filesystem.

The specification is attached to its owner-scoped draft in PostgreSQL. The downloaded image remains the operator's responsibility until durable asset storage is separately selected and configured.

## AI ideas and text drafts

The Ideas workspace can request a bounded 3–5 proposal batch from either recent publisher evidence or an evergreen educational path. Saved ideas and drafts are supplied as duplicate-avoidance subjects. Each result includes a title, subject, format, audience, objective, angle, evidence IDs, verification state, presentation recommendation, and optional safe visual specification. Proposals remain separate from approved content until the owner accepts or rejects them.

The Studio can generate or revise one saved draft with its selected format and optional angle. Validated output is saved through the existing optimistic-concurrency path and adds a revision checkpoint. Source-backed facts, interpretations, and hypothetical examples remain classified. Needs Review flags identify missing evidence, unsafe commands, historical uncertainty, incomplete analogies, and formatting problems.

OpenAI integration is server-only and uses strict Responses API structured output. It is unavailable unless an exact owner session, enable flag, server key, and positive monthly allowance all exist. The default production state is disabled with a zero allowance; Task 13 used mocked provider output and made no paid request. See `docs/AI-CONTENT.md`.

## Owner-initiated AI image workflow

`AiImageProvider` keeps provider calls separate from editorial orchestration and storage. The OpenAI adapter uses the direct Images API to create one PNG, then the Responses API inspects the returned bytes. Image-first copy receives that inspected description rather than an imagined scene. No provider URL or Vercel temporary filesystem is used.

The owner chooses text-only, text-first, or image-first for each draft and can override an AI recommendation. A paid request occurs only after the authenticated owner presses a button that shows the maximum application reservation. Uploaded owner PNGs require a reviewed description and alt text. All assets are attached to the correct owner-scoped draft and kept in private Vercel Blob storage; PostgreSQL retains metadata, generation provenance, dimensions, and the generation-run relationship without storing image bytes.

Official OpenAI documentation distinguishes the direct Images API for single generation/edit operations from the Responses API image tool. This implementation uses the direct API with `gpt-image-2.5-flare`, low quality by default, PNG output, and supported square or landscape dimensions. Charges depend on image and text token use. Review the [OpenAI image-generation guide](https://developers.openai.com/api/docs/guides/image-generation) and [current pricing](https://developers.openai.com/api/docs/pricing) before changing the model, quality, or cost reservation.

Official xAI documentation currently describes `grok-imagine-image-2.0` generation and editing, multiple aspect ratios, 1K/2K output, quality selection, batches, base64 output, and temporary hosted URLs. Current pricing varies by input, resolution, and quality. Review the [xAI image-generation guide](https://docs.x.ai/developers/model-capabilities/images/generation), [model page](https://docs.x.ai/developers/models/grok-imagine-image-2.0), and [pricing](https://docs.x.ai/developers/pricing) immediately before implementation.

Provider capabilities and prices are external and can change. The server validates output type, size, dimensions, inspection text, and owner relationships. Automated tests use mocks; this task made no real image request. xAI remains an unimplemented future adapter.

## Future publishing foundation

The current draft model already separates text, media specification, status, evidence, revisions, and private moderator notes. A future authenticated database model can extend that boundary with approval identities, scheduled publication, idempotency keys, X post/media identifiers, publishing attempts and errors, conversation hubs, replies, engagement snapshots, Grok interactions, and job recommendation drafts.

Those capabilities remain unimplemented. No X API request, Grok request, scheduled publication, analytics collection, or job-post promotion occurs in Task 11.
