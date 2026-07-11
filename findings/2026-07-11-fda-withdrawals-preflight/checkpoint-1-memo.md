# CHECKPOINT 1 — FDA Withdrawals (Phase B) preflight

## CONTEXT
`scripts/event-pipelines/fda-withdrawals.ts` walks FR "Withdrawal of Approval" NDA/ANDA
notices since 1994, classifies each by CFR ground, and — for safety/efficacy grounds only
(§314.150(a)/(b)/(d), §314.151, 506(c) accelerated approval) — plans a `SETTLED→REVERSED`
transition on every `drugsatfda_v1` product claim of the named application, dated to the
notice's legal effective date. §314.150(c) voluntary/commercial withdrawals emit nothing, per
Robert's 2026-07-10 decision (briefing 18 §2).

## FINDING — preflight numbers (full run, 1994-01-01 → present, dry-run, no writes)
```
notices: 256        commercialC: 126   safety: 61      unclassified: 42
applications: 51     applMatched: 44    applUnmatched: 7
productClaims: 95    otherTerminal: 0   heldFuture: 0
planned: 95          inserted: 0        exists: 0        skipped: 0
residue: 98 (of 266 total residue entries — includes the 100-sample of commercialC and the 61 correction-notice exclusions)
```
Full log: `logs/fda-withdrawals-preflight-full.log` (gitignored). Residue detail:
`logs/fda-withdrawals-residue.jsonl` (gitignored). Residue kinds:
- `commercial-314.150c-skipped-by-decision` 100 (sampled; decision-correct, not written)
- `correction-notice` 61 (excluded by title filter, decision-correct)
- `unclassified-ground` 42
- `no-effective-date` 28
- `no-full-text-xml` 27
- `application-not-in-corpus` 7
- `no-application-numbers` 1

No contract violations, no held-future notices, no unexpected terminal-axis claims. Every
one of the 95 planned transitions is on a claim currently `SETTLED`, matched by `applNo` only,
exactly as designed.

## OPTIONS — anomaly found in `no-effective-date` residue (28 notices)
Spot-checked 10 of the 28 cached XML docs. **~9 of 10 have a machine-extractable effective
date** — the parser's date regex only matches `"withdrawn as of [date]"`, but a large minority
of notices across the 1994–2026 span phrase the DATES section differently:
- `"Effective [Month Day, Year]."` (e.g. 2013-18657 BEXTRA/valdecoxib, 2012-9943 OFORTA,
  2012-9944 IRESSA, 2013-13053 ORAFLEX, 2016-08336 LUVERIS, 03-493 Pfizer NDA, 2014-03596
  phenylpropanolamine batch)
- `"The effective date is [date]."` (2016-08894 — but see below, this one is a different bug)
- `"Withdrawal of approval is applicable [date]."` (2020-28283 OPANA ER/oxymorphone)
- `"Applicable [date]."` (2022-26057 SULFAMYLON)

This is a **parser gap, not genuine undatability** — these are legitimate, dated safety
withdrawals, several high-profile (BEXTRA, MERIDIA/sibutramine [2010-31986], MYLOTARG/
gemtuzumab [2011-30473], IRESSA, DURACT [2013-18657's neighbor 2013-...], OPANA ER,
SULFAMYLON). They are currently silently dropped to residue and would NOT get a
`SETTLED→REVERSED` transition on `--execute` as the script stands today.

One entry in the same bucket, 2016-08894 (ADVICOR/SIMCOR), is a *different* case: it cites
§314.161/314.162 (a "not withdrawn for safety" ANDA-suitability determination), outside all
three classifier buckets — correctly unclassified regardless of date-parsing, no fix needed
there. I did not spot-check the remaining ~18 of 28; a full pass is needed before trusting the
fix's effect on this bucket exactly.

Separately, `application-not-in-corpus` (7) and `unclassified-ground` (42, spot-checked 3 —
correctly conservative, no CFR ground citation the classifier can key on) look decision-correct
as-is; no action recommended there.

## RECOMMENDATION
**Hold** before `--execute`. Extend `parseNoticeXml`'s effective-date regex to also match the
`"Effective [date]."` / `"applicable [date]."` / `"effective date is [date]."` DATES-section
variants (all still inside the same `DATES:` field the current regex already targets, just a
different lead-in phrase), then re-run the full preflight and confirm the `no-effective-date`
count drops and the recovered notices land in `safety`/`planned` with sane dates — not silently
in `unclassified`. This is a code change, not a DB write, but the resulting instance-count
shift is a "surprising number" under the data doctrine (§4.4) and should go back through
CHECKPOINT 1 with fresh preflight numbers before any pilot.

If Robert prefers to proceed without the fix: the 95 currently-planned transitions are clean
and could pilot/execute as-is, with the 28 residued notices (including BEXTRA, MERIDIA,
MYLOTARG, IRESSA, OPANA ER) picked up in a follow-up run once the parser is fixed — nothing
about executing now forecloses that follow-up, since the pipeline is idempotent and
state-file/residue-driven.

## BLOCKED
Robert's `--execute` approval required before any writes — no exception, per
`specs/OPENCLAW-DATA-DOCTRINE.md` §1. This memo is read-only preflight output; nothing was
written to Neon.
