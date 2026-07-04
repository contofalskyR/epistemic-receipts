# Corpus Promoter — Bulk Deterministic Backfill Plan

**Date:** 2026-07-03
**Replaces:** the per-claim LLM loop (`loop-corpus-promoter.sh`, 3 claims/run, ~885 days) as the strategy for the ~1.27M single-step claims. The LLM promoter survives, but with a much smaller, better-targeted queue (§5).
**Script:** `scripts/bulk-promote-corpus.ts` (preflight/dry-run by default). Verified against a fixture Postgres: 26/26 checks — inserts, guards, chain integrity, idempotency, both waves.

---

## 1. Corrections to the briefing (read this first)

The briefing assumed single-step claims sit at `toAxis=RECORDED` and just need a forward `RECORDED→SETTLED` push. The baseline rows were created by `ingest-auto-trajectories.ts` (Layer 1), and its per-pipeline templates say otherwise:

| Briefing assumption | Reality (Layer-1 template) | Consequence |
|---|---|---|
| Legislation single-steps are RECORDED; "add RECORDED→SETTLED" | All `*_legislation_v1` baselines are **already SETTLED** (`null→SETTLED` @ enactment) | The proposed rule would no-op. These claims are **born-settled** — their single-step curve is already the honest, complete arc. No second row exists to add without fabricating an earlier date we don't have. |
| `drugsatfda_v1` grouped with `openfda_labels_v1` under one rule | `drugsatfda_v1` baseline is **SETTLED**; `openfda_labels_v1` is **RECORDED** | Only `openfda_labels_v1` gets a forward rule. |
| `crossref_retractions_v1`: "add RECORDED→REVERSED" | Baseline is **already `null→REVERSED`** @ retraction date | Adding another REVERSED would duplicate it. The correct fix is to **prepend** the publication row (`null→RECORDED` @ pub date) and re-point the baseline's `fromAxis` to `RECORDED` — exactly the two-row shape `populate-retraction-curves.ts` Phase A produces. That requires a one-column amendment of the existing row, so it's opt-in (wave 2). |
| "1.27M claims have predictable arcs" | True for far fewer | Most of the 1.27M are **complete as they stand** (§3). The real promotable set is ~200k (wave 1) + ~26k (wave 2). |

Also inherited from Layer 1: baseline rows always have `occurredAt = claimEmergedAt`, `datePrecision = claimEmergedPrecision ?? 'DAY'`, `sourceId = NULL`, cuid ids. Claims with `claimEmergedAt IS NULL` never got a baseline — that's the bulk of the 363,607 "no history" claims; re-running `ingest-auto-trajectories.ts` after date backfills is the fix there, not this script.

## 2. Wave 1 — pure additive completion (default)

`RECORDED → SETTLED`, community `INSTITUTIONAL`, `occurredAt = claimEmergedAt`, one `INSERT … SELECT` per pipeline. Existing rows untouched. Deterministic id `${claimId}-${toAxis}-${YYYY-MM-DD}` (the briefing's slug convention) + `ON CONFLICT DO NOTHING` + a strict single-step filter → idempotent twice over.

| Pipeline | Single-step (briefing) | Rationale for same-date settle |
|---|---|---|
| `voteview_v1` | 113,318 | A certified roll-call result is institutionally settled the day it enters the official record. |
| `openfda_labels_v1` | 84,931 | The approved label is the operative regulatory document from its effective date. |
| `congress_votes_v1`, `uk_commons_v1`, `openparliament_ca_v1`, `howtheyvote_eu_v1`, `eu_parliament_v1`, `tweedekamer_v1` | (preflight reports) | Same vote-certification logic. |
| `canada_bills_v1` | ≤1,067 | Ingester scope is Royal-Assent bills only, so SETTLED @ assent is safe. |

Every rule is guarded by `expectedEntryAxis`: a claim whose baseline isn't the shape the rule was written for is skipped and surfaced in the preflight as "UNEXPECTED entry axis." Claims missing `claimEmergedAt` are skipped and counted (never fabricate dates).

**Same-date rendering:** the new row shares `occurredAt` with the baseline. All curve queries ordered by `occurredAt` alone — ties rendered in nondeterministic order. Patched in this change: `orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }]` in `app/page.tsx`, `app/law-settler/page.tsx`, and api routes `trajectories`, `trajectories/[id]`, `trajectories/search`, `history`, `labs/claim-diff`, `og/trajectory`. Deploy this before or with the backfill.

**`--sync-axis` (default OFF):** optionally sets `Claim.epistemicAxis` to the new terminal status for promoted claims. Flipping ~113k voteview claims RECORDED→SETTLED changes site-wide stats and filters — decide deliberately, run any time later (idempotent, keyed off the deterministic row id).

## 3. Reclassify-as-complete (no writes — a decision, not a backfill)

The briefing's "1.27M problem" mostly isn't a backlog; it's a metric counting finished curves as unfinished. Recommend defining `COMPLETE_SINGLE_STEP` pipeline sets and excluding them from "needs promotion" counts (promoter queue, corpus stats):

- **Born-settled** (baseline SETTLED is the whole arc): all `*_legislation_v1` (~250k+ incl. hungary 69k, argentina 26k, czech 24k, italy 17k, chile 16k, romania 14k, brazil 13k…), `drugsatfda_v1` (46k), courts/UN/treaties, `nobel_v1`, `rxnorm_v1`, `mesh_v1`, `icd11_v1`, `nist_constants_v1`, `who_essential_medicines_v1`, `periodic_table_v1`…
- **Born-recorded** (RECORDED is the honest terminal state until a real-world contest event): indicators (`worldbank_v1` 55k, `who_gho_v1` 34k, `vdem_v1` 20k, `fred_v1`, `sipri_*` — values subject to revision; auto-settling them would be epistemically sloppy), registries (`chebi_v1` 25k, `pubchem_v1`, `omim_v1`, `openalex_journals_v1` 13.5k), archives (`nara_catalog_v1` 50k, `jacar_v1` 14k, `frus_v1`, `loc_collections_v1`…), filings (`sec_edgar_v1`, `fec_*`, `doj_fara_v1`), events (`usgs_eq_v1`, `nuclear_tests_v1`, `space_missions_v1`…).

This honestly resolves roughly 500–900k of the 1.27M. A "settling curve of length 1" is a real epistemic claim: *nothing has moved yet*. Faking motion would be the USPTO lesson in new clothes.

**Implemented 2026-07-03:** the classification is now code — `lib/corpus-completeness.ts` (full partition of all 186 Layer-1 pipelines into BORN_SETTLED 120 / BORN_RECORDED 47 / WAVE1_PROMOTED 9 / WAVE2_RETRACTIONS 3 / CONDITIONAL 5 / NEEDS_LLM 2). `scripts/corpus-completeness-report.ts` (read-only) verifies it against live counts and flags unclassified pipelines. `pick-promotable-claim.ts` now excludes complete pipelines from the LLM queue.

## 4. Wave 2 — retractions (opt-in: `--wave 2 --allow-entry-amend`)

For `crossref_retractions_v1` (26,624 single-step): prepend `null→RECORDED` at the original publication date, then one-column `UPDATE` of the baseline (`fromAxis: null → 'RECORDED'`), producing the canonical `RECORDED(pub) → REVERSED(retraction)` chain.

**Prerequisite (discovered 2026-07-03):** `ingest-retractions.ts` stores NO publication date in metadata (`dataset, doi, title, firstAuthor, journal, publisher, updateType` only) — the raw preflight finds zero date coverage. But it was verified against the live CrossRef API that the ingester's works ARE the original papers (`update-to` self-refers, titles prefixed "RETRACTED:"), so `metadata.doi` is the original DOI and CrossRef's `published` field is the original publication date — fetched by the ingester but discarded. `scripts/backfill-retraction-pub-dates.ts` re-runs the same cursor sweep (~27k works, minutes), and writes `metadata.originalPublished` ("YYYY-MM-DD" | "YYYY-MM" | "YYYY") matched on the indexed unique `externalId`. Dry-run default.

Then wave 2 runs with `--pub-date-key originalPublished`. Guards: date must parse (ISO → DAY, "YYYY-MM" → MONTH at the 1st, bare year → YEAR at Jan-1 — truncated-timestamp + precision label, the schema's own convention) and strictly precede the retraction date; failures are skipped, never guessed. Expect some skips where CrossRef's deposited `published` equals the retraction date (publisher metadata quirk) — those are honest residue for the LLM queue, as are `retraction_watch_v1` (55) and `nz_repealed_acts_v1` (same REVERSED shape, different metadata — future wave-2-style rules). Claims already curved by `populate-retraction-curves.ts` are multi-step and automatically excluded.

This is the one place the briefing's "never modify existing rows" constraint must bend — otherwise the claim would carry two `fromAxis=null` entry points, breaking Layer-1's baseline invariant (`statusHistory: none fromAxis=null`) and curve-chain semantics. Hence the explicit consent flag.

## 5. What the LLM promoter should do afterward

- `openalex_v1` (217,421) — the only large pipeline whose arcs genuinely need research. Point `pick-promotable-claim.ts` here ~exclusively; prioritize by `metadata.cited_by_count` if present so effort lands on claims someone will read. **Implemented 2026-07-03 (phase 3):** picker is openalex-only (cited_by_count desc, tier alternation removed, `--pipeline` override for residue runs); `loop-corpus-promoter.sh` rewritten — openalex-primary prompt (retraction/replication/meta-analysis/consensus checks, SKIP expected for most papers, no settling on citation count alone), batch size 8 (`BATCH_SIZE` env-tunable), Telegram messages renamed "Openalex promoter". Attempted-ledger paths unchanged for continuity.
- Editorial CONTESTED/REVERSED passes over born-settled corpora (the interesting legislation is the *repealed* statute, the *withdrawn* drug — cf. `nz_repealed_acts_v1`). That's curation, not bulk.
- `nara_catalog_v1` / `jacar_v1` only when a case study touches them.
- Wave-1 vote pipelines need no LLM follow-up.

## 6. Edge cases & data-quality watch list

1. **Entry-axis mismatches** — preflight lists single-step rows whose baseline axis differs from template (e.g. seeded before a template change). Skipped by guards; triage manually if counts are material.
2. **Duplicate-transition risk** — `ClaimStatusHistory` has no unique constraint beyond the PK; Layer-1's `skipDuplicates` is documented as a no-op. Deterministic ids are the only dedup guard — keep the slug convention for all future bulk writers. (Worth a real `@@unique([claimId, toAxis, occurredAt])` migration eventually.)
3. **`sourceId` is NULL** on baselines and on these new rows. Consistent with Layer 1, but below the `populate-retraction-curves.ts` bar ("markers resolve to a REAL existing Source"). Optional follow-up: attach each claim's primary Edge source to the promoted row.
4. **Bills in flight** — `congress_bills_tracker_v1` (17,240) and `nz_bills_v1` are *introductions*; the 119th Congress isn't over, so blanket SETTLED would be wrong. Future wave 3: metadata-conditional rule (became-law → SETTLED @ action date; died with congress → ABANDONED @ term end). `metadata.latestActionDate` exists; outcome fields need preflight inspection.
5. **Pooled connections** — use `--direct` (DIRECT_URL) for execution; statements run with `SET LOCAL statement_timeout='600s'` inside a transaction (AGENTS.md timeout rule).
6. **Precision drift** — new rows inherit `claimEmergedPrecision ?? baseline.datePrecision ?? 'DAY'`; year-precision claims produce year-precision transitions, as they should.

## 7. Run book

```bash
# 1. read-only preflight — verify projected counts & mismatches
npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts

# 2. review exact SQL
npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --print-sql

# 3. pilot one pipeline, then verify on-site rendering of a few claims
npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --execute --direct --pipeline canada_bills_v1

# 4. full wave 1
npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --execute --direct

# 5. wave 2 — backfill pub dates from CrossRef, preflight, then execute
npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-retraction-pub-dates.ts            # dry run
npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-retraction-pub-dates.ts --execute
npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --wave 2 --pub-date-key originalPublished
npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --execute --direct --wave 2 --allow-entry-amend --pub-date-key originalPublished

# 5b. completeness verification (read-only) — final §3 numbers
npx dotenv-cli -e .env.local -- npx tsx scripts/corpus-completeness-report.ts

# 6. optionally, later: axis sync
npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --execute --direct --sync-axis
```

Rollback: promoted rows are exactly identifiable (`id LIKE '%-SETTLED-%'` with the rule's reason text, or the wave-2 `PUB_REASON`); delete by reason + reset wave-2 `fromAxis` to null. Every step is re-runnable; nothing depends on script-side state.
