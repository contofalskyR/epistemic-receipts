# Agent Briefings — Post-Promoter Roadmap

**Date:** 2026-07-04. Written after: wave 1 (205,679 vote/FDA promotions), wave 2 (18,280 retraction curves), completeness reclassification (790,611 single-step claims marked complete, `lib/corpus-completeness.ts`), and phase 3 (LLM promoter retargeted to openalex_v1, loop ready to restart).

Each briefing is self-contained: context, verified current state, tasks, constraints, and a verification section. Read the briefing fully before writing code. House rules apply to all of them:

- **Never fabricate data or dates.** If a value can't be sourced, skip and count the skip. (AGENTS.md; the USPTO Pipeline-5 incident is the cautionary tale.)
- **Dry-run / preflight by default.** Writes only behind an explicit `--execute` flag.
- **Bind-parameterized SQL only** (`$1..$n` + spread args). Never interpolate values into query strings (SECURITY-REVIEW-2026-06-12 / AGENTS.md security model).
- **Verify against DB state**, not in-script counters, after every write phase.
- **Deterministic ids + idempotency** for any bulk ClaimStatusHistory writes: `${claimId}-${toAxis}-${YYYY-MM-DD}`.
- **Reference implementations:** `scripts/bulk-promote-corpus.ts` (bulk deterministic writes, preflight pattern, sqlt tag), `scripts/populate-retraction-curves.ts` (curation discipline), `CORPUS-PROMOTER-BULK-PLAN.md` (decisions log).

## Order of execution

| # | Briefing | Blocks | Effort | Risk |
|---|----------|--------|--------|------|
| 1 | `01-data-layer-hardening.md` — dup audit → unique constraint → axis sync → deploy | Restarting the LLM loop safely; 04's stats accuracy | ~1 day | Medium (one migration, one mass UPDATE) |
| 2 | `02-no-history-date-backfill.md` — fold 363k history-less claims into Layer 1 | Final completeness numbers | 1–2 days | Low (additive) |
| 3 | `03-wave3-conditional-pipelines.md` — bills, repealed acts, clinical trials | Nothing; opportunistic | 1 day | Low |
| 4 | `04-ssr-machine-readability.md` — SSR receipts, metadata, sitemap | The entire "queryable infrastructure" thesis | 3–5 days | Medium (touches core pages) |
| 5 | `05-integrity-fixes.md` — live counts, cited-claim curation, scope, polish | Credibility of 04's newly-visible pages | 1–2 days | Low |
| 6 | `06-quiet-reversals.md` — citation trajectories → candidates → LLM → human gate | White paper Future Work #2; needs 01 done + promoter runtime | Phase A ~3 days of sweeps; then ongoing | Medium (editorial assertions — human-gated) |

Recommended: 01 first (it protects everything the promoter loop writes), then 04 as the main project with 02/03/05 interleaved. 04 and 05 together are what your audit (`AUDIT-WHITEPAPER-GAP-2026-07-03.md`) called the vision-blocking gap — the corpus now has ~350k multi-step curves that no crawler can see.

## Do not

- Restart `loop-corpus-promoter.sh` from a briefing task — the owner restarts it manually after review.
- Modify `scripts/bulk-promote-corpus.ts` waves 1–2 logic (done, verified, ran in production). Extending it with a wave 3 entry point is fine (see 03).
- Rename `logs/corpus-promoter-attempted.jsonl` or other ledger paths.
- Commit `.env.local` or weaken anything listed in the AGENTS.md security-model section.
