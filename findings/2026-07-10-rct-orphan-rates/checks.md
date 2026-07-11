# Hand verifications

All 6 checks below were executed on 2026-07-11 by fetching each study directly from the
ClinicalTrials.gov v2 public API (the same primary source the pipeline itself reads) and
comparing the response against the corresponding row in `data.csv`. The human-readable
equivalent of each API call is the study page at `https://clinicaltrials.gov/study/<NCT
ID>`, linked below for independent spot-checking. Raw API responses were captured with:

```
curl -s "https://clinicaltrials.gov/api/v2/studies/<NCT_ID>?fields=protocolSection.identificationModule.nctId,protocolSection.identificationModule.briefTitle,protocolSection.statusModule,hasResults" -H 'User-Agent: epistemic-receipts/1.0 (rct-tracker verification)'
```

## Check 1 — ORPHANED, heart failure
- URL: https://clinicaltrials.gov/study/NCT00764075
- data.csv row: `heart failure, NCT00764075, overall_status=COMPLETED, has_results=false, completion_date=2011-06, computed_status=ORPHANED`
- Verified: API response confirms `overallStatus: COMPLETED`, `hasResults: false`,
  `completionDateStruct.date: "2011-06"`. No `resultsFirstPostDateStruct` field present
  at all (never submitted). Completion is ~15 years before the as-of date, far past the
  365-day grace window.
- **PASS**

## Check 2 — ORPHANED, type 2 diabetes
- URL: https://clinicaltrials.gov/study/NCT05152277
- data.csv row: `type 2 diabetes, NCT05152277, overall_status=COMPLETED, has_results=false, completion_date=2022-08-24, computed_status=ORPHANED`
- Verified: API response confirms `overallStatus: COMPLETED`, `hasResults: false`,
  `completionDateStruct.date: "2022-08-24"`. No results field posted. ~3.9 years past
  completion as of the 2026-07-11 pull, past the 365-day grace window.
- **PASS**

## Check 3 — ORPHANED, breast cancer
- URL: https://clinicaltrials.gov/study/NCT03292328
- data.csv row: `breast cancer, NCT03292328, overall_status=COMPLETED, has_results=false, completion_date=2020-09-15, computed_status=ORPHANED`
- Verified: API response confirms `overallStatus: COMPLETED`, `hasResults: false`,
  `completionDateStruct.date: "2020-09-15"`. Registry record was last updated
  2025-05-13 (a status re-verification, not a results posting) — confirms the trial is
  still actively maintained by its sponsor but genuinely has never posted results, not
  an abandoned/stale registry entry.
- **PASS**

## Check 4 — RESOLVED, type 2 diabetes
- URL: https://clinicaltrials.gov/study/NCT02750410
- data.csv row: `type 2 diabetes, NCT02750410, overall_status=COMPLETED, has_results=true, completion_date=2018-06-18, results_first_post_date=2019-09-16, computed_status=RESOLVED`
- Verified: API response confirms `hasResults: true` and
  `resultsFirstPostDateStruct.date: "2019-09-16"`, matching data.csv exactly. Results
  posted ~15 months after completion.
- **PASS**

## Check 5 — STALLED (inside grace window), heart failure
- URL: https://clinicaltrials.gov/study/NCT06626542
- data.csv row: `heart failure, NCT06626542, overall_status=COMPLETED, has_results=false, completion_date=2025-08-27, computed_status=STALLED`
- Verified: API response confirms `overallStatus: COMPLETED`, `hasResults: false`,
  `completionDateStruct.date: "2025-08-27"`. As of the 2026-07-11 pull date this is 318
  days post-completion — inside the engine's 365-day `RESULTS_GRACE_DAYS` window, so
  STALLED (not yet overdue) is the correct classification, not ORPHANED.
- **PASS**

## Check 6 — ORPHANED, type 2 diabetes (primary_completion_date only, no completion_date)
- URL: https://clinicaltrials.gov/study/NCT01857076
- data.csv row: `type 2 diabetes, NCT01857076, overall_status=COMPLETED, has_results=false, completion_date=(blank), primary_completion_date=2015-05, computed_status=ORPHANED`
- Verified: API response confirms `overallStatus: COMPLETED`, `hasResults: false`, no
  `completionDateStruct` field at all in the registry record (only
  `primaryCompletionDateStruct.date: "2015-05"`), matching the blank `completion_date`
  cell in data.csv. Confirms the engine and the CSV correctly fall back to primary
  completion date when the full completion date is absent from the registry.
- **PASS**

## Summary

6/6 spot-checked rows matched the live ClinicalTrials.gov registry exactly on
`overallStatus`, `hasResults`, and the relevant date fields. No fabrication or
misclassification found in this sample. This is a small, non-exhaustive sample (6 of
14,684 rows, chosen to cover 3 conditions and all 3 non-trivial status labels) — it
increases confidence that the pipeline is reading the registry correctly, it does not
certify all 14,684 rows individually.
