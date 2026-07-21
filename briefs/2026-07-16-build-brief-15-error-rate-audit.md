# Build Brief #15 — The measured error rate (pre-publicity credibility audit)

**To:** RobClaw / the worker it dispatches on `epistemic-receipts` + **Robert as human verifier of record**
**From:** Robert (via planning session, 2026-07-16)
**Lane:** audit/methodology. **Zero DB writes during the audit** (corrections happen AFTER publication of the rate, through the normal corrections flow — fixing sampled rows mid-audit biases the sample; that is a STOP condition, not a virtue).

**Why this brief exists.** ~1.8M transitions were machine-written. The NZ spot-check found 1 wrong date in 5 sampled rows; the B11 pilot found 0 errors in 633; nobody knows the corpus-wide rate. At publicity time, skeptics will estimate it by sampling — this brief estimates it first, publishes it with confidence intervals on `/methodology`, and re-runs it quarterly. No competitor publishes an error rate. The site about epistemic honesty publishing its own is the single most on-brand feature available.

---

## 0. Orientation

Sync main; newest fable-handoff; standing rails (worktree, branch `loop/audit-b15-<date>`, `B15-n:` commits, push + PR, owner merges). Read: `audit-chain-integrity.ts` (structural checks — this brief measures what those CANNOT catch: extraction correctness against live sources), MATERIAL-LOG's NZ 4/5 spot-check entry (the motivating case), `/corrections` flow.

## The design (decided — execute, don't redesign)

- **Population:** all `ClaimStatusHistory` rows written by non-human processes (exclude `humanReviewed` claims' rows and hand-curated seeds — they're a separate, smaller stratum reported separately).
- **Sampling:** stratified random, **n = 500** (owner knob: 300 if verification time must shrink; the report states the CI either way). Strata = pipeline family × transition class (baseline row vs promotion/enrichment row), proportional allocation with a floor of 20 per major family (legislation, retractions/openalex, FDA/drugs, votes, archives, other). Deterministic seed recorded in the report so the sample is reproducible.
- **Error taxonomy (per sampled row, exactly one primary verdict):**
  - CORRECT — date (at stated precision), axis, community, and source all check out against the live source
  - WRONG_DATE — source supports the event but not the recorded date/precision
  - WRONG_AXIS — event real, status classification unsupportable
  - SOURCE_MISMATCH — cited source does not support the transition at all
  - UNVERIFIABLE — source dead/paywalled and no substitute found (reported as its own rate, NOT counted as error)
  - Secondary flags: dead link (may co-occur with CORRECT via archive), precision-sharpening (YEAR rendered as day — the honesty-bug class)
- **Statistics:** overall error rate with Wilson 95% CI; per-stratum rates; at n=500 and a true rate near 2%, the CI is roughly ±1.2 points — tight enough to publish honestly. If a stratum is an outlier, it gets named, not averaged away.

## Phases

### B15-1 — Sampler + worksheets (worker, read-only)

`scripts/b15-sample-transitions.ts`: implements the stratified draw (seeded, bind-parameterized, read-only), emits `findings/b15-error-audit/worksheet-<stratum>.md` — one entry per sampled row: claim text, the transition (from→to, date, precision, community, reason), the source URL, and a **pre-fetched evidence snippet** (fetch the source, extract the relevant passage/dates) so each human check takes ~30–60 seconds, not five minutes. Where fetch fails, the entry says so (candidate UNVERIFIABLE). Commit worksheets + the sampling manifest (seed, strata counts, query).

### B15-2 — Human verification (Robert, the part only you can do)

You work the worksheets and mark each row's verdict. Budget honestly: 500 rows × ~45s prepped ≈ 6–7 hours, split over days; worksheets are resumable. **Circularity rule:** workers prepared evidence but verdicts are yours alone — an agent-written corpus audited by agents proves nothing. Ambiguous rows go to a `DISPUTED` pile you adjudicate last (or shrink to n=300 before starting, not mid-run).

### B15-3 — Compute + publish (worker)

`scripts/b15-compute-rate.ts` reads verdicts, computes overall + per-stratum rates with Wilson CIs, and produces: (1) a **"Measured accuracy" section on `/methodology`** — dated, versioned, stating the population, n, method, overall rate + CI, per-stratum table, the UNVERIFIABLE rate, and a plain-language sentence a journalist can quote; (2) a Known-Residues-style entry linking the raw worksheets (the receipts for the receipt-audit); (3) `findings/b15-error-audit/report.md` with everything, including the list of confirmed-wrong rows.

### B15-4 — Corrections pass (owner-gated, AFTER publication)

Only after the rate is computed and committed: the confirmed-wrong rows go through the normal correction flow (dry-run diff → your yes → fix → `/corrections` entries). The published rate reflects the corpus *as sampled* — the methodology section notes that sampled errors were subsequently corrected, which is the system working, not the number changing.

### B15-5 — Recurrence

A quarterly re-run lands in the material loop queue (fresh sample, fresh seed, same method — trend line on `/methodology` after the second run). One line in MATERIAL-QUEUE via the next tick, not a cron you build here.

## Report

`briefs/b15-report.md`: sampling manifest, verification completion stats, the published rate + CI, per-stratum table, the wrong-rows list (pre-correction), owner time actually spent (so the quarterly estimate is honest), and the methodology-section diff.

## STOP conditions

Any temptation to fix, re-run, or re-sample rows mid-audit; any verdict rendered by a worker instead of the owner; a stratum too thin to report honestly (report "insufficient n," never extrapolate); publishing a rate without its CI and UNVERIFIABLE rate alongside. Blocked beats invented.
