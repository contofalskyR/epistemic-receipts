# Briefing 03 — Wave 3: Metadata-Conditional Promotions

## Scope

The five CONDITIONAL pipelines in `lib/corpus-completeness.ts` — claims whose completing transition is deterministic once you read each claim's outcome from metadata (or a bulk source), no LLM required:

| Pipeline | Baseline | Completing rule (proposed — verify against real metadata first) |
|---|---|---|
| `congress_bills_tracker_v1` (~17k) | `null→RECORDED` (introduced) | became law → `RECORDED→SETTLED` @ enactment/action date; died with its congress → `RECORDED→ABANDONED` @ that congress's end date — ONLY for congresses that have actually ended (119th ends 2027-01-03; until then most bills stay honestly single-step) |
| `nz_bills_v1` | `null→RECORDED` | same pattern, NZ Parliament terms |
| `nz_repealed_acts_v1` | `null→REVERSED` (repealed) | wave-2-style: PREPEND `null→SETTLED` @ enactment date + re-point baseline `fromAxis` to SETTLED (requires the entry-amend consent flag, same as wave 2) |
| `clinicaltrials_v1` | `null→RECORDED` (registered) | completed with results → `RECORDED→SETTLED`? — probably NOT: a completed trial is still just recorded evidence. Consider `RECORDED→RECORDED` being meaningless → likely only terminated/withdrawn trials get `RECORDED→ABANDONED` @ status date. Decide from the data and defend it in writing |
| `clinical_trials_v1` | `null→CONTESTED` | small/legacy pipeline — inspect, then either mirror clinicaltrials_v1 or reclassify |

## How to build it

Extend `scripts/bulk-promote-corpus.ts` with `--wave 3` (do NOT modify waves 1–2). Follow the existing structure exactly: preflight default, per-rule entry-axis guards, deterministic ids, `--execute`/`--direct`, `--allow-entry-amend` for the nz_repealed prepend, DB verification after. Reuse `singleStepJoin`; add metadata-conditional predicates per rule.

**Preflight first, rules second.** The proposed rules above are hypotheses. The preflight must report, per pipeline: metadata key inventory, outcome-field value distributions (e.g. `latestActionText` patterns for bills — `readPriorActionDate` in `ingest-congress-bills-tracker.ts` shows `latestActionDate` exists; the outcome field needs discovery), and how many claims each candidate predicate would match. Only then finalize the SQL. If an outcome isn't stored (likely for older NZ bills), either backfill it from the source API (Congress.gov API key is in `.env.local` as CONGRESS_API_KEY; LEGISinfo for Canada precedent) or leave those claims single-step.

**Dates:** enactment/action dates from metadata; congress end dates are public constants (hardcode a small table with citations). Never `now()`, never approximations.

## Constraints

- ABANDONED is a first-class outcome (schema comment says so) — use it for died-in-congress bills without hedging.
- A bill in a sitting congress is OPEN business: no transition. Re-running wave 3 after a congress ends picks up the newly-determined outcomes — design the predicates so that's automatic (idempotency makes re-runs safe).
- Same house rules as all waves: bind params, no fabricated dates, fixture-test against a local Postgres before touching Neon (embedded-postgres pattern from the 2026-07-03 session).

## Verification

- Fixture tests: one per rule, covering match, non-match (in-flight bill), idempotent re-run, and the nz_repealed two-statement prepend+amend chain.
- Preflight projected counts ≈ executed counts ≈ DB-verified counts.
- Sample 5 promoted bills against Congress.gov by URL.
- Update `lib/corpus-completeness.ts` (CONDITIONAL → note which are now handled) and the plan doc §6.4.
