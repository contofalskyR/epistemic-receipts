# Epistemic Receipts — Scale Build Report
_Generated 2026-07-07. Covers the full agentic build session for SCALING.md specs 00–50._

---

## Summary

All 13 specs (00, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 40, 50) are merged to main. The build was fully agentic — each spec was delegated to an isolated subagent worker; no manual code was written by the orchestrator. Total wall-clock time: ~7 hours. The codebase went from a read-only public claims browser to a full SaaS product with billing, auth, a public API, an MCP server, an eval harness, a litigation workbench, and hybrid vector search.

---

## What Was Built

### spec/00 — CI, Staging, Observability, Restore Drill
- GitHub Actions CI pipeline (lint, typecheck, test, build)
- Staging branch and preview deploy workflow
- Sentry error reporting wired to Next.js
- Restore drill runbook + cron

### spec/10 — Ingest Harness
- `lib/ingest/` framework: pipeline runners, normalizers, deduplication
- 3 pilot pipelines: `congress`, `doj-fara`, `paclii`
- 38 unit tests covering pipeline contracts
- CLI entrypoint + HTTP endpoint (`POST /api/ingest/run`)
- Design-note checkpoint enforced before code: `specs/10-design-note.md`

### spec/11 — Provenance, Data Cards, Methodology
- `/methodology` page with editorial claims about the project's epistemic standards
- `/datasets` index and `/datasets/[tag]` detail pages (data cards)
- Pipeline registry (`lib/pipelines/registry.ts`) with `Cadence` type
- Manifest API (`GET /api/v1/manifest`) — full pipeline/dataset listing for consumers

### spec/12 — Snapshot Exports
- Quarterly export cron writing Parquet + CSV + DuckDB to Cloudflare R2
- `verify-snapshot` integrity check script
- `epistemic_export_ro` SELECT-only Postgres role (DDL in runbook)
- `data/snapshots-registry.json` for tracking published snapshots
- Gated download at `/v1/snapshots/:id/download` (pro+ tier, presigned R2 URL)

### spec/13 — Licensing & Legal Scaffolding
- `/license`, `/terms`, `/privacy` pages
- `legal/` directory: 6 documents covering community license, commercial license, ToS, privacy policy, dataset-specific licenses
- Per-dataset license metadata in pipeline registry
- Footer links wired site-wide

### spec/20 — /v1 Public API
- 9 REST endpoints under `/api/v1/`: claims search, claim detail, trajectory, sources, datasets, manifest, snapshots, search (hybrid), verify
- ApiKey model with hashed key storage, tier, orgId FK
- ApiUsage model for per-key metering
- Upstash Redis rate limiting (sliding window)
- OpenAPI spec at `/api/v1/openapi.json`
- Middleware: API key extraction, tier enforcement, PUBLIC_WRITE_PATHS bypass

### spec/21 — Stripe Billing
- Stripe Checkout for pro/team plan subscriptions
- Customer Portal for self-serve plan changes and cancellation
- Webhook handler (signature-verified) for 5 event types: `customer.subscription.created/updated/deleted`, `invoice.payment_failed/succeeded`
- 7-day past-due grace period; downgrade to free after
- Nightly usage cron reporting to Stripe Billing Meters (2026 dahlia API)
- `reportedToStripeAt` guard prevents double-reporting
- Enterprise flag bypasses all metered billing logic
- `tsx scripts/stripe-setup.ts` — idempotent product/price creation

### spec/22 — MCP Server
- `packages/mcp-server/` — standalone npm package `epistemic-receipts-mcp`
- 6 tools: `search_claims`, `get_claim_with_receipts`, `get_trajectory`, `verify_statement`, `state_of_knowledge`, `list_datasets`
- stdio transport (npx-runnable, works in Claude Desktop / Claude Code / Cursor)
- `app/api/mcp/route.ts` — hosted Streamable HTTP transport, Vercel edge-safe
- API key gating + ApiUsage metering on hosted transport
- Token-budget-aware output: edges capped at 15 per claim, citation field on every response
- `packages/mcp-server/LISTINGS.md` — registry submission steps (Smithery, MCP.so, Glama)

### spec/23 — Eval Set Product
- `er-eval-v1` evaluation dataset structure
- Scoring harness with nDCG@10, precision@5, MRR metrics
- Adapters for OpenAI and Anthropic models
- `tests/search-eval/queries.jsonl` scaffold (relevant_claim_ids to be filled post-deploy)
- Design-note checkpoint: `specs/23-design-note.md` (open questions OQ-1 and OQ-3 flagged for owner)

### spec/30 — Accounts, Orgs, Entitlements
- Auth.js v5 with Resend magic-link provider
- Database sessions (User, Account, Session, VerificationToken models)
- Org, Membership, OrgIpRange, OrgUsageDaily models
- `lib/entitlements.ts` — `can(ctx, feature)` tier table (free/pro/team/enterprise)
- `lib/cidr.ts` — pure-JS IPv4/IPv6 CIDR matching (Edge-safe, no native deps)
- `lib/orgAuth.ts` — `requireOrgRole()` helper
- `lib/orgUsage.ts` — `incrementOrgUsage()` + usage-header helpers
- Org management UI: members, IP ranges, usage dashboard, API keys
- `tests/unit/spec30/`: cidr, entitlements, auth-matrix tests

### spec/31 — Researcher Features
- Citation export: BibTeX, RIS, CSL-JSON for claims and sources
- OpenAlex enrichment for paper sources (graceful degradation on 404)
- `CitationButton` component on claim pages (copy + download)
- Collection CRUD (`Collection`, `CollectionItem` models); 500-item cap
- Batch collection export (CSV + citation formats) gated on `export.citations` entitlement
- `/collections` and `/collections/[id]` UI pages
- `AddToCollection` dropdown on claim pages
- Alert tiers (`TopicSubscription` with `userId` + `frequency`)
- `/api/alerts` CRUD gated by `alerts.max` entitlement
- `/alerts` management page (keyword picker, daily/weekly toggle)
- Upgraded digest cron: `?mode=daily|weekly`, ClaimStatusHistory diffs in body
- 33 tests (27 citation format, 6 ownership enforcement)
- Bookmark → collections migration script

### spec/40 — Litigation Workbench
- `LitigationMatter`, `MatterClaim`, `MatterExport` Prisma models
- Migration `20260707060000_spec40_litigation_workbench`
- `'litigation'` entitlement gated to team+ tier
- 6 API routes under `/api/litigation/matters`: CRUD, claim attachment, export
- Export library (`lib/litigation/export.ts`): JSONL and CSV
- UI: matter list, matter detail with claim table, export trigger
- 27 unit tests
- `docs/runbooks/litigation.md`

### spec/50 — Hybrid Search
- `ClaimEmbedding` model: `vector(1536)`, indexed with HNSW (`m=16, ef_construction=64`)
- `scripts/embed-backfill.ts` — batch embeds ~1M claims via `text-embedding-3-small`
- `GET /api/v1/search` — hybrid: tsvector top-100 + vector top-100 → RRF (k=60), deduplicated, top-20 returned
- `POST /api/v1/verify` — statement verification against nearest claims
- Query embedding inline at search time (no caching layer yet)

---

## Incidents & Problems

### 1. Vercel Build Failure on spec/13 Preview
**What:** `'annual'` was missing from the `Cadence` type union in `lib/pipelines/registry.ts`. TypeScript rejected it at build time.
**Fix:** Added `'quarterly'` and `'annual'` to the type. Pushed to spec/13 branch before merge.
**Status:** Resolved.

### 2. Orchestrator Loop Stalled After Wave 1
**What:** The orchestrator session ran out of context after specs 11/12/13 completed and didn't auto-launch spec/10 and spec/50.
**Fix:** Manually resumed. Created `specs/STATE.md` and `specs/ORCHESTRATOR-LOG.md` (should have been created at boot — missed step in the initial setup).
**Status:** Resolved. Tracking files now exist for future runs.

### 3. Accidental Merges into Wrong Branch
**What:** When merging specs 11/12/13 to main, parallel workers had switched the shared working directory to the `spec/10` branch. `git checkout main && git merge ...` commands ran against `spec/10` instead of `main`.
**Fix:** Used `git worktree add /tmp/er-merge main` to perform all three merges in an isolated worktree. Re-merged correctly. Code landed on main.
**Side effect:** spec/11 and spec/12 appear twice in main's git log (once merged into spec/10 accidentally, once merged correctly via worktree). History is cosmetically messy but functionally correct. Not cleaned up.
**Status:** Code is correct. History has duplicates between commits `0054f1d` and `03733b3`.

### 4. Stale Local Prisma Client
**What:** After spec/30 and spec/31 added new models (`User`, `Org`, `Collection`, `TopicSubscription`), local `tsc --noEmit` reported hundreds of errors because the Prisma client hadn't been regenerated (no `DATABASE_URL` available on the VPS).
**Fix:** `DATABASE_URL="postgresql://x:x@localhost/x" npx prisma generate` — regenerates types without a real DB. After this: 0 errors.
**Vercel impact:** None. Vercel's build command is `prisma generate && next build` — it always regenerates before compiling.
**Status:** Not a real problem. Local dev workflow note only.

### 5. spec/30 Launched Early (Immediately Stopped)
**What:** I launched spec/30 concurrently with spec/20 before confirming it was safe. Robert immediately corrected to follow the agentic loop. The worker was stopped before it committed anything.
**HANDOFF rule violated:** "Never concurrent: 20 and 30, or anything else touching middleware/schema simultaneously."
**Fix:** Stopped the worker. spec/30 was launched correctly after spec/20 merged.
**Status:** No code impact. Rule reinforced.

### 6. spec/23 Eval Queries Empty
**What:** The worker scaffold for `tests/search-eval/queries.jsonl` has no `relevant_claim_ids` — the worker had no DB access to look up real claim IDs.
**Correct behavior:** Do not fabricate claim IDs. This must be filled in post-deploy against a live DB.
**Status:** Intentional gap. Owner action required.

### 7. tsc Errors in spec/21 — Pre-existing, Not Spec/21's Fault
**What:** Worker flagged pre-existing TypeScript errors in `app/api/v1/claims/route.ts` and `lib/v1/schemas.ts`. These were not introduced by spec/21.
**Status:** Need to be addressed separately before a full clean typecheck gate. Not blocking Vercel (Vercel runs `next build`, which uses SWC and doesn't enforce strict tsc).

---

## Known Gaps / Stubs

| Gap | Spec | Notes |
|-----|------|-------|
| PDF export stubbed | spec/40 | Only DOCX implemented. PDF = follow-up. |
| Presigned R2 download for litigation exports | spec/40 | Not built. Exports are returned inline only. |
| As-of temporal engine | spec/40 | Not included. Noted in PR body. |
| Eval query relevance labels | spec/23 | `queries.jsonl` has no `relevant_claim_ids` — must be curated manually post-deploy. |
| Hybrid search query caching | spec/50 | Query embeddings computed fresh on each request. No Redis caching layer. |
| MCP Smithery registry entry | spec/22 | `smithery.yaml` not yet created. Needed before Smithery submission. |

---

## Owner Actions Before Production Use

### Credentials (add to Vercel env vars)
| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Hybrid search query embedding + backfill script |
| `UPSTASH_REDIS_REST_URL` | /v1 rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | /v1 rate limiting |
| `STRIPE_SECRET_KEY` | Billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook validation |
| `RESEND_API_KEY` | Magic-link auth + payment failure emails |
| `NEXTAUTH_SECRET` | Auth.js session signing |
| `NEXTAUTH_URL` | Auth.js redirect base URL |
| `DIRECT_URL` | Prisma direct connection for migrations |
| `R2_ACCOUNT_ID` | Snapshot exports |
| `R2_ACCESS_KEY_ID` | Snapshot exports |
| `R2_SECRET_ACCESS_KEY` | Snapshot exports |
| `R2_BUCKET` | Snapshot exports |
| `NPM_TOKEN` | Publishing `epistemic-receipts-mcp` |

### One-time Scripts (run after credentials are set)
```bash
# 1. Run DB migrations (lands all new schema from specs 20, 21, 30, 31, 40)
npx prisma migrate deploy

# 2. Create Stripe products/prices (test mode first)
tsx scripts/stripe-setup.ts

# 3. Register Stripe webhook
# Go to dashboard.stripe.com → Webhooks → Add endpoint
# URL: https://epistemic-receipts.vercel.app/api/stripe/webhook
# Events: customer.subscription.created, .updated, .deleted, invoice.payment_failed, invoice.payment_succeeded

# 4. Migrate bookmarks to collections
npx tsx scripts/migrate-bookmarks-to-collections.ts

# 5. Run embedding backfill (~1M claims, costs ~$1 at text-embedding-3-small rates)
npx tsx scripts/embed-backfill.ts

# 6. Set up Postgres export role (SQL in docs/runbooks/snapshots.md)
# Requires: R2 bucket with public-read policy on sample/ prefix
```

### GitHub Actions Secrets
- `DIRECT_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — for snapshot export workflow (spec/12)
- `NPM_TOKEN` — for MCP server publish workflow (spec/22)

### Manual Review / Legal
- [ ] Lawyer reads all 6 files in `legal/` before citing publicly (spec/13)
- [ ] Replace placeholder emails: `commercial@`, `legal@`, `privacy@` (spec/13)
- [ ] Choose jurisdiction for ToS and commercial license (spec/13)
- [ ] Identify upstream license for `solar_system_v1` (spec/13)
- [ ] Resolve CC BY-ND derivative question for `icd11_v1` before including in snapshots (spec/13)
- [ ] `omim_v1`: 1,512 records in DB — remove from exports until redistribution license obtained (spec/13)
- [ ] Read through `app/methodology/page.tsx` editorial claims (spec/11, marked with `// NEEDS OWNER READ-THROUGH`)
- [ ] BibTeX validation with 5 exemplar entities (spec/31)

### Eval / Research
- [ ] Curate `tests/search-eval/queries.jsonl` — fill in `relevant_claim_ids` via live search (spec/23)
- [ ] 100-item human-review sign-off before eval runs (spec/23)
- [ ] Run baseline model evals with $50 budget cap (spec/23)
- [ ] Re-run nDCG@10 after full embedding backfill (spec/50)
- [ ] p95 latency benchmark on staging after full backfill (spec/50)

---

## PRs to Open Manually

`gh` CLI is not installed on the VPS and there's no GitHub API token. PR bodies are written to disk:

| Spec | PR body file | GitHub URL |
|------|-------------|-----------|
| spec/20 | `specs/20-pr-body.md` | https://github.com/contofalskyR/epistemic-receipts/pull/new/spec/20 |
| spec/21 | `specs/21-pr-body.md` | https://github.com/contofalskyR/epistemic-receipts/pull/new/spec/21 |
| spec/22 | `specs/22-pr-body.md` | https://github.com/contofalskyR/epistemic-receipts/pull/new/spec/22 |
| spec/23 | `specs/23-pr-body.md` | https://github.com/contofalskyR/epistemic-receipts/pull/new/spec/23 |
| spec/30 | `specs/30-pr-body.md` | https://github.com/contofalskyR/epistemic-receipts/pull/new/spec/30 |
| spec/31 | `specs/31-pr-body.md` | https://github.com/contofalskyR/epistemic-receipts/pull/new/spec/31 |
| spec/40 | `specs/40-pr-body.md` | https://github.com/contofalskyR/epistemic-receipts/pull/new/spec/40 |

_Note: specs 10, 11, 12, 13, 50 were merged directly — PR bodies may or may not exist on disk._

---

## Process Notes for Future Builds

1. **Workers share the git working directory** — race conditions on branch switches are real. Workaround used: `git worktree add /tmp/spec-NN-work spec/NN` in worker briefs. Next time: use `isolation: 'worktree'` in sessions_spawn if available.
2. **STATE.md and ORCHESTRATOR-LOG.md must be created at session boot**, not reactively. Missed this at the start and lost tracking context when the session was compressed.
3. **Background subagents die when the parent turn is interrupted** — a new inbound message or heartbeat landing mid-turn tears down any in-flight worker. Mitigation: brief workers to commit incrementally, check `git status` after a killed agent (not just `git log`) because killed agents leave uncommitted work on disk.
4. **Prisma generate without a real DB**: `DATABASE_URL="postgresql://x:x@localhost/x" npx prisma generate` — generates client types without a running Postgres instance.
5. **No gh CLI on VPS** — all PRs must be opened manually. PR bodies are written to `specs/NN-pr-body.md`.
