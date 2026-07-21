# Build Brief #17 — The Canon: most-cited papers, audited

**To:** RobClaw / Fable on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-17)
**Lane:** site. **One owner-gated data write** (C-3, the ledger import) — everything else read-only. Parallel-safe with B15/B16 (no file overlap).

**What this ships:** a destination page for the corpus promoter's most expensive product. ~271 top-cited papers now carry loop-built settling curves and 252 more carry an honest "reviewed, no adjudicating event found" verdict — the curves are invisible as a collection (the explorer shows only curated trajectories) and the review verdicts exist solely in a gitignored local ledger. `/canon` makes both visible: every ≥5,000-citation paper, ranked, each with its audit state. When the fable ≥4,000 tier runs, its ~980 verdicts land here instead of vanishing into logs.

---

## 0. Orientation

Sync main; newest handoff; standing rails (worktree, branch `loop/site-b17-<date>`, owner merges, no nav additions). Read: `scripts/pick-promotable-claim.ts` (the ≥5,000 gate + metadata field extraction — reuse its exact `cited_by_count` handling), `logs/corpus-promoter-attempted.jsonl` + `corpus-promoter-decisions.jsonl` schemas (claimId, ts, result, skipReason, model, costUsd, turns), `SettlingCurveMini`, `cleanDisplayText` (paper claim text needs title-first rendering), `/patterns` (visual sibling — this page should feel like its shelf-mate).

## Phases

### B17-1 — Census (read-only)

Report before building: (1) openalex_v1 claims with `cited_by_count ≥ 5000` — total, and how many are multi-step vs single-step; (2) `cited_by_count` coverage overall (the backfill's reach — how many openalex claims carry no count at all, so the page's population statement is honest about what "most-cited" can see); (3) ledger tallies (promoted/skipped by model, date range); (4) overlap check — how many ≥5k papers got curves from OTHER sources (retraction join, seeds) rather than the promoter, so the page's copy attributes correctly ("curves come from the research loop and pipeline joins," not "the loop built all of these").

### B17-2 — `/canon` v1 (no data writes)

Server-rendered, ISR `revalidate = 3600`, linked from `/patterns`, `/start-here`, and the explorer's tab row if it composes cleanly (no nav entry — nav-trim discipline):

- **Population:** openalex_v1 claims with `cited_by_count ≥ 5000`, ranked by citations desc. Header states the denominator plainly: "N papers above 5,000 citations · M carry multi-step settling curves." If the census found count-coverage gaps, the header's fine print says what the ranking can't see.
- **Row anatomy:** title-first text (`cleanDisplayText`), year, citation count (compact format per house rule), curve-state chip + `SettlingCurveMini` where multi-step, link to the claim page. Reversed/retracted papers get the REVERSED chip color — those rows are the page's headline drama and will sort high given retraction-join coverage.
- **Filters:** All / Curved / Reversed / Single-step. Client-side over the loaded page or query-param — census row-count decides (if total ≤ ~2,000, load-and-filter; else paginate at 50 with server filters).
- **Honesty copy, non-negotiable:** single-step does NOT mean nothing happened — the state label reads "no verified settling event" and the page's one-paragraph intro says the loop only writes transitions it can source, so absence of a curve is absence of a *verified adjudicating document*, not a verdict about the paper. No quality/truth framing anywhere — citations rank visibility, not merit; say so.
- Metadata export, sitemap entry, PUBLIC_ROUTES addition in the same commit (the B6-2 lesson — no orphaned publish gate).

### B17-3 — The review-status import (owner-gated data write, the page's v2)

The 252 "reviewed, no event found" verdicts move from the local ledger into the DB so the page can render them:

- `scripts/import-promoter-review-status.ts`: reads the attempted ledger, writes `metadata.promoterReview = { reviewedAt, result, model }` onto each skipped claim (merge, never clobber; deterministic; idempotent; cursor-resumable; dry-run default). The ledger lives on the owner's Mac — the script is built to run there (like the ingests), or from a ledger copy the owner provides; state which in the checkpoint memo.
- Chain: dry-run counts → CHECKPOINT memo (row count ≈252, exact command) → **owner yes** → execute → DB-verified count.
- Page v2 then renders the third state: "Reviewed <date> · no settling event found" chip (muted, with the model attribution in the tooltip/detail, not the row — the receipt is the review, not the reviewer).
- Make the import re-runnable as a standing post-tier step: after the fable ≥4,000 tier completes, one re-run imports its skips. Note it in the report as the owner's post-tier checklist line — do NOT wire it into the loop itself (out of scope).

### B17-4 — Verification

tsc/ESLint/vitest green; view-source shows real titles + counts; the three states render correctly against known claims (one promoter-curved, one retraction-join REVERSED, one imported skip after C-3); denominator header matches an independent count query; filters + pagination sane; `/patterns` cross-link works both ways; Vercel preview green.

## Report

`briefs/b17-report.md`: census table (the population + coverage numbers), the C-3 checkpoint memo + owner yes, states spot-check, screenshots-equivalent curl greps, and one editorial note for the owner: the top-10 rows of the page as shipped (they're the marketing material — "the most-cited paper ever reviewed by the loop is X, and here's what happened to it").

## STOP conditions

C-3 executing without its recorded yes; any framing that reads citations as merit or single-step as failure; metadata clobbering instead of merging; population statement hiding the count-coverage gap; two consecutive failures on one criterion. Blocked beats invented.
