# RCT results-reporting orphan rates, by condition

## Regeneration command

```
npx tsx findings/2026-07-10-rct-orphan-rates/generate-report.ts
```

This writes `findings/2026-07-10-rct-orphan-rates/data.csv` (one row per trial). Every
number below is a direct aggregate over that file — see "How to reproduce every number"
at the end of this section. Data pulled 2026-07-11 from the public ClinicalTrials.gov v2
API (`clinicaltrials.gov/api/v2/studies`), no API key required, read-only.

## What this measures (read this before the numbers)

**This is not "were the results incorporated into a later review or guideline."** The
dispatch brief for this finding framed the question that way, but no tool in this repo
answers it — that would require matching NCT IDs against citation graphs in Cochrane
reviews or specialty-society guidelines, which is out of scope here (see Limitations).

What `scripts/rct-cohort-report.ts` and its underlying engine
(`tracker/ctgov_adapter.ts` + `tracker/dropped_story_classifier.ts`) actually measure is
narrower and prior in the causal chain: **whether a completed randomized trial's results
were ever posted to the ClinicalTrials.gov results database at all.** A trial can't be
incorporated into a systematic review if its results were never made findable anywhere —
so this is a necessary-but-not-sufficient precondition for guideline incorporation, not
a measurement of incorporation itself. This distinction matters and is preserved
throughout this report. The phenomenon itself is documented and named: FDAAA 801
results-reporting noncompliance (prior art: the TrialsTracker project).

The engine's status labels (see `tracker/dropped_story_classifier.ts` for the state
machine):
- **RESOLVED** — results are posted on the registry (`hasResults=true` or a
  `resultsFirstPostDate` is present).
- **STALLED** — completed, no results yet, but still inside a 365-day results-reporting
  grace window (`RESULTS_GRACE_DAYS` in `tracker/ctgov_adapter.ts`) — quiet but not yet
  overdue.
- **ORPHANED** — completed, no results posted, and more than 365 days past completion
  with no registry activity since. This is the "orphan" label this finding reports on.
- **OPEN** — a registry update happened within the last 14 days (rare in a COMPLETED-only
  cohort; almost always a very recently posted result or status edit).

## Query scope

Six conditions, each queried as:

```
AREA[ConditionSearch] "<condition>" AND AREA[OverallStatus] COMPLETED AND AREA[DesignAllocation] RANDOMIZED
```

`DesignAllocation RANDOMIZED` restricts the CT.gov population to actual RCTs (as opposed
to all interventional/observational studies under a condition). No phase filter was
applied — all phases (including NA/not-applicable, common in device and behavioral
trials) are included. Every study matching each query was pulled — this is a full census
per condition as registered on ClinicalTrials.gov as of 2026-07-11, not a sample.

## The numbers

| Condition | n (RCTs) | ORPHANED | ORPHANED % | RESOLVED | STALLED | OPEN |
|---|---:|---:|---:|---:|---:|---:|
| heart failure | 1,785 | 1,211 | 67.8% | 486 | 76 | 12 |
| type 2 diabetes | 5,101 | 3,445 | 67.5% | 1,478 | 155 | 23 |
| breast cancer | 2,927 | 2,062 | 70.4% | 733 | 123 | 9 |
| major depressive disorder | 1,307 | 801 | 61.3% | 449 | 50 | 7 |
| COVID-19 | 2,255 | 1,606 | 71.2% | 581 | 59 | 9 |
| Alzheimer disease | 1,309 | 810 | 61.9% | 422 | 68 | 9 |
| **All 6 combined** | **14,684** | **9,935** | **67.7%** | **4,149** | **531** | **69** |

Data cells: `data.csv`, group by `condition`, count by `computed_status`. E.g. heart
failure ORPHANED = count of rows where `condition == "heart failure"` and
`computed_status == "ORPHANED"` (1,211 of 1,785 rows).

## Supplementary cut: is this a legacy artifact or a current problem?

Grouping the same 14,684 rows by completion year instead of condition, using
`completion_date` (falling back to `primary_completion_date` when `completion_date` is
blank; 91 of 14,684 rows have neither and are excluded from this cut only):

| Completion era | n | ORPHANED | ORPHANED % | RESOLVED | RESOLVED % |
|---|---:|---:|---:|---:|---:|
| pre-2010 | 2,170 | 1,747 | 80.5% | 423 | 19.5% |
| 2010–2019 | 5,987 | 3,880 | 64.8% | 2,101 | 35.1% |
| 2020–2026 | 6,436 | 4,217 | 65.5% | 1,625 | 25.2% |

The orphan rate is highest for the oldest cohort (unsurprising: ClinicalTrials.gov's
results database, and FDAAA 801's reporting mandate, postdate many pre-2010 trial
registrations) but stays above 60% even for trials completed in 2020–2026 — this is not
purely a legacy-registration artifact. Data cells: same `data.csv`, grouped by year
extracted from `completion_date`/`primary_completion_date`.

## Methodology

1. For each of 6 conditions, pull every `COMPLETED`, `DesignAllocation=RANDOMIZED` study
   from the CT.gov v2 API (`tracker/ctgov_adapter.ts:searchStudies`), paginating to
   exhaustion (no page cap).
2. Classify each study with the unmodified engine (`tracker/ctgov_adapter.ts:classifyStudy`
   → `tracker/dropped_story_classifier.ts:computeStatus`), as-of the pull date
   (2026-07-11).
3. Write one CSV row per study with the raw registry fields used in classification
   (`overall_status`, `has_results`, `completion_date`, `primary_completion_date`,
   `results_first_post_date`) plus the computed status and the engine's stated reason.
4. Aggregate by condition and by completion year in this report; no other transformation.

`scripts/rct-cohort-report.ts` was not modified — it only accepts one query per run and
prints a markdown report, not a multi-condition CSV, so this finding required a small
driver (`generate-report.ts`, in this folder) that imports the same unmodified
`tracker/ctgov_adapter.ts` and `tracker/dropped_story_classifier.ts` and loops it across
conditions, writing CSV. No classification logic was changed or reimplemented.

**Type check note:** `npx tsc --noEmit` was run repo-wide. This environment has no
`node_modules` installed at all (no `@types/node`, `vitest`, `next/server`,
`@prisma/client`, etc.), so the whole repo currently fails type-check for reasons
unrelated to this finding — including `tests/`, `vitest.config.ts`, and every file that
references `process` or `node:fs`. `tsconfig.json` already `exclude`s the `scripts/`
directory for this same reason (its ad-hoc scripts assume a Node runtime type environment
that isn't in scope for the strict app build). `generate-report.ts` is not excluded (it
lives under `findings/`), so it surfaces the same six environmental
`Cannot find name 'process'`/`'node:fs'` errors as everything else in this environment —
no logic/type errors were found. The real correctness check for this script is that it
ran to completion via `npx tsx` end-to-end against the live API, producing all 14,684
rows in `data.csv` (`tsx` executes directly without a separate type-check step, so the
missing `@types/node` declarations did not block it).

## Limitations

- **Does not measure guideline/review incorporation.** Restated from the top of this
  report because it's the most important caveat: ORPHANED means "no results ever posted
  to ClinicalTrials.gov," not "never cited in a systematic review or clinical guideline."
  A trial could in principle have posted results elsewhere (a journal, a company report)
  without ever posting to the CT.gov results database, and would still show ORPHANED
  here. Conversely, a trial with RESOLVED status (results posted) is not thereby shown to
  have influenced any guideline — this report makes no claim about downstream use of
  RESOLVED trials either.
- **Six conditions, not a random sample of conditions.** They were chosen to span common
  chronic-disease and pandemic-era therapeutic areas (cardiology, endocrinology,
  oncology, psychiatry, infectious disease, neurology) but were not drawn by any
  statistical sampling procedure. Do not extrapolate the 67.7% combined figure to "RCTs
  in general" without checking other conditions.
- **`DesignAllocation RANDOMIZED` is CT.gov's own field**, self-reported by trial
  sponsors at registration. Misclassified or unpopulated allocation fields would cause
  under- or over-inclusion; this was not independently audited beyond the 6 spot-checks
  in `checks.md`.
- **STALLED trials are a moving target.** 531 trials are inside the 365-day
  results-reporting grace window as of 2026-07-11; a rerun of this script next year will
  reclassify most of them as either RESOLVED or ORPHANED, so the ORPHANED percentages
  above will drift with the pull date even for the identical study set. The
  `as_of_date` column in `data.csv` records the pull date used.
- **The engine is intentionally conservative.** Per its own documentation (see the header
  comment in `tracker/dropped_story_classifier.ts`), when evidence for abandonment is
  ambiguous it defaults to STALLED, not ORPHANED. If anything, the ORPHANED figures above
  are a floor, not a ceiling.
- **No results ≠ no data ever collected or shared.** A trial can be legitimately exempt
  from FDAAA 801 reporting requirements (e.g., certain non-drug/device or early-phase
  studies) or may have data made available through non-registry channels (a published
  paper, a data-sharing repository) that this pipeline does not check. This report only
  looks at the CT.gov results-posting field.

## How to reproduce every number in this section

1. Regenerate `data.csv` with the command at the top of this file.
2. Group rows by `condition` and count by `computed_status` for the first table.
3. Group rows by the year-prefix of `completion_date` (or `primary_completion_date` when
   blank) into the three eras above, and count by `computed_status` for the second table.

No number in this report was computed, adjusted, or estimated outside of that
grouping/counting over `data.csv`.
