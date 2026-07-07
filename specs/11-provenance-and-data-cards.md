# Spec 11 — Provenance Manifest, Data Cards, Methodology Page

Phase 1 · Depends on: nothing (parallel-safe) · Model: Sonnet 5 · Scope: ~2–3 agent sessions

## Objective
Expose the provenance metadata that already exists as a public, buyer-facing contract: a methodology page, a data card per pipeline, and a machine-readable manifest. No new data collection — this is surfacing work.

## Deliverables

### 1. `/methodology` page
Static-ish page (server component, content in `content/methodology.mdx` or a plain tsx — match existing site conventions) covering: the data model (Claim/Source/Edge/MetaEdge/ThresholdEvent/ClaimStatusHistory, in plain language); the epistemicAxis vocabulary (RECORDED/SETTLED/CONTESTED/OPEN/UNRESOLVABLE) and FactStatus failure modes (REVERSED/ABANDONED) with one example each; what humanReviewed vs autoApproved vs verificationStatus mean; the reference-tier test; the editorial scope (adapt the About page's inclusion test and the no-sports/no-markets reasoning); the deprecation policy (deprecate-never-delete). Source material: `AGENTS.md` blocks, `/about`, `HARD_FACTS_DOMAINS.md`. Link from About and footer.

### 2. Pipeline data cards
Extend the existing `/datasets` area (there is an `app/datasets` route and `/api/datasets`): one page per pipeline tag at `/datasets/[tag]` showing — upstream source name + canonical URL; fetch method (API/bulk file/archive crawl); coverage (live counts: total, date range of `claimEmergedAt`, verification mix: humanReviewed / autoApproved / PROVISIONAL / DEPRECATED counts — computed via grouped queries, cached with `revalidate: 3600`); refresh cadence (from a new static registry file, see 3); known failure modes / caveats (hand-written per pipeline — seed from AGENTS.md notes; empty allowed but render "none documented"); deprecation history if any.

### 3. Pipeline registry file
`lib/pipelines/registry.ts` — single typed source of truth: `{ tag, name, upstreamName, upstreamUrl, method, cadence: 'static'|'daily'|'weekly'|'monthly'|'perpetual', caveats?: string, retired?: boolean }` for every active tag in the AGENTS.md registry table + shipped list in ROADMAP.md. This file replaces scattered knowledge; data cards and the manifest render from it + live counts. (~160 entries; transcribe carefully, do not invent tags — every tag must return >0 rows in a verification query, or be marked retired.)

### 4. Machine-readable manifest
`GET /api/v1/manifest` (public, GET-only, cached 1h): JSON array of every pipeline from the registry + live counts + verification mix + last PipelineRun date + license string field (placeholder `"see /license"` until Spec 13). This endpoint is the buyer's first touch — it must be accurate.

### 5. USPTO retirement writeup
Expand `/corrections` with the full Pipeline 5 story from AGENTS.md Known-Bad section: what was fabricated, how it was caught, exact scope (182 claims, 97 patents), what was done (DEPRECATED, retained for audit), and the doctrine change that followed (verifiable-sources rule). Factual tone, no self-congratulation. This is a trust asset — treat it as a permanent page, not a blog post.

## Out of scope
No new ingestion. No schema changes. No API auth (manifest is public). Editorial caveat texts beyond what AGENTS.md/ROADMAP.md already document — flag gaps for the human instead of writing plausible-sounding caveats.

## Acceptance criteria
- Every tag in the registry file returns >0 claims in the DB or is marked `retired` — verified by a checked-in script `scripts/verify-registry.ts` that exits nonzero on mismatch (add to CI).
- `/datasets/[tag]` renders for 5 spot-checked tags incl. one retired (`uspto_v1`) showing deprecation state.
- Manifest counts match direct DB queries for 5 spot-checked tags (paste queries + JSON in PR).
- Methodology page contains no claims about the system that aren't true (human review requested in PR — mark as "needs owner read-through").

## Verification
`scripts/verify-registry.ts` output · spot-check queries vs manifest JSON · screenshots of methodology, one data card, corrections page.
