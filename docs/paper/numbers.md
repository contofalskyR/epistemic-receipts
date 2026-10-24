# Numbers for the Data Descriptor

Every figure below comes from a committed query or script and was run on **2026-10-24** (UTC) against the
production database through the read-only role `app_ro` (each session forced to
`default_transaction_read_only = on`). Raw output, with the exact run time, is in `docs/paper/sql/out/`.
The `git` SHA printed in each `.out` header is the branch base (`ec9acd0`); the queries are the versions committed
on `paper/scientific-data`.

Rerun: `scripts/paper/run-sql.sh` (all SQL), `npx tsx scripts/paper/corrections-counts.ts`,
`npx tsx scripts/paper/pipeline-scripts.ts --md docs/paper/sources.md`.

References like **[03 §3c]** mean `docs/paper/sql/03_status_history.sql`, section `3c`.

> The corpus is not frozen: `courtlistener_scotus_v1` gained 13 claims between 2026-09-30 and 2026-10-24, one of
> them on the run date [01 §1d]. Numbers will drift by a handful of rows until the export snapshot (Phase 3) fixes
> a version.

## Definitions used throughout

| Term | Definition | Where in code |
|---|---|---|
| **Corpus** | `Claim.deleted = false` | `lib/corpus.ts` `corpusCount()`; STATUS.md locked decision |
| **Live (default view)** | corpus and `verificationStatus IS DISTINCT FROM 'DEPRECATED'` | `lib/corpus.ts` `LIVE_CLAIM_WHERE` |
| **History row order** | `seq ASC NULLS LAST, occurredAt, createdAt` per claim | `lib/trajectory-list.ts`, `docs/ORDERING-SEMANTICS-2026-07-08.md` |
| **Baseline row** | a claim's first `ClaimStatusHistory` row: the status assigned at ingest. **Not a transition.** | `scripts/ingest-auto-trajectories.ts` (Layer 1), seed scripts |
| **Transition** | any history row after the first | — |
| **Axis change** | a transition whose `toAxis` differs from the previous row's `toAxis` | — |
| **Row-sourced** | `ClaimStatusHistory.sourceId` points to a non-deleted `Source` | — |
| **Sentinel date** | `occurredAt` on 1970-01-01, in year ≥ 2100, or after the run time | — |
| **Curated trajectory** | live claim with `externalId LIKE 'trajectory:%'` | `lib/trajectory-list.ts` `CURATED_WHERE` |

## 1. Claims [01]

| | Count | % of corpus |
|---|---:|---:|
| `Claim` rows, all | 1,758,118 | |
| `deleted = true` | 519 | |
| **Corpus (`deleted = false`)** | **1,757,599** | 100 |
| Live default view (corpus minus DEPRECATED) | 1,757,417 | 99.990 |

The field is **`Claim.verificationStatus`** (nullable free text, no DB enum; the schema comment lists
VERIFIED | PROVISIONAL | DISPUTED | DEPRECATED). Values present [01 §1b]:

| `verificationStatus` | `deleted = false` | `deleted = true` | % of corpus |
|---|---:|---:|---:|
| VERIFIED | 1,386,306 | 497 | 78.875 |
| PROVISIONAL | 220,686 | 0 | 12.556 |
| (null) | 138,163 | 22 | 7.861 |
| DISPUTED | 11,319 | 0 | 0.644 |
| HARD_FACT | 943 | 0 | 0.054 |
| DEPRECATED | 182 | 0 | 0.010 |

`HARD_FACT` is not in the schema comment. The 519 deleted rows are 497 `congress_votes_v1` duplicates (all carry
`metadata.duplicateOf`) and 22 `seed:human-history-trajectories` claims (1 with `duplicateOf`) [01 §1c].

## 2. `epistemicAxis` [02]

`Claim.epistemicAxis` is nullable free text; the documented vocabulary is the Prisma enum `FactStatus` (7 values).
Every value present is in `FactStatus`; nothing else appears [02 §2c].

| `epistemicAxis` | Corpus | % | Live view | % |
|---|---:|---:|---:|---:|
| SETTLED | 859,696 | 48.913 | 859,514 | 48.908 |
| RECORDED | 831,132 | 47.288 | 831,132 | 47.293 |
| REVERSED | 43,148 | 2.455 | 43,148 | 2.455 |
| (null) | 23,128 | 1.316 | 23,128 | 1.316 |
| CONTESTED | 453 | 0.026 | 453 | 0.026 |
| ABANDONED | 34 | 0.002 | 34 | 0.002 |
| OPEN | 4 | <0.001 | 4 | <0.001 |
| UNRESOLVABLE | 4 | <0.001 | 4 | <0.001 |

- Non-null: 1,734,471 of 1,757,599 = **98.684 %**; SETTLED or RECORDED: 1,690,828 = 96.201 % [02 §2g].
- **ABANDONED exists: 34** (seed:medicine 20, congress_bills_tracker 7, law-settler 5, seed-trajectories 1,
  seed:nutrition 1). **UNRESOLVABLE exists: 4**, all `seed:human-history-trajectories`. OPEN: 4, same pipeline.
  CONTESTED 453: 333 in the curated_editorial domain [06 §6b], 114 `openfda_labels_v1`, 4 `courtlistener_scotus_v1`,
  1 each `drugsatfda_v1` and `openalex_v1` [02 §2e].
- Null axis: `nara_catalog_v1` 23,055, `courtlistener_scotus_v1` 73 [02 §2d].
- `epistemicAxis` equals the `toAxis` of the claim's last history row for 1,579,163 claims, differs for 470,
  and 177,966 claims have no history row [02 §2f].

## 3. `ClaimStatusHistory` [03]

### 3.1 Rows and claims

| | Count |
|---|---:|
| Rows, all | 1,822,644 |
| Rows on corpus claims | 1,821,600 |
| Corpus claims with ≥1 row | 1,579,633 |
| Corpus claims with no row | 177,966 |

Rows per corpus claim [03 §3b] (the maximum is 4):

| Rows | Claims | % of corpus |
|---:|---:|---:|
| 0 | 177,966 | 10.126 |
| 1 | 1,338,650 | 76.164 |
| 2 | 240,049 | 13.658 |
| 3 | 884 | 0.050 |
| 4 | 50 | 0.003 |

### 3.2 Baselines vs transitions (corpus) [03 §3c]

| | Count |
|---|---:|
| Baseline rows (first per claim; **not transitions**) | 1,579,633 |
| — of which row-sourced | 12,067 |
| **Transitions (rows beyond the first)** | **241,967** |
| — axis changes (`toAxis` ≠ previous) | 241,737 |
| — same axis as previous row | 230 |
| — non-null date (`occurredAt` is `NOT NULL` in the schema) | 241,967 |
| — non-null `datePrecision` | 241,967 |
| — sentinel date | 37 |
| — non-null source reference (`sourceId`) | 17,952 |
| — sourced, Source has a URL | 17,948 |
| — axis change + row-sourced + non-sentinel date | 17,686 |

**Claims with ≥2 rows (= at least one transition): 240,983** [03 §3d]. Claims with ≥1 axis change: 240,950.

### 3.3 What the transitions are [03 §3l, §3e, §3k]

| Class | Transitions | Same timestamp as previous row | Later than previous | Earlier |
|---|---:|---:|---:|---:|
| **W1** bulk same-date completion (`scripts/bulk-promote-corpus.ts` `WAVE1_RULES`: RECORDED→SETTLED, `occurredAt = claimEmergedAt`, no source) | 205,182 | 205,182 | 0 | 0 |
| **W2** retraction / repeal entry rows (`crossref_retractions_v1`, `nz_repealed_acts_v1`; no row source, the claim's own Edge documents the event) | 18,722 | 0 | 18,722 | 0 |
| **S** row-sourced | 17,952 | 1,150 | 16,779 | 23 |
| **O** other unsourced | 111 | 1 | 110 | 0 |

- W1 by pipeline [03 §3l]: `voteview_v1` 113,318 · `openfda_labels_v1` 84,928 · `eu_parliament_v1` 4,331 ·
  `tweedekamer_v1` 1,530 · `canada_bills_v1` 1,067 · `congress_votes_v1` 8. Every W1 row has the same timestamp as
  the baseline it follows: a relabel on the ingest date, not a change over time.
- W2: `crossref_retractions_v1` 18,280 (prepended publication row, then the REVERSED baseline) and
  `nz_repealed_acts_v1` 442.
- O: 105 of the 111 are `congress_bills_tracker_v1` (RECORDED→SETTLED/ABANDONED without a row source) [03 §3l].
- S by marker-source class [03 §3k2]: a `crossref_retractions_v1` retraction notice 10,894 (10,892 on `openalex_v1`
  papers, 2 on `openalex_journals_v1`); seed scripts and `law-settler` 5,877; `enrich*` per-claim enrichment
  sources 548 across 130 tags; `event:*` 342 (fda_withdrawals 267+1, ofac_delistings 63, scotus_overrulings 11
  [03 §3k]); `manual` 286; other 5. By claim pipeline: [03 §3k] and [03 §3l].
- Transition pairs [03 §3f]: RECORDED→SETTLED 209,718; RECORDED→REVERSED 29,433; SETTLED→REVERSED 916;
  RECORDED→CONTESTED 543; CONTESTED→SETTLED 368; SETTLED→CONTESTED 330; everything else < 200 each.

### 3.4 Trajectory layer: candidate definitions (corpus claims) [03 §3m, §3n]

| Definition | Claims |
|---|---:|
| T0 — ≥1 axis change of any kind (includes 205,182 W1 same-date relabels) | 240,950 |
| **T1** — ≥1 axis change that is row-sourced, has a non-sentinel date, and is dated strictly after the previous row | **15,780** |
| — of which curated trajectories | 5,080 |
| **T2** — T1 plus claims with a W2 retraction/repeal transition dated after the previous row, whose claim has an Edge to a URL-bearing Source | **34,493** |

T1 by pipeline: `openalex_v1` 10,211 (retraction-linked) · `seed:human-history` 3,277 · `seed:medicine` 1,467 ·
`drugsatfda_v1` 268 · `openfda_labels_v1` 140 · `law-settler` 130 · `seed:climate` 63 · `ofac_sdn_v1` 63 ·
`seed:astronomy` 61 · `seed:nutrition` 54 · 7 more pipelines < 15 each. 744 claims have ≥2 dated, sourced axis
changes [03 §3d].

### 3.5 Dates [03 §3g, §3h; 06 §6c]

- Every history row carries an `occurredAt` (column is `NOT NULL`) and a `datePrecision`
  (DAY 1,513,885 · YEAR 272,073 · MONTH 35,316 · QUARTER 326, corpus rows).
- Sentinel-looking dates on history rows (corpus): **6,666 on 1970-01-01** (romania_cnsas 3,872, nara_catalog 1,841,
  czech_legislation 164, vdem 156, …), **74 in year ≥ 2100** (france_legislation 66 on 2999-01-01, chile 8),
  14 in the future before 2100. Nearly all on baseline rows; 37 on transitions.
- `claimEmergedAt` (corpus): null 177,772; on 1970-01-01 6,630; after the run date 88; before 1800 6,788;
  range 0001-03-15 to 2999-01-01. `claimEmergedPrecision`: DAY 1,204,656 · YEAR 268,941 · null 264,434 ·
  MONTH 19,243 · QUARTER 325.

### 3.6 Row-shape checks (all rows) [03 §3i]

80 baseline rows have a non-null `fromAxis`; 60 transitions have `fromAxis` ≠ the previous row's `toAxis`;
761 rows have `seq` null; no row has `seq` different from its rank. 23 row-sourced transitions are dated earlier
than the row before them [03 §3l].

Community [03 §3j]: INSTITUTIONAL 1,364,824 · EXPERT_LITERATURE 439,045 · JUDICIAL 16,176 · PUBLIC 1,451 · MARKET 104.

## 4. Curated trajectories [04]

Definition in code: `lib/trajectory-list.ts` `CURATED_WHERE` = live claim with `externalId` starting
`trajectory:`. (`lib/corpus-completeness.ts` `CURATED_EDITORIAL_PREFIXES` is a pipeline-based notion — `seed:`,
`seed-`, `law-settler`, `book-analysis:` — which adds the 16 `book-analysis` claims.)

| | Count |
|---|---:|
| **Curated trajectories (CURATED_WHERE)** | **5,697** |
| — with 1 history row (not a curve) | 398 |
| — with 2 rows | 4,531 |
| — with 3 rows | 722 |
| — with 4 rows | 46 |
| — with ≥2 rows | 5,299 |
| — meeting T1 (§3.4) | 5,080 |
| `trajectory:` claims, deleted | 22 |

Totals [04 §4d]; T1 figure [03 §3m]. By pipeline: `seed:human-history-trajectories` 3,479 ·
`seed:medicine-trajectories` 1,782 · `law-settler` 220 · `seed:climate` 68 · `seed:astronomy` 62 ·
`seed:nutrition` 57 · `seed-trajectories` 11 · `seed:historical` 10 · `seed-court-reversals` 8 [04 §4b].

`humanReviewed = true` on 21 of them [04 §4d] (seed-trajectories 11, seed-court-reversals 8, one each in
seed:human-history and seed:medicine [04 §4c]). "Curated" here means written by an editorial seed script, not that
the `humanReviewed` flag is set. Of the 1,134 commits touching `scripts/seed-*.ts` (2026-05-03 to 2026-09-02), 745
carry a `Co-Authored-By: Claude …` trailer; trailers by model: Sonnet 4.6 382, Opus 4.8 219, Opus 4.8 (1M context)
142, Opus 4.7 1, Opus 4.6 1 [`scripts/paper/seed-commit-trailers.sh`].

## 5. Source linkage [05]

| | Claims | % of corpus |
|---|---:|---:|
| ≥1 non-deleted Edge to a non-deleted Source | 1,710,995 | 97.348 |
| ≥1 such Source with a URL matching `^https?://host.tld` | 1,690,378 | 96.175 |
| URL via Edge **or** via a history-row marker Source | 1,690,871 | 96.203 |
| No Source at all (no Edge, no marker) | 46,115 | 2.624 |

All four rows: [05 §5a].

- Largest pipelines without a URL-bearing source [05 §5b]: `drugsatfda_v1` 45,987 of 46,255;
  `taiwan_archives_v1` 3,935 of 3,935; `openalex_v1` 3,184; `luxembourg_legislation_v1` 2,555; `fec_finance_v1` 2,260;
  `korea_legislation_v1` 2,114 of 2,114.
- Table sizes [05 §5d]: `Source` 1,688,359 (none deleted; 1,662,804 with a URL); `Edge` 1,720,395
  (1,720,353 not deleted).
- `Edge.type` [05 §5c]: FOR 1,301,209 · CITES 418,973 · AGAINST 103 · RETRACTS 55 · SUPPORTS 10 · CORRECTED 1 ·
  CONTRADICTS 1 · DISPUTES 1. `Source.methodologyType`: primary 1,682,278 · derivative 5,962 · opinion 53 ·
  13 other ad-hoc values (secondary 41, guideline 9, …).
- URL syntax only; liveness is Phase 2.

## 6. Coverage [06]

Domain mapping: `docs/paper/domain-map.csv` (one row per `ingestedBy` value; 10 domains; 0 unmapped). It is
an editorial grouping made for this paper, not a field in the database.

| Domain | Pipelines | Claims | % |
|---|---:|---:|---:|
| legislation_regulation | 90 | 441,789 | 25.136 |
| history_archives | 12 | 380,992 | 21.677 |
| scholarly_literature | 7 | 373,927 | 21.275 |
| medicine_health | 14 | 217,358 | 12.367 |
| legislative_votes | 3 | 117,658 | 6.694 |
| international_governance | 10 | 109,911 | 6.253 |
| natural_sciences_technology | 19 | 83,527 | 4.752 |
| courts | 13 | 15,434 | 0.878 |
| economics_finance | 8 | 11,267 | 0.641 |
| curated_editorial | 11 | 5,736 | 0.326 |

Axis × domain is in [06 §6b]; domain × era in [06 §6f]; domain × decade (long form) in [06 §6e].

Domain × era (`claimEmergedAt`) [06 §6f]:

| Domain | <1800 | 1800–99 | 1900–49 | 1950–89 | 1990–2009 | 2010– | 1970-01-01 | future | null |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legislation_regulation | 36 | 14,235 | 29,842 | 81,010 | 114,699 | 201,241 | 501 | 85 | 140 |
| history_archives | 4,123 | 13,021 | 51,452 | 65,996 | 112,423 | 5,520 | 5,736 | 0 | 122,721 |
| scholarly_literature | 2 | 446 | 2,552 | 19,772 | 122,718 | 228,339 | 90 | 0 | 8 |
| medicine_health | 0 | 0 | 192 | 12,945 | 29,861 | 158,132 | 81 | 3 | 16,144 |
| legislative_votes | 1,039 | 39,454 | 12,029 | 26,096 | 19,286 | 19,754 | 0 | 0 | 0 |
| international_governance | 0 | 0 | 7,318 | 12,820 | 45,025 | 43,241 | 196 | 0 | 1,311 |
| natural_sciences_technology | 169 | 201 | 1,928 | 10,181 | 14,792 | 18,793 | 15 | 0 | 37,448 |
| courts | 0 | 2 | 59 | 1,356 | 12,005 | 2,012 | 0 | 0 | 0 |
| economics_finance | 0 | 0 | 72 | 1,949 | 1,519 | 7,722 | 5 | 0 | 0 |
| curated_editorial | 1,419 | 561 | 934 | 1,116 | 828 | 872 | 6 | 0 | 0 |

By decade, all domains [06 §6d]: 2010s 354,443 · 2000s 312,549 · 2020s 331,197 · 1990s 160,607 · 1970s 75,103 ·
1980s 70,273 · 1960s 62,274 · 1940s 39,816 · 1950s 32,221 · earlier decades and centuries in the output ·
null 177,772.

## 7. Pipelines and source institutions [07; `docs/paper/sources.md`]

| | Count |
|---|---:|
| Distinct `Claim.ingestedBy` (corpus, and all rows) | 187 |
| Distinct `Source.ingestedBy` (non-deleted) | 319 |
| Distinct `Edge.ingestedBy` (non-deleted) | 179 |
| Pipelines with an entry in `lib/pipelines/registry.ts` | 186 of 187 (missing: `book-analysis:…`) |
| Distinct registry `upstreamName` values among them | 175 |
| `scripts/ingest-*.ts` + `scripts/seed-*.ts` files | 194 |
| Pipelines with no writer script in `scripts/` | 1 (`echr_judgments_v1`, 9,984 claims) |
| Pipelines whose writer script calls an LLM | 1 (`book-analysis:cmppvaz700000sal1cnyfutdx`, 16 claims; `claude` CLI, no model pinned) |
| Distinct Source URL hosts, Edge-linked to corpus claims | 2,248 |
| — counting only non-curated pipelines | 1,081 |

Source and edge tags that are not claim pipelines [07 §7d, §7e]: `eu_parliament_votes_v2` (24,224 Sources),
`claude_sourcing_v1` (1,040 Sources, 1,119 Edges), `p7_congress_dedup` (497 Edges), `event:*` (3 tags, 236 Sources:
fda_withdrawals 162, ofac_delistings 63, scotus_overrulings 11) and `enrich*` (131 tags, 669 Sources).

"Source institution" is approximated two ways — registry `upstreamName` (an editorial label in the repo) and URL
host — and neither is a vetted institution list. `sources.md` gives both per pipeline so the list can be made by
hand.

Prompt template / model version: **no bulk ingester calls an LLM**; claim text is built from code templates over
the upstream record. The baseline axis comes from `scripts/ingest-auto-trajectories.ts` and
`scripts/backfill-epistemic-status.ts`, neither of which calls an LLM. LLM-written content is confined to:
the curated seed scripts (hardcoded content; model recorded only as git trailers, §4), the `enrich*` transitions
(corpus promoter: prompt `scripts/corpus-promoter-prompt.md`, model default `claude-opus-4-8` in
`scripts/loop-corpus-promoter.sh`, not stored per row), `claude_sourcing_v1` (model stored per row, §9) and the
16 `book-analysis` claims. Phase 5 documents each from the code.

## 8. Corrections [08; `scripts/paper/corrections-counts.ts`]

Denominator: corpus = 1,757,599.

**On the `/corrections` page** (`app/corrections/page.tsx`, 5 entries):

| Date | Kind | Records affected | % | What |
|---|---|---:|---:|---|
| 2026-10-13 | DIAGNOSTIC | 814 | 0.046 | Roll-call results under review (`data/vote-results-under-review.json`: senate-three-fifths 300, house-suspension 238, senate-tie 190, senate-two-thirds 45, house-tie 29, contradiction 12) |
| 2026-10-13 | CORRECTED | 497 | 0.028 | `congress_votes_v1` duplicates retired (deduped) |
| 2026-10-13 | CORRECTED | 475 | 0.027 | Senate cloture votes relabelled failed |
| 2026-06-08 | CORRECTED | 4,897 | 0.279 | Legacy status values remapped in the `epistemicAxis` backfill (currentStatus VERIFIED 2,011 + epistemicStatus established 2,886, both still present [08 §8e]) |
| 2026-05-12 | RETIRED | 182 | 0.010 | `uspto_v1` deprecated |
| | **Sum** | **6,865** | **0.391** | |

**In the database** [08]:

| | Count |
|---|---:|
| `verificationStatus = 'DEPRECATED'` | 182 (all `deleted = false`) |
| `metadata ? 'deprecation_reason'` | 844 |
| `deleted = true` | 519 (498 with `metadata.duplicateOf`) |
| Claims with `metadata.corrections` | 87,023 |
| — batch `voteview-full-text-2026-10` (truncated texts restored) | 85,987 |
| — batch `p7-q9-stock-act-relabel-2026-10` | 921 |
| — batch `p7-senate-cloture-2026-10` | 475 |
| — batch `p7-q13-lv-results-2026-10` | 39 claims (43 entries; all 39 are deleted dedup claims) |
| Claims touched by any of DEPRECATED / deleted / `metadata.corrections` / `duplicateOf` | 87,685 (87,166 in corpus = 4.959 %) |
| `ClaimStatusHistory` rows (corrections add none) | 1,822,644 |

Three DB correction batches have no `/corrections` page entry: voteview full text (85,987), stock-act relabel (921),
q13 LegislativeVote results (39). `metadata.deprecation_reason` is on 844 claims: the 182 DEPRECATED `uspto_v1`
claims and **662 `nobel_v1` claims that are VERIFIED, not DEPRECATED** [08 §8f] (LATER.md).
Percentages in the page table: `scripts/paper/corrections-counts.ts`.

## 9. Transition sourcing (`claude_sourcing_v1`) [09]

`TransitionSourceCandidate` holds one proposed primary source per targeted transition (5,518 targets: the curated
transitions whose source was Wikipedia or missing).

| Status | Reviewed by | Rows | Promoted |
|---|---|---:|---:|
| accepted | `machine:verify-transition-sources` | 809 | 809 |
| accepted | `machine:verify-transition-sources-api` | 339 | 339 |
| candidate (pending) | — | **4,209** | 0 |
| rejected | `machine:verify-transition-sources` | 88 | 0 |
| no_source_found | — | 73 | 0 |
| **Total** | | 5,518 | **1,148** |

- **All 1,148 accepted sources were accepted by a machine rule; none by a human.** In `Source`/`Edge` they are
  `humanReviewed = false`, `autoApproved = true` (1,040 new Sources, 1,119 new Edges; the rest reused existing rows).
  They cover 978 claims [09 §9b, §9c].
- **What "verified" means in code** — `scripts/lib/transition-sourcing.ts` `autoReviewDecision()`: accept only if
  the URL fetched with HTTP 2xx (local fetch in `scripts/verify-transition-sources.ts`, or the API web-fetch tool in
  `scripts/verify-transition-sources-api.ts`), the model's quoted excerpt matches the page text with score ≥ 0.6,
  the excerpt is not catalogue metadata, and the model's own confidence is ≥ 0.5. Reject only dead links (404/410
  or unresolvable domain). Everything else stays `candidate` for a human. Separately, `urlInSearchResults` (the URL
  was among the web-search results) is true for every accepted row.
- Pending 4,209 by model confidence: < 0.5 3,569 · 0.5–0.7 404 · ≥ 0.7 236; 4,208 have a verify record [09 §9d]
  (they were checked and not accepted).
- Models stored per row: `claude-haiku-5-5`, `claude-sonnet-5-5`. Generation cost stored in the table: $228.78
  [09 §9b]. (Project notes give $242.30 lifetime including the two verification passes; that figure is not in the
  database.)
- `ClaimStatusHistory` is not modified by promotion: the new Source attaches to the claim through an Edge, so these
  1,148 links do **not** change any count in §3.

## 10. Discrepancies with the v1 draft (`scientific_data_draft_v1_robclaw`, 2026-10-16)

1. **"1,822,644 dated epistemic transitions"** — that is every `ClaimStatusHistory` row, including 1,579,633
   baselines (the ingest-time status) and rows of deleted claims. Transitions: 241,967. Of those, 205,182 are W1
   same-date relabels, 18,722 retraction/repeal entry rows, 17,952 row-sourced (§3.2–3.3).
2. **"241,501 settling curves"** — claims with ≥2 rows *including deleted claims*. Corpus: 240,983, and 205K of
   those are W1 relabels on the ingest date, not changes over time. Trajectory layer: T1 15,780 or T2 34,493 (§3.4).
3. **"34,711 exhibit at least one observable status change"** — closest reproducible figure is T2 = 34,493;
   the draft's derivation is unknown.
4. **"Dated transitions cover 90% of the transition record"** — not reproducible. 100 % of rows have a date
   (the column is required); the issue is sentinel dates (6,666 on 1970-01-01, 74 in year ≥ 2100) and W1's
   copied dates, not missing ones.
5. **"Transitions that cannot be dated are excluded rather than estimated"** — contradicted by the 1970-01-01 and
   2999-01-01 rows, and by W1 rows dated by copying `claimEmergedAt`. `bulk-promote-corpus.ts` does skip date-less
   claims; other writers vary (Phase 5).
6. **"Approximately 99% of claims carry a non-null axis"** — 98.684 %. The nulls are `nara_catalog_v1` (23,055)
   and `courtlistener_scotus_v1` (73), not "legacy runs prior to the field".
7. **Seven-value axis described as broadly used** — CONTESTED 453, ABANDONED 34, OPEN 4, UNRESOLVABLE 4; almost
   all from curated/seed pipelines. 96.2 % of the corpus is SETTLED or RECORDED.
8. **"Source linkage 97% (1,688,356 of 1,757,596)"** — 1,688,356 is close to the `Source` table size (1,688,359),
   not a claim count. Claims with ≥1 Edge to a Source: 1,710,995 (97.348 %); with a URL-bearing source:
   1,690,378 (96.175 %).
9. **"Claim generation and label assignment were performed by Claude … per-pipeline prompt templates"** — no bulk
   ingester calls an LLM; claim text comes from code templates and the baseline axis from rule-based scripts. LLMs
   wrote the curated seed content (with git-trailer provenance only), the promoter's `enrich*` transitions,
   the `claude_sourcing_v1` links and 16 `book-analysis` claims.
10. **"over 60 authoritative sources"** — 187 pipelines, 175 distinct registry upstream names, 2,248 URL hosts.
11. **Domain table** — not reproducible from any field; the figures here (§6) come from an explicit mapping and
    differ: the draft has no row for non-US legislation (441,789 here with US laws included), and its
    "Climate and Environment 88,000" matches no pipeline set.
12. **Corrections "6,865 records (0.39%)"** — matches the `/corrections` page sum, but the page omits three DB
    batches (85,987 + 921 + 39 claims). Claims touched by any recorded correction or retirement: 87,166 in the
    corpus (4.959 %). The "657 confirmed mislabeling/fabrication" figure (= 475 + 182) leaves out the 921 stock-act
    relabels and the 85,987 truncated texts.
13. **Corpus 1,757,596** — now 1,757,599 (SCOTUS ingest still running, §1). The "1.76M" headline holds.
14. **Schema names in Data Records** — `claimText` is `text`; `axis`/`effectiveDate` are `toAxis`/`fromAxis`/
    `occurredAt`; `sourceType` is `methodologyType` (primary/derivative/opinion + 13 stray values); `verificationStatus`
    has no ACTIVE or UNDER_REVIEW (actual: VERIFIED, PROVISIONAL, DISPUTED, HARD_FACT, DEPRECATED, null); `Edge` links
    a claim to a Source, not claim to claim. Rewritten from `prisma/schema.prisma` in Phase 2.
15. **The 5,697 curated curves** — 398 have a single history row (not curves) and 617 fail T1; only 21 have
    `humanReviewed = true`. The draft does not mention the curated set, `claude_sourcing_v1`, or that the 1,148
    promoted sources were machine-accepted.
