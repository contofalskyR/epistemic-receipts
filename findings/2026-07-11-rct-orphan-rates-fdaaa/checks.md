# Hand verifications

As-of date used by the classifier: 2026-07-11 (today, per the tool run below).

Method: `clinicaltrials.gov/study/NCTXXXXXXXX` is a client-rendered React app — a plain
page fetch returns only the navigation shell, no study data. So each row below was
verified against the same public v2 API that populates that page
(`https://clinicaltrials.gov/api/v2/studies/NCTXXXXXXXX?fields=...`), fetched live via
`curl` during this session (not from training-data recall), and the human-facing study
URL is given alongside for anyone who wants to look at it in a browser. Raw JSON for
each of these 6 fetches is preserved in the session's tool-call log; the fields below
are copied verbatim from that JSON.

---

### 1. NCT00234975 — oldest ORPHANED in cohort
URL: https://clinicaltrials.gov/study/NCT00234975

- Live API: `overallStatus: COMPLETED`, `phases: [PHASE4]`, `primaryCompletionDate: 2008-01`, `completionDate: 2008-01`, `hasResults: false`, `lastUpdatePostDate: 2013-01-03` (4,937 days / ~13.5 years before 2026-07-11)
- Script classified: **ORPHANED** — "no material movement in 4937d... press dropped a still-unresolved story"
- **PASS** — completed 18 years ago (per registry), no results ever posted, registry itself untouched since 2013. Genuinely orphaned by any reading.

### 2. NCT06169995 — newest ORPHANED in cohort (closest to the grace-window boundary)
URL: https://clinicaltrials.gov/study/NCT06169995

- Live API: `overallStatus: COMPLETED`, `phases: [PHASE4]`, `primaryCompletionDate: 2023-12-15`, `completionDate: 2023-12-16`, `hasResults: false`, `lastUpdatePostDate: 2023-12-29` (925 days before 2026-07-11)
- Script classified: **ORPHANED**
- **PASS** — 925 days (~2.5 years) since last registry activity is well past both the 365-day results-reporting grace window and the engine's 42-day orphan threshold. No results posted at any point since.

### 3. NCT04310995 — the cohort's only OPEN classification (edge case)
URL: https://clinicaltrials.gov/study/NCT04310995

- Live API: `overallStatus: COMPLETED`, `phases: [PHASE4]`, `primaryCompletionDate: 2023-02-02`, `completionDate: 2026-05-31` (41 days before as-of), `hasResults: false`, `lastUpdatePostDate: 2026-07-09` (2 days before as-of)
- Script classified: **OPEN** — reason: "Material development 2d ago."
- **PASS on the underlying fact** (this trial is not overdue: it completed 41 days ago, inside the 365-day reporting grace window, so it should NOT be counted as an orphan) but **the label is misleading**: "OPEN" here fires because the registry record itself was edited 2 days ago, not because the trial is actively enrolling — every registry touch reads as "material development" in `ctgov_adapter.ts`'s `studyToArticles()`. A completed trial that is quietly and legitimately within its reporting window, with no metadata edit, would be classified STALLED instead (see report.md limitations). Net effect on the headline number is nil here (this case is correctly excluded from ORPHANED either way), but the specific status label doesn't mean what it says for completed trials.

### 4. NCT00810069 — RESOLVED sanity check
URL: https://clinicaltrials.gov/study/NCT00810069

- Live API: `overallStatus: COMPLETED`, `phases: [PHASE4]`, `primaryCompletionDate: 2010-02`, `completionDate: 2010-03`, `hasResults: true`, `resultsFirstPostDate: 2011-06-21`
- Script classified: **RESOLVED** — "Resolved (yes). Results posted on the registry."
- **PASS** — results are genuinely posted. Note for methodology: results were posted ~16 months after primary completion, i.e. after FDAAA's own 12-month deadline. The engine's RESOLVED bucket means "ever reported by 2026-07-11," not "reported on time" — see report.md limitations; this is not the same metric as the literature's "compliant within 1 year" figures.

### 5. NCT01516541 — large industry-sponsored ORPHANED (Hoffmann-La Roche, dalcetrapib)
URL: https://clinicaltrials.gov/study/NCT01516541

- Live API: `overallStatus: COMPLETED`, `phases: [PHASE3]`, `primaryCompletionDate: 2012-07`, `completionDate: 2012-07`, `hasResults: false`, `lastUpdatePostDate: 2016-11-02` (3,538 days before as-of)
- Script classified: **ORPHANED**
- **PASS** — no `resultsFirstPostDateStruct` and `hasResults: false` in the live record; registry untouched since 2016. Note: the record does carry a `dispFirstPostDateStruct` (2016-07-12), a disposition/embargo-related field distinct from full results posting — the classifier correctly ignores it since it isn't `resultsFirstPostDateStruct`.

### 6. NCT00130195 — academic-sponsor ORPHANED (Japan Adult Leukemia Study Group)
URL: https://clinicaltrials.gov/study/NCT00130195

- Live API: `overallStatus: COMPLETED`, `phases: [PHASE2]`, `primaryCompletionDate: 2008-02`, `completionDate: 2008-05`, `hasResults: false`, `lastUpdatePostDate: 2008-11-14` (6,448 days before as-of)
- Script classified: **ORPHANED**
- **PASS** — registry record hasn't been touched since November 2008; no results ever posted in 18 years.

---

## Summary

6/6 checked, 6/6 pass on the underlying classification outcome (ORPHANED/RESOLVED/OPEN
correctly separates "results posted" from "not posted," and correctly excludes
still-within-grace-window trials from ORPHANED). 1 of 6 (#3) surfaces a real labeling
limitation — the OPEN status text is driven by "was the registry record edited
recently," a signal inherited from the engine's news-tracker origin, not by whether
the trial is actively running. It does not change the ORPHANED count and is disclosed
in report.md.
