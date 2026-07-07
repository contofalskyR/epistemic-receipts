# SCALING.md — Infrastructure & Revenue Build Plan

Companion to `ROADMAP.md` (pipelines/features) — this doc covers how the system and business scale.
Priority order: **AI/data licensing → institutional subscriptions → litigation research → audience.**

The thesis: the scalable asset is not the site — it is the versioned, provenance-rich claim graph plus the audit discipline around it. The site is the demo; the API, snapshot exports, and eval sets are the product. This extends the wedge sequence already in `ROADMAP.md` (Alerts ✅ → Public API → `/ask`) and the investor-memo items (design partner first, `/verify`, retraction feed, methodology page).

---

## Phase 0 — Engineering hygiene (weeks 1–3, prerequisite for selling anything)

You cannot sell data with an SLA on infrastructure you can't safely change. Current gaps: no test suite, no CI, no staging, no observability.

- CI (GitHub Actions): lint, typecheck, migration drift check, small integration suite against throwaway Postgres. Test only critical paths: search, claim-page queries, middleware auth behavior, one ingest-harness round-trip.
- Staging: second Vercel project + Neon branch. Neon branching makes this nearly free; rehearse migrations against production-shaped data.
- Observability: Sentry, structured pipeline logs, uptime checks on customer-facing routes. Turn the "verify ingester counters against DB state" rule into a scheduled reconciliation job instead of a manual habit.
- Backup drill: Neon PITR exists — run one actual restore and document it.
- Cost baseline: Vercel + Neon spend now, so API pricing covers real marginal cost later (egress is the sneaky one).

## Phase 1 — The data becomes a product (months 1–2)

Goal: a third party can consume the corpus, understand its provenance, and trust its versioning — before billing exists.

**1.1 Consolidate ingestion.** 388 one-off tsx scripts don't scale operationally. Extract a shared harness: fetch → normalize → validate → idempotent cursor-resumable upsert → post-run DB-count verification → `PipelineRun` record. Each pipeline becomes config + a source adapter. Schedule through a serverless-friendly runner (Inngest / Trigger.dev / GitHub Actions cron hitting authenticated ingest routes with `CRON_SECRET`). Build the missing `AiJob` worker on the same runner. Target: any pipeline re-runnable, resumable, and monitored unattended — this is also what fixes the partial-run backlog (Hungary, Slovenia, Latvia, MeSH…).

**1.2 Provenance manifest + methodology page.** Every field a buyer needs already exists — expose it as a contract: pipeline tag, upstream URL, ingest date, `verificationStatus`, `humanReviewed`/`autoApproved`, deprecation reason. Publish a data card per pipeline (source, method, coverage, failure modes, refresh cadence) and the open methodology page from the investor memo. The USPTO retirement writeup belongs here publicly: "we caught fabrication, deprecated 182 records, preserved the audit trail" is the single most credible sales asset with AI labs.

**1.3 Versioned snapshot exports.** Quarterly (later monthly) immutable snapshots: JSONL + Parquet per table (claims, sources, edges, trajectories), semver-dated (`er-2026Q3`), changelog per pipeline, SHA-256 checksums, manifest. Host on R2/S3 (cheap egress). This is what a grounding/training customer buys first.

**1.4 License + legal scaffolding.** The public-record facts aren't copyrightable; the compilation, graph, curation, and metadata are the licensable asset (contract-based in the US, database right in the EU). Dual-license: free research/non-commercial with attribution; commercial license for AI grounding/training/redistribution. Needs: legal entity, ToS, license text, one-page rights summary — before the first dollar.

## Phase 2 — API v1 + first revenue (months 2–5)

**2.1 API productization.** Read-only, versioned `/v1` surface separate from the site's internal `/api/*`, with a deprecation policy: `/v1/claims`, `/v1/sources`, `/v1/edges`, `/v1/trajectories`, `/v1/search`, plus the two endpoints ROADMAP.md already identifies as the wedge: `/v1/retractions/since/{date}` (first paying customer: research-integrity desks, publishers) and `/v1/verify?statement=...` (nearest claims + provenance grade + contradicting edges + status timeline — RAG-with-receipts for AI builders). API keys per org, tiered rate limits (extend existing middleware rules), metered usage → Stripe metered billing. Do not build billing.

**2.2 Isolation + caching.** Serve `/v1` from a Neon read replica so a customer crawl never degrades the site; aggressive ETag caching — most reference data is effectively immutable. Free tier requires attribution; paid tiers by volume + bulk-export access ($99–299/mo self-serve per ROADMAP.md, custom for labs).

**2.3 MCP server.** Expose `search_claims`, `get_claim_with_receipts`, `get_trajectory`, `state_of_knowledge(topic, date)` wrapping `/v1`. In 2026 this is the cheapest distribution channel to AI developers: agents grounding answers in your receipts is simultaneously the demo and the funnel.

**2.4 Eval/benchmark product.** `ClaimStatusHistory` is the differentiated asset: dated transitions (including REVERSED/ABANDONED) are raw material for temporal-knowledge and hallucination evals ("what was the consensus on X as of date T?"). Package a curated, versioned eval set with a harness; publish a free slice to establish the citation; sell to eval platforms and lab eval teams.

**2.5 One design partner first** (per investor memo). Don't generalize the API before one AI builder / eval company / RAG-infra startup uses it in anger. Snapshot + API free for a quarter in exchange for feedback and a logo. Grounding buyers pay for freshness — publish refresh SLAs for the living pipelines (Congress, Federal Register, retractions, FDA), which 1.1 makes possible.

## Phase 3 — Institutional subscriptions (months 4–8, overlaps Phase 2)

Universities, libraries, newsrooms, think tanks at $5k–25k/yr; pharma MLR as the six-figure outlier.

- Real accounts: Auth.js/Clerk for users (upgrade path from the anonymous `Profile` + email-subscription base that alerts already created); WorkOS for SSO/SAML when the first university asks. Keep admin-token auth for ops as-is.
- Org entitlements: seats, feature gates (alert volume, saved collections, export quotas, API keys), IP-range access (still how library authentication works), COUNTER-style usage reports for renewals.
- Researcher features that convert: citation export (BibTeX/CSL/Zotero translator — cheap, disproportionately loved), saved collections with notes, higher-volume topic alerts on the existing Resend infra.
- Pharma MLR pilot (from ROADMAP.md): "prove this marketing claim is still supported and rests on nothing retracted" — needs retraction feed + `/verify` + case-study library first; one regulated customer here outweighs ten library deals.
- Sales motion: two or three discounted institutional pilots; scite.ai's library-mediated, FTE-priced playbook is the template.

## Phase 4 — Litigation research workbench (months 8+)

High-ticket, low-volume: toxic tort / product liability research.

- Productize as-of queries: `state_of_knowledge(topic, date)` rendered as a defensible timeline — published, contested, settled, retracted as of a date, every receipt cited. Schema already supports it (`ClaimStatusHistory.occurredAt`); the work is query + presentation.
- Report export: timeline → docx/PDF with citations and a methodology appendix (courts care how the record was assembled — the audit-trail discipline IS the methodology).
- Matter workspaces with access logs; engagement-priced. Sell the tool to historical-research consultancies already doing this manually — don't become a service business.

## Phase 5 — Audience (continuous, funded by the above)

- Case studies are the moat and the marketing: hold a cadence (1–2/month), each with a shareable artifact. They prove the editorial quality that justifies B2B pricing. Prove case-study automation end-to-end once (the investor memo's central question).
- SEO: index the pages with real editorial depth (case studies, trajectories, taxonomies, domain overviews); keep 1M bulk claim pages crawlable but don't make thin programmatic pages the strategy.
- Newsletter on existing Resend infra: "what changed in the record this month."

---

## Database & search scaling notes

Postgres is not the bottleneck. 1M claims with current indexes is comfortable; tens of millions still fine on a bigger Neon plan. Revisit partitioning only past ~100M rows in one table. Real risks in order: connection exhaustion under API load (read replica + pooling), unindexed graph traversals as Edge/ClaimRelation densify (watch query plans), and search quality — 384-dim MiniLM embeddings are the weakest link; upgrade the model and add an HNSW index on the pgvector column before search becomes a paid feature. tsvector is fine until customers complain; then Meilisearch/Typesense, not Elasticsearch.

## Invariants that must survive scaling

The editorial rules are the brand: reference-tier test gates every new bulk pipeline; `humanReviewed` stays honest; deprecate, never delete; receipt value > audit cost or the pipeline retires; the 2026-06-12 security model stays intact — every `/v1` surface read-only and rate-limited by default; neutrality governance documented publicly before it matters.

## What NOT to build

User-generated claims (moderation cost destroys the audit guarantee). Verdicts or truth scores (no-verdict stance is the differentiation). A consumer fact-check app (donation-funded elsewhere for a reason). Self-built billing/auth/search where Stripe/Clerk/WorkOS/Meilisearch exist. A general `/ask` engine before the API has customers — ROADMAP.md is right to sequence it last.

## Sequencing summary

| Phase | Window | Deliverable | Revenue |
|---|---|---|---|
| 0 | Weeks 1–3 | CI, staging, observability, restore drill | — |
| 1 | Months 1–2 | Ingest harness, data cards + methodology page, versioned snapshots, license | Enables sales |
| 2 | Months 2–5 | `/v1` + keys + metering, retractions feed, `/verify`, MCP server, eval set, 1 design partner | First contracts |
| 3 | Months 4–8 | Accounts, SSO, org entitlements, library pilots, pharma MLR pilot | $5k–25k/yr per institution |
| 4 | Months 8+ | As-of workbench, report export, matter workspaces | High-ticket engagements |
| 5 | Continuous | Case-study cadence, newsletter, automation proof | Funnel |
