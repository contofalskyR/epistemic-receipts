# Two-thirds of completed randomized trials in six major disease areas never posted results

We pulled every completed, randomized-allocation trial registered on ClinicalTrials.gov
under six conditions — heart failure, type 2 diabetes, breast cancer, major depressive
disorder, COVID-19, and Alzheimer disease — and checked one thing for each: did the
trial's results ever get posted to the registry's results database?

Across all 14,684 trials, 67.7% never did — and are more than a year past their
completion date with no results in sight, past the point where a "still processing" grace
period is a fair explanation. That share is not evenly distributed: it ranges from 61.3%
(major depressive disorder) to 71.2% (COVID-19).

**What we are not claiming.** This does not mean two-thirds of trial evidence is missing
from medicine's collective knowledge. Some of these trials' results were likely published
in journals or shared through other channels even though they were never entered into the
ClinicalTrials.gov results database — this analysis has no visibility into that. We are
also not claiming anything about whether trials that *did* post results were subsequently
cited by a systematic review or clinical guideline; that is a separate, harder-to-answer
question about downstream use that this dataset cannot address (see Limitations in
`report.md`). What we can say concretely is narrower: a large majority of completed RCTs
in these six conditions have no results on the one registry the U.S. government requires
many of them to report to.

We also checked whether this is a legacy problem — old trials registered before
ClinicalTrials.gov even had a results database — or a live one. It's both: 80.5% of
pre-2010 completions never posted results, but even trials completing in 2020–2026 sit at
65.5%. This has not gone away.

## Methodology (short version)

Every `COMPLETED`, `DesignAllocation=RANDOMIZED` trial per condition was pulled from the
public ClinicalTrials.gov API (no sampling — full census per condition as of 2026-07-11)
and run through a deterministic classifier that reads each trial's `overallStatus`,
`hasResults`, and completion/results-posting dates. A trial is "orphaned" only if it's
COMPLETED, has no posted results, and is more than 365 days past completion with no
registry activity since — trials inside that one-year grace window are labeled STALLED,
not orphaned. Full methodology and limitations: `report.md`. Six of the underlying rows
were individually hand-verified against the live registry: `checks.md`.

## Claims table

| Claim | data.csv reference | Regeneration command |
|---|---|---|
| 14,684 completed RCTs pulled across 6 conditions | all rows, `wc -l data.csv` minus header | `npx tsx findings/2026-07-10-rct-orphan-rates/generate-report.ts` |
| 67.7% (9,935 of 14,684) never posted results ("ORPHANED"), combined across all 6 conditions | rows where `computed_status == "ORPHANED"`, all conditions | same as above |
| Heart failure: 67.8% orphaned (1,211 of 1,785) | rows where `condition == "heart failure"` | same as above |
| Type 2 diabetes: 67.5% orphaned (3,445 of 5,101) | rows where `condition == "type 2 diabetes"` | same as above |
| Breast cancer: 70.4% orphaned (2,062 of 2,927) | rows where `condition == "breast cancer"` | same as above |
| Major depressive disorder: 61.3% orphaned (801 of 1,307) | rows where `condition == "major depressive disorder"` | same as above |
| COVID-19: 71.2% orphaned (1,606 of 2,255) | rows where `condition == "COVID-19"` | same as above |
| Alzheimer disease: 61.9% orphaned (810 of 1,309) | rows where `condition == "Alzheimer disease"` | same as above |
| Pre-2010 completions: 80.5% orphaned (1,747 of 2,170) | rows grouped by completion year < 2010 (`completion_date`/`primary_completion_date` fallback) | same as above |
| 2010–2019 completions: 64.8% orphaned (3,880 of 5,987) | rows grouped by completion year 2010–2019 | same as above |
| 2020–2026 completions: 65.5% orphaned (4,217 of 6,436) | rows grouped by completion year 2020–2026 | same as above |
| 531 trials currently inside the 365-day results-reporting grace window ("STALLED") | rows where `computed_status == "STALLED"`, all conditions | same as above |
| 6/6 hand-verified rows matched the live ClinicalTrials.gov registry exactly | `checks.md`, Checks 1–6 | curl commands documented in `checks.md` |
