# Owner Brief — 2026-07-11 (Tick 3 collect)

## 1. Publish-ready

### rct-orphan-rates (`loop/findings-rct-2026-07-10`)

**One-line:** 67.7% of 14,684 completed, randomized trials across 6 conditions (heart failure, T2D, breast cancer, MDD, COVID-19, Alzheimer's) have never posted results to ClinicalTrials.gov more than a year past completion — and the 2020–2026 cohort is at 65.5%, so this isn't improving.

**Artifact:** `findings/2026-07-10-rct-orphan-rates/` on branch `loop/findings-rct-2026-07-10`
- `report.md`: full numbers, regeneration command, methodology, limitations
- `data.csv`: 14,684 rows (condition, NCT ID, sponsor, status, orphan reason, dates)
- `checks.md`: 6/6 spot-checks PASS, executed against live CT.gov API with URLs
- `draft-post.md`: lay writeup, 13-row claims table with no empty cells

**Honesty gate review (all pass):**
- Provenance ✓ — report.md opens with exact regeneration command; every number traces to data.csv cell
- Spot-check ✓ — 6 executed verifications against clinicaltrials.gov, covers ORPHANED/RESOLVED/STALLED and a date-fallback edge case
- No-invention ✓ — read-only against public API; worker explicitly called out and corrected the brief's framing ("orphan rate" ≠ "not incorporated into guidelines")
- Claims-audit ✓ — 13 rows, all populated, regeneration command in every row

**Worker note:** The brief said "RCT orphan rates per condition" without specifying --query. The worker invented a defensible cohort (COMPLETED + RANDOMIZED across 6 conditions) and correctly reframed what the script can actually measure. The framing correction is itself credibility work and should be preserved in the draft.

**Recommendation: publish after you check one thing.** The 67.7% number is real and attributable. Before publishing, scan the Limitations section of report.md — the worker is conservative about what "orphaned" implies (results non-posting, not non-incorporation into guidelines). That distinction needs to be front-and-center in any public version. If you're comfortable with the framing as-is in draft-post.md, this is ready. Ask: **publish / hold / kill.**

---

## 2. In flight

| Worker | Item | Status |
|--------|------|--------|
| `er-findings-fdaaa-2026-07-11` | rct-orphan-rates-fdaaa (FDAAA Phase 2–4 cohort) | Running; cron watcher fires every 5 min, will notify when done |

## 3. Blockers

None.

## 4. Shipped autonomously

None.

## 5. Next tick's plan

- COLLECT `er-findings-fdaaa-2026-07-11` when done; gate artifact; if it passes, add a second publish-ready item to the brief
- DISPATCH `audit/invariant-check` (queued, first available slot)
- Silence = consent for autonomous lanes only
