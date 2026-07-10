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
| 7 | `07-curve-first-domains.md` — CurveExplorer refactor, per-domain rollout | Curve-first product vision | ~1 wk staged | Low (UI refactor, pure) |
| 8 | `08-transition-event-pipelines.md` — contract library, chain CI, dedupe gate, SCOTUS/exoplanet/NZ event pipelines | **BUILT 2026-07-07 — execute, don't rebuild.** Curvable tails of born-settled/born-recorded corpora | Runbook in doc; each next feed ~1 day | Low (preflight-default, contract-enforced) |

Recommended: 01 first (it protects everything the promoter loop writes), then 04 as the main project with 02/03/05 interleaved. 04 and 05 together are what your audit (`AUDIT-WHITEPAPER-GAP-2026-07-03.md`) called the vision-blocking gap — the corpus now has ~350k multi-step curves that no crawler can see.

## Do not

- Restart `loop-corpus-promoter.sh` from a briefing task — the owner restarts it manually after review.
- Modify `scripts/bulk-promote-corpus.ts` waves 1–2 logic (done, verified, ran in production). Extending it with a wave 3 entry point is fine (see 03).
- Rename `logs/corpus-promoter-attempted.jsonl` or other ledger paths.
- Commit `.env.local` or weaken anything listed in the AGENTS.md security-model section.

## Later briefings (09–17)

The table above is the 2026-07-04 post-promoter roadmap (01–08). These are the
session handoffs and specs filed since; each is self-contained, newest state wins.

| # | File | What it is |
|---|------|------------|
| 09 | `09-everything-a-curve.md` | "Make everything a curve" — the settling-curve expansion goal + state (2026-07-08). |
| 10 | `10-HANDOFF.md` | **Canonical state doc** — session-close handoff: corpus counts, the seq/ordering contract, working-relationship notes. Read first for current state. |
| 11 | `11-journalism-angle.md` | Dropped-story tracker — the journalism source handoff + its binding DO-NOT-REDO list. |
| 12 | `12-tracker-integration.md` | Tracker adopt-as-phase-2 verdict + build plan; the non-negotiable boundary (thread statuses NEVER become ClaimStatusHistory; only merits-resolutions graduate via emitTransition). Specs in `tracker/specs/` T1–T7. |
| 13 | `13-curve-expansion-executor-brief.md` | Muscle-domain curve expansion (law/legislation/science/RCT). Phase A (OpenAlex↔CrossRef retraction join) DONE — see its addendum. Phases B–D queued. |
| 14 | `14-project-brief.md` | Cold-start orientation: the observatory thesis, current build, journalism angle — for an agent joining with no context. |
| 15 | `15-axis-leak-fix.md` | Axis-leak (REVERSED/ABANDONED display) handoff. Resolved via the committed read-time fix (`e8886b0`); the write-time-stamp patch it proposed was dropped. |
| 16 | `16-ofac-delistings-spec.md` | OFAC delistings pipeline spec (RECORDED→REVERSED on `ofac_sdn_v1`). Feed-probe-first, NZ-style. Ready to build. |
| 17 | `17-HANDOFF.md` | **Session-close handoff → Fable 5 (2026-07-09 EOD).** Current state, the open board, decisions-not-to-relitigate, execution reality. Start here after 10. |
