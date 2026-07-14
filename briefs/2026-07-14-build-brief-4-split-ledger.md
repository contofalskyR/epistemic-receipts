# Build Brief #4 — The Split Ledger (site lane, read-only)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-14)
**Lane:** site. **Zero database writes authorized.** Read-only surfaces over existing transitions, same rails as Build Brief #3.

**Owner decision recorded:** B3-6 recommended an index page for community divergence; the owner has approved building it. This brief is that build.

---

## 0. Gate + orientation

1. **Gate: Build Brief #3 must be merged to main before this brief runs.** This build extends B3 artifacts (`scripts/count-community-divergence.ts`, the explorer's lane rendering, `/reversals` hub patterns). If B3 is still an open PR, STOP and report — do not branch off the B3 branch.
2. `git fetch && git checkout main && git reset --hard origin/main`. Orientation: `git log --oneline -25`, CONSULTANT.md head + 2026-07 entries, `briefs/2026-07-13-b3-report.md` (the census this brief is built on).
3. Next.js 16 — read `node_modules/next/dist/docs/` before page/route code. Known gotcha from B3: the Prisma relation on `ClaimStatusHistory` is `markerSource`, not `source`. Never run `next build` on the VPS (SIGKILL; Vercel preview is the build check).
4. Reuse points: `app/settling-curve/SettlingCurve.tsx` (per-community lanes, `COMMUNITY_ORDER`/`COMMUNITY_LABEL`), `lib/status.ts` (canonical axis colors — only source), `components/TrajectoryDepth.tsx`, claim card components, `scripts/count-community-divergence.ts` (extend, don't rewrite).

## 1. Hard rails (unchanged from B3 — restated because a fresh worker may be reading)

No INSERT/UPDATE/DELETE, no `--execute`, no `ALLOW_EDITS`, no schema/middleware/auth/CSP changes, no new top-level nav items, no MATERIAL-QUEUE edits. Never fabricate a date, count, or claim; every rendered fact comes from DB rows. Raw SQL bind-parameterized only. Branch `loop/site-b4-2026-07-14`, one commit per phase (`B4-n:`), ~400 changed lines per phase, push + PR, owner merges. Blocked beats invented.

## 2. Why the tiering phase exists (read before B4-1)

B3-6 found 3,241 of 3,348 multi-community claims (96.8%) "divergent." That headline number is almost certainly dominated by **stage-lag** — communities at different points on the same arc (literature has a paper RECORDED while an institution has the approval SETTLED). Stage-lag is expected structure, not disagreement. The editorially valuable, rarer thing is **conflict**: one community's latest state is SETTLED while another's is CONTESTED, REVERSED, or ABANDONED — the same claim standing in two ledgers with incompatible statuses. The page must never present stage-lag as disagreement; that would be the site's version of a fabricated curve. So the first phase re-cuts the census before any UI exists.

## 3. Phases

### B4-1 — Divergence tiering census (read-only, no UI)

Extend `scripts/count-community-divergence.ts` (or add `scripts/b4-divergence-tiers.ts`) to classify every divergent claim by its per-community **latest** axes:

- **Tier 1 — Conflict:** latest axes include SETTLED (or REVERSED) in one community vs CONTESTED / REVERSED / ABANDONED in another — i.e., incompatible endpoints. (SETTLED-vs-SETTLED at different dates is NOT conflict.)
- **Tier 2 — Stage-lag:** divergent, but consistent with one arc at different stages (RECORDED vs SETTLED, RECORDED vs CONTESTED, etc.).
- Output: counts per tier, per community-pair within each tier, 10 sample claim IDs per tier with their per-community latest axes and dates, and how many Tier-1 claims are curated (`externalId` `trajectory:` prefix) vs pipeline-only.

Paste full output into the PR body. **If Tier 1 comes back near-zero, STOP after this phase and report** — the page's form changes (curated shelf, not index) and that's an owner call. A surprising number is a stop sign.

### B4-2 — `/split-ledger` index page

Server-rendered page, linked from `/start-here`, the explorer, and the `/reversals` hub (not nav):

- **Lead section: Tier 1 (Conflict).** Each entry: claim text, per-community lane rendering (reuse the explorer's lane components — do not build a new curve renderer), each community's latest axis + date in canonical colors, `TrajectoryDepth`, link to the claim page. If Tier 1 is small (≤~50), list it fully; otherwise paginate.
- **Second section: Tier 2 (Stage-lag)** — collapsed-by-default or clearly subordinate, with copy that names it as expected structure ("same arc, different stages"), paginated, filterable by community pair (EXPERT_LITERATURE ↔ INSTITUTIONAL first — it dominates at 1,789).
- Copy rules (these carry the thesis): absence of a community's row means *unrecorded, not agreement*; conflict means the ledgers disagree, *not that one is wrong*; no truth verdicts anywhere.
- Mechanics: queries live in a new `lib/split-ledger.ts` (the census script and the page must share it — one source of truth, same pattern as `lib/dormancy.ts`); ISR `revalidate = 3600`; metadata export; add to `app/sitemap.ts` static list; ESLint `Link` rule clean.

### B4-3 — `/communities` explainer

Short server-rendered page: the five ratifying communities (read the enum from `prisma/schema.prisma`, never recall it), what ratification means for each, live transition + claim counts per community, one real exemplar arc each (pick from existing curated trajectories via their slugs — verify each slug resolves before wiring, guard-script style). Link it from `/split-ledger`, `/methodology`, and the explorer. This page is definitional, not promotional — no superlatives.

### B4-4 — STRETCH (only if B4-1…3 green): shapes of settling (carried from B3-7)

`lib/curve-shapes.ts`: pure classifier over ordered `toAxis` sequences of multi-step claims → {monotone-settle, contested-then-settled, settle-then-reverse, flip-flop (≥2 direction changes), abandoned, other}. Page `/patterns`: definition + live count + 3 exemplar rails per shape + explorer deep links. The partition must sum to the multi-step corpus — "other" is published, never hidden. Ship it whole or not at all.

## 4. Out of scope

Embeds/badges (still blocked on the owner's middleware/public-edition decision), adaptive-timeline and follow-UI work, homepage changes beyond existing OnThisDay, anything in B3 (merged — extend, don't rework), all DB writes.

## 5. Verification (every phase)

`npx tsc --noEmit` exit 0; ESLint clean on touched files; `npx vitest run` green; dev-server `curl | grep` shows real claim text server-side on `/split-ledger` and `/communities`; spot-check 5 Tier-1 claims' per-community axes directly against the DB (never against the script's own output); Vercel preview green on push.

## 6. Report

`briefs/2026-07-14-b4-report.md` on the branch: per-phase done/stopped, full B4-1 tier census, the Tier-1/Tier-2 split that shipped, spot-check results, preview URL, and any anomalies (especially claims whose community histories look like data errors rather than real divergence — list them, touch nothing).

## 7. STOP conditions

Tier-1 near-zero (form changes — owner call); any write about to happen; a premise contradicted by the DB; middleware/auth/schema pressure; two consecutive failures on one acceptance criterion; anything requiring an invented value to look complete.
