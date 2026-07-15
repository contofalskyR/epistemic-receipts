# B11-C Checkpoint — Landmark MemberVote Enrichment Pilot

**Date:** 2026-07-15 ~23:25 UTC
**Branch:** `loop/votes-b11c-2026-07-15`
**Status: PILOT COMPLETE + VERIFIED. Awaiting owner yes for the full landmark run.**

---

## Subset

`data/landmark-rollcalls.json` — **1,500 rollcalls** (713 named-landmark + 787 close-call <0.5% margin), hard cap respected. 2 residue acts not in DB (CRA 1960, Clean Air Act 1970), counted, not inferred.

## Data source decision (differs from brief assumption)

The brief assumed Clerk/Senate XML. **Clerk XML does not exist pre-1990**, and most landmark votes are historical (CRA 1964, Medicare 1965, Wagner Act…). Source used instead: **Voteview per-rollcall API** (`voteview.com/api/download?rollcall_id=…`) — canonical member-level data for 1789–present, keyed by ICPSR, same upstream as our voteview_v1 rollcalls.

Two further findings that make XML unusable as primary source from this VPS:
- Voteview roll numbers are per-congress; Clerk numbers per calendar year (the ROADMAP 404 class). Voteview's API provides `clerk_rollnumber` as the bridge.
- senate.gov 403-blocks this VPS (Akamai datacenter denial) regardless of headers.

## Pilot: 25 rollcalls (15 landmark + 10 close-call, era-spread 1899–2026)

Script: `scripts/enrich-landmark-member-votes.ts` (dry-run default, `--execute` to write, idempotent skip-existing, per-rollcall writes → killed-run safe).

- **Written: 25/25 rollcalls, 6,799 MemberVote rows. Residue: 0.**
- Tally gate: plain-cast Yea/Nay parsed from payload must equal API `yea_count`/`nay_count` AND DB `LegislativeVote.yesCount/noCount` exactly, or the rollcall is skipped to residue. All 25 passed exact.
- Paired/announced positions labeled explicitly ("Paired Yea", "Announced Nay") so tallies reconcile with official counts.
- POTUS rows excluded by `district=POTUS`/`vote_modifier=president` (NOT by ICPSR range — Thurmond carries icpsr 99369; range-filtering would have dropped a real senator. Caught in dry-run).

## Verification (5 spot-checks, 2 of them independent-source)

| Rollcall | Vote | Check | Result |
|---|---|---|---|
| RH1190530 | War Powers/Iran 2026, 212-212 | **Clerk XML** (clerk.house.gov/evs/2026/roll170.xml, independent) — Adams D-NC Yea, Knott R-NC Nay, Zinke R-MT Nay, date 14-May-2026 | ✓ exact |
| RS1170418 | Lhamon cloture 2021, 50-50 | **GovTrack CSV** (independent aggregation) — Baldwin D-WI Yea, Leahy D-VT Yea, Young R-IN Nay | ✓ exact |
| RS0880364 | CRA 1964 amendment, 17-72 | All 100 DB rows vs live Voteview | 100/100 match |
| RH0890035 | Medicare 1965 House, 313-115 | All 433 DB rows vs live Voteview | 433/433 match |
| RS0980050 | Social Security 1983, 44-52 | All 100 DB rows vs live Voteview | 100/100 match |

Verify scripts committed: `scripts/_b11-spotcheck.ts`, `scripts/_b11-verify-full.ts`.

## Per-vote cost (measured)

~1 API request/rollcall, 300ms throttle, ~1.6s wall per rollcall incl. DB writes. ~272 member rows/rollcall avg.

**Full landmark run projection: 1,475 remaining rollcalls ≈ 40 min wall, ≈ 400k MemberVote rows.**

## Failure/residue policy

Unfetchable rollcall, unparseable externalId, missing LV, or any tally mismatch → **skipped and counted in the residue log, never inferred.** Re-runs resume via skip-existing.

## Known limitation → follow-up pass needed

`memberId` (bioguide) joins via exact `(icpsr, congress, chamber)` against MemberIdeology — but the A-ingest was only ~50% loaded during the pilot (and congress 119 isn't in HSall_members), so only 9% of pilot rows carry a bioguide id. **Recommendation: run the full landmark run AFTER the Mac ingest completes**, then one re-join pass (re-fetch API per rollcall, `UPDATE memberId WHERE null` on exact icpsr key) covers the pilot rows. No fuzzy matching anywhere.

---

## OWNER DECISION NEEDED

**Yes/no: run the full 1,500-rollcall landmark enrichment** (≈40 min, ≈400k MemberVote rows, residue-logged, idempotent), ideally after the MemberIdeology ingest finishes?
