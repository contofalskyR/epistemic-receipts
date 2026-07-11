# More than half the clinical trials we checked never told anyone how they turned out

Since 2007, US law has required most clinical trials of drugs, biologics, and medical
devices to post their results on ClinicalTrials.gov within a year of finishing — win,
lose, or draw. The idea is simple: doctors, patients, and other researchers shouldn't
have to guess what a trial found, and negative results matter just as much as positive
ones for deciding what treatments actually work.

We pulled a sample of 500 completed trials that fall under this law (Phase 2, 3, or 4
trials that wrapped up between 2008 and 2023) and checked each one against
ClinicalTrials.gov's own records as of today. **258 of the 500 — 51.6% — have never
posted results, and the registry itself has gone quiet on them:** no updates, no
results, nothing, for anywhere from about two and a half years to eighteen years past
completion.

That's not a rounding error. It's the difference between "the paperwork is a little
late" and "science ran an experiment and nobody outside the trial will ever officially
learn the answer."

## What we checked, concretely

We looked at each trial's own registry entry: is it marked completed, does it have a
results section, and has anything happened on the record recently? Trials get sorted
into four buckets:

- **RESOLVED** — results are posted. (241 of 500, 48.2%)
- **ORPHANED** — completed, no results, and quiet well past the one-year grace period
  the law allows. (258 of 500, 51.6%)
- **OPEN** — the registry record was touched very recently. (1 of 500, 0.2%)
- **STALLED** — none in this sample (see Methods below for why).

We hand-checked 6 of these against ClinicalTrials.gov's live data directly — including
a Roche cardiovascular trial with over 3,500 studies enrolled that's been silent since
2016, and a 2008 Japanese leukemia trial that hasn't been touched since November of
that year. Every one of the 6 checks matched what the automated classifier said. Full
detail, including the one case where a status label turned out to need a caveat, is in
`checks.md`.

## How this compares to prior research

Two peer-reviewed studies have measured similar things before us, with different
methods:

- A 2015 New England Journal of Medicine study (Zarin et al.) looked at over 13,000
  trials completed 2008-2012 and found only 13.4% reported within the legal one-year
  deadline, and about 61.7% still hadn't reported at all by the end of that study's
  observation window.
- A 2020 Lancet study (DeVito, Bacon & Goldacre) found about 40.9% on-time compliance
  for trials due to report in 2018-2019 — meaning roughly 59.1% were overdue at that
  snapshot.

Our 51.6% sits in the same neighborhood as those two figures, though it isn't measuring
exactly the same thing (see Limitations) — it's a useful sanity check that our number
isn't wildly out of line with what other researchers have found, not a claim that we
replicated their studies.

## Limitations — read this before repeating the headline number

- **This is a 500-trial sample out of 68,036 matching trials**, not the full universe.
  The trials we pulled came back in whatever order ClinicalTrials.gov's API returns by
  default — not randomly and not by date — so this is a snapshot, not a definitive
  national estimate.
- **"Orphaned" here means "hasn't reported by today," not "missed the exact one-year
  deadline."** Some of our ORPHANED trials could theoretically still be within a
  legitimate extension the sponsor filed with the FDA — our check only reads
  ClinicalTrials.gov's own public fields, not FDA's internal compliance-extension
  paperwork.
- **"Resolved" means results eventually got posted — not that they were posted on
  time.** One of our 6 hand-checks (an Eli Lilly depression trial) posted results about
  16 months after completion, four months past the legal deadline, and it still counts
  as RESOLVED here. So our RESOLVED rate is a looser bar than the "on-time compliance"
  rate the two studies above measure — the numbers aren't directly comparable
  percentage-for-percentage.
- This is not an accusation against any specific sponsor. Some trials in our ORPHANED
  bucket may have legitimate, undisclosed-to-us reasons for not reporting (a merger,
  discontinued product line, an FDA waiver). We are describing a pattern in public
  registry data, not making a finding about any single trial or company.

## Claims table

| Claim in this post | Source (data.csv) | Regeneration command |
|---|---|---|
| 500 trials pulled | `data.csv` — row count (500 data rows + 1 header) | `npx tsx scripts/rct-cohort-report.ts --query 'AREA[Phase] (PHASE2 OR PHASE3 OR PHASE4) AND AREA[OverallStatus] COMPLETED AND AREA[PrimaryCompletionDate] RANGE[01/01/2008, 12/31/2023]' --max-pages 5` |
| 258 of 500 (51.6%) never posted results and went quiet ("ORPHANED") | `data.csv` — count of rows where `classifiedStatus == ORPHANED` | same as above |
| 241 of 500 (48.2%) posted results ("RESOLVED") | `data.csv` — count of rows where `classifiedStatus == RESOLVED` | same as above |
| 1 of 500 (0.2%) flagged OPEN | `data.csv` — row where `classifiedStatus == OPEN` (`NCT04310995`) | same as above |
| 68,036 total matching trials in the full cohort (this is a sample) | Live `countTotal=true` query against `https://clinicaltrials.gov/api/v2/studies` with the same `query.term`, captured this session (not in data.csv — a separate count-only API call) | `curl -G "https://clinicaltrials.gov/api/v2/studies" --data-urlencode 'query.term=AREA[Phase] (PHASE2 OR PHASE3 OR PHASE4) AND AREA[OverallStatus] COMPLETED AND AREA[PrimaryCompletionDate] RANGE[01/01/2008, 12/31/2023]' --data-urlencode 'countTotal=true' --data-urlencode 'pageSize=1'` |
| Roche dalcetrapib trial (NCT01516541), completed 2012, silent since 2016 | `data.csv` row `nctId == NCT01516541`; hand-verified in `checks.md` #5 | same cohort-pull command above, plus live check: `curl "https://clinicaltrials.gov/api/v2/studies/NCT01516541?fields=protocolSection.statusModule,hasResults"` |
| Japan Adult Leukemia Study Group trial (NCT00130195), untouched since Nov 2008 | `data.csv` row `nctId == NCT00130195`; hand-verified in `checks.md` #6 | `curl "https://clinicaltrials.gov/api/v2/studies/NCT00130195?fields=protocolSection.statusModule,hasResults"` |
| Zarin et al. 2015: 13.4% on-time, ~61.7% never reported within observation window | External source, not data.csv: Zarin DA et al., NEJM 2015, DOI 10.1056/NEJMsa1409364 (PMC4508873) | N/A — cited literature, not regenerated by this pipeline |
| DeVito, Bacon & Goldacre 2020: ~40.9% on-time compliance (2018-2019 cohort) | External source, not data.csv: DeVito NJ, Bacon S, Goldacre B., The Lancet 2020, DOI 10.1016/S0140-6736(19)33220-9 | N/A — cited literature, not regenerated by this pipeline |
| Eli Lilly trial (NCT00810069) posted results ~16 months post-completion, past the 12-month deadline | `data.csv` row `nctId == NCT00810069`; hand-verified in `checks.md` #4 | `curl "https://clinicaltrials.gov/api/v2/studies/NCT00810069?fields=protocolSection.statusModule,hasResults"` |
