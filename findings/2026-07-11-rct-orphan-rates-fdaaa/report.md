# RCT orphan rates on the tightened FDAAA cohort

## Regeneration command

The query in the original brief (`AREA[Phase] PHASE2 PHASE3 PHASE4 AND ...`) returns
CT.gov API error 400 ("Allowed values for enum field ... are NA, EARLY_PHASE1, PHASE1,
PHASE2, PHASE3, PHASE4") — the Essie parser does not accept three bare enum values
space-separated inside one `AREA[]` clause; they must be joined with explicit `OR`.
Verified directly against the live API with `curl` before running the full pull. The
corrected query is the one actually used below (see `scripts/rct-cohort-report.ts`,
which was also extended in this session to emit a full per-study CSV — before this
change it only recorded rows for the ORPHANED bucket, not enough to trace every count
in this report back to an individual record).

```
npx tsx scripts/rct-cohort-report.ts \
  --query 'AREA[Phase] (PHASE2 OR PHASE3 OR PHASE4) AND AREA[OverallStatus] COMPLETED AND AREA[PrimaryCompletionDate] RANGE[01/01/2008, 12/31/2023]' \
  --max-pages 5
```

Run on 2026-07-11 against the public ClinicalTrials.gov v2 API, read-only, no DB writes.

## Cohort definition and rationale

An "applicable clinical trial" (ACT) under FDAAA (FDA Amendments Act of 2007, signed
2007-09-27, 42 U.S.C. §282(j)) is, in brief: a Phase 2-4 interventional trial of an
FDA-regulated drug, biologic, or device, with a primary completion date on or after
2007-12-27, that must post summary results to ClinicalTrials.gov within 12 months of
primary completion (absent an extension). This Phase-2/3/4 + completion-date-range
cohort definition is the one used across the results-reporting compliance literature —
Zarin et al. 2015 NEJM ("highly likely applicable clinical trials," HLACTs) and DeVito,
Bacon & Goldacre 2020 Lancet both restrict to non-Phase-1 interventional trials
completed within a bounded window for the same reason: Phase 1 trials and trials
predating the Act are outside the legal reporting requirement, so including them would
understate the true violation rate.

This run used `AREA[OverallStatus] COMPLETED` and a primary-completion window of
2008-01-01 through 2023-12-31 (per the dispatch brief), pulling the first 500 matching
studies returned by the API's default ranking (5 pages x 100/page) out of **68,036**
total matches for the same query (confirmed via `countTotal=true` on the same
endpoint). **This is a 500-study sample of the cohort, not the full cohort** — see
Limitations.

## Results

Total trials pulled: **500** (`data.csv`, 500 data rows).

| Status | Count | Share | data.csv rows |
|---|---|---|---|
| OPEN | 1 | 0.2% | `classifiedStatus == OPEN` |
| STALLED | 0 | 0.0% | `classifiedStatus == STALLED` |
| RESOLVED | 241 | 48.2% | `classifiedStatus == RESOLVED` |
| ORPHANED | 258 | 51.6% | `classifiedStatus == ORPHANED` |

**Orphan rate: 258 / 500 = 51.6%** — of this sample of FDAAA-scope trials completed
2008-2023 and checked as of 2026-07-11, just over half never posted results on
ClinicalTrials.gov and have gone dark (no registry activity in the classifier's orphan
window) well past the 365-day results-reporting grace period this tool applies.

STALLED is 0 by construction here: STALLED requires either a known pending trigger
(trial still in progress, or completed but inside the 365-day grace window) or recent
registry activity within 21 days. Because the query restricted to `overallStatus:
COMPLETED` with primary completion dates through 2023-12-31, and today's as-of date is
2026-07-11, every trial in this cohort is at least ~2.5 years past its own primary
completion date — well past the grace window — so a trial here is either resolved
(results posted), open (a registry edit happened to land inside the classifier's
14-day activity window), or orphaned. See `checks.md` #3 for the one OPEN case and why
its label is a known quirk, not a sign the trial is actively enrolling.

Primary completion dates in the pulled sample range from 2008-01 to 2023-12-15 and are
reasonably distributed across the 16-year window (21-43 trials per completion year;
full year-by-year counts reproducible from `data.csv`), so the sample is not obviously
clustered in one era, though the API's ranking algorithm — not chronological or random
order — determined which 500 of 68,036 were returned (see Limitations).

## Comparison to published benchmarks

Two prior peer-reviewed studies measure the same underlying phenomenon (FDAAA-scope
trials that never post results) with different cohorts and windows:

- **Zarin et al. 2015, NEJM** ("Trial Reporting in ClinicalTrials.gov — The Final
  Rule," DOI 10.1056/NEJMsa1409364; PMC4508873). Cohort: 13,327 "highly likely
  applicable clinical trials" completed or terminated 2008-01-01 through 2012-08-31.
  Findings: only 13.4% (1,790/13,327) reported results within the mandated 12-month
  window; 38.3% (5,110/13,327) had reported at any point within their observation
  window — implying **~61.7% had never reported** within that window.
- **DeVito, Bacon & Goldacre 2020, The Lancet** ("Compliance with legal requirement to
  report clinical trial results on ClinicalTrials.gov: a cohort study," DOI
  10.1016/S0140-6736(19)33220-9). Found ~40.9% on-time compliance (within the 1-year
  deadline) for trials due to report in the 2018-2019 window — i.e. ~59.1% were
  overdue/non-compliant at that snapshot (not the same as "never," since some overdue
  trials eventually report).

This run's 51.6% ORPHANED sits between those two "never/overdue" figures (61.7% and
59.1%), which is a plausible range given the different methodology described below —
it is not a like-for-like replication of either paper, and should not be quoted as
confirming or contradicting either.

## Limitations (read before citing this number anywhere)

1. **Sample, not census.** 500 of 68,036 matching trials (0.7%), pulled by the CT.gov
   API's default relevance-style ranking, not a random sample and not the full cohort.
   A different 500 could give a different rate. This is a shakedown-cruise sample, not
   a publication-grade estimate.
2. **"Never reported by 2026-07-11," not "never reported within a fixed post-completion
   window."** Zarin's 61.7% is "never within 5 years of the cohort's close." This
   run's ORPHANED trials range from 2.5 years to 18 years past completion (see
   `checks.md` #1 and #6) — a much longer, uneven observation window per trial, which
   mechanically pushes the never-reported rate up relative to a fixed-window study.
3. **RESOLVED means "ever reported," not "reported on time."** `checks.md` #4 shows a
   trial whose results posted ~16 months after primary completion — outside FDAAA's own
   12-month deadline, but still counted RESOLVED here. This run cannot distinguish
   on-time compliance from eventual-but-late reporting; the literature's "13.4%" /
   "40.9%" figures specifically measure on-time compliance, which is a stricter and
   different bar than this report's RESOLVED bucket.
4. **The OPEN status label is inherited from a news-tracker design and can mislead for
   completed trials.** `ctgov_adapter.ts` treats every registry field edit (a metadata
   touch, not just a status change) as a "material development." `checks.md` #3 is a
   completed trial correctly excluded from ORPHANED (it's still inside its 365-day
   grace window) but labeled OPEN — as if actively recruiting — because someone edited
   its registry record 2 days before the as-of date. This doesn't affect the ORPHANED
   count but the OPEN label itself is not reliable evidence of trial activity.
5. **Classification is deterministic from CT.gov's own structured fields
   (`overallStatus`, `hasResults`, `resultsFirstPostDateStruct`), not adjudicated by a
   human or an LLM reading each record.** It cannot detect, e.g., results published in
   the CT.gov "Study Results" module under a different mechanism, results posted to a
   national registry outside ClinicalTrials.gov, or a legitimate reporting-requirement
   waiver/certificate of delay on file with FDA (`checks.md` #5 notes one such
   adjacent-but-distinct field, `dispFirstPostDateStruct`, that the classifier
   correctly does not treat as a results post).
6. **6 hand-verifications, not a systematic audit.** `checks.md` covers 6 records
   (4 ORPHANED across a range of ages/sponsor types, 1 RESOLVED, the 1 OPEN edge case)
   picked to stress the classifier's boundaries, not a random or exhaustive audit of
   all 500.

## Data

`data.csv` — all 500 pulled studies, one row each: `nctId, title, sponsor,
primaryCompletionDate, completionDate, overallStatus, hasResults, classifiedStatus,
reason`. Every count above is a row-count filter over this file.
