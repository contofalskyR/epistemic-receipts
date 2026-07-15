# Build Brief #10 — Semantic search activation (spec-50 close-out)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-14)
**Lane:** search/ops. **This brief contains ONE owner-gated DB write** (the embedding backfill) and one owner-gated index build — both were pre-approved in spec 50 and BUILD-STATUS as pending owner actions, but per the data doctrine each still gets its own explicit yes at execute time.

**The spec is `specs/50-search-embedding-upgrade.md` — decided architecture, merged code.** This brief activates it; it does not redesign it. The eval-before-ship rule is the spine: **no search behavior changes until the eval says hybrid wins.**

---

## 0. Gates + orientation

1. **Owner gates (confirm before dispatch):** `OPENAI_API_KEY` set in Vercel env + available to the VPS script environment; the backfill spend cap env set (HANDOFF-OPENCLAW cap: $25/run until raised); Brief #7 merged (its `@xenova/transformers` finding interacts with S-5).
2. Sync main. Read: spec 50 in full, `CONSULTANT.md` **Migration Runbook** (advisory-lock caveat, `CREATE INDEX CONCURRENTLY` never in a transaction, pause ingest loops before migrating), `specs/BUILD-STATUS.md` spec-50 owner actions, `lib/embeddings.ts`, `lib/search.ts`, `scripts/embed-backfill.ts`, `app/api/cron/embed-incremental/route.ts`, `tests/search-eval/`.
3. Standing rails: branch `loop/search-b10-<date>`, `B10-n:` commits, push + PR, owner merges. Bind-parameterized SQL only. Blocked beats invented.

## Phases

### B10-1 — Preflight census (read-only)

Confirm and report actual state before touching anything: `ClaimEmbedding` table exists (migration applied?) and its row count; backfill script's flags/cursor/resume mechanics as-built; spend-guard env name; incremental cron behavior key-less vs keyed; `lib/search.ts` hybrid path present-but-dormant vs absent; `tests/search-eval/queries.jsonl` state (expected: 60 queries, empty `relevant_claim_ids`). Any mismatch with spec 50's deliverables list → report before proceeding.

### B10-2 — Eval curation + baseline (read-only; do FIRST, per the spec)

Fill `relevant_claim_ids` for all 60 queries using live search + manual browsing against the real DB — graded judgments, real claim IDs only (the prior worker correctly refused to fabricate them; you have DB access, so now they can be real). Then run the eval runner against **current production search** and record the baseline table (nDCG@10 + recall@50, overall + per-category). Commit: curated eval set + baseline numbers. This is the measuring stick everything after gets judged by.

### B10-3 — The backfill (owner-gated execute)

Doctrine sequence, no shortcuts: pilot `--limit 25` → verify 25 rows in DB with correct model/dims/contentHash → kill-restart the pilot to prove resumability and no duplicate spend (contentHash guard) → artificially-low-cap run to prove the spend guard trips → **CHECKPOINT memo to owner** (row target ≈ all non-deleted claims, cost estimate at ~$0.02/1M tokens, runtime estimate, the exact command) → **owner's explicit yes** → full run (resumable, from the VPS, not Vercel) → DB-verified coverage count (target: 100% of non-deleted claims; report the exact number and every skip).

### B10-4 — Index build (owner-gated, Migration Runbook applies)

HNSW (`m=16, ef_construction=64`, cosine) AFTER backfill completes, via `prisma db execute` with `CONCURRENTLY` — never inside a transaction, never via `migrate dev`. Pause ingest cron loops first per the runbook; resume after. If the build fails on Neon plan memory limits, fall back to IVFFlat (lists=1000) **and say so in the report** — the spec forbids silently shipping unindexed. Verify with a before/after latency probe on one vector query.

### B10-5 — Eval verdict + the flip

Run the full eval matrix: baseline vs tsvector-only vs vector-only vs hybrid. **Ship rule (spec 50, verbatim): hybrid ships only if it beats baseline on overall nDCG@10 AND does not regress the navigational subset.** If it passes: wire `/search` (and `/v1/search` + `verify` if those surfaces are live from spec 20) to the hybrid path, one commit, eval table in the PR body. If it fails: no flip, FLAG with the table — tsvector stays, and that is a fine outcome to report.

### B10-6 — Aftercare

- p95 hybrid latency on production-size data, with and without index, pasted (<500ms target).
- Incremental job proof: confirm the nightly cron picks up new claims (use a recent pipeline claim; contentHash diff → embedding appears; no writes by you — the cron does it, you verify).
- Legacy MiniLM retirement: per B7-3's investigation outcome, remove `@xenova/transformers` + the legacy path if the hybrid flip shipped (closing the RCE-class audit finding), or document why it stays.
- `docs/runbooks/search.md` updated with what actually happened (real numbers, real fallbacks chosen).

## Report

`briefs/b10-report.md`: preflight state, the full eval matrix, backfill coverage + cost actuals vs estimate, index type shipped, latency table, retirement status, and the one-line headline: what a user's search does differently now (or doesn't, and why).

## STOP conditions

Key or cap missing; backfill wanting to run without the checkpoint-yes; index build failing both HNSW and IVFFlat; eval regression on navigational queries; any temptation to hand-tune eval judgments after seeing results (judgments freeze at B10-2 commit); two consecutive failures on one criterion. Blocked beats invented.
