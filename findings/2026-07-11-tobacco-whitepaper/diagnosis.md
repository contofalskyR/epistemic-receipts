# AA-1 diagnosis — Müller 1939 / Surgeon General 1964 "Dormant" claims

No `.env.local` / `DATABASE_URL` was available in this worktree, so this is a
read-only, code-level diagnosis (per `scripts/inspect-whitepaper-claims.ts`,
`prisma/schema.prisma`, `lib/transition-contract.ts`, and the app render path)
— not a live DB query. **Robert should run the inspect script for real before
approving anything below**, to confirm these two IDs still resolve to the
claims described here.

## The two claim IDs (from `scripts/inspect-whitepaper-claims.ts`)

| ID | Label |
|---|---|
| `cmqwoxe6l07dy8o0y6xrs8xnv` | paper ref [1] — Surgeon General 1964 |
| `cmqoappnu03yxsadpa90nu942` | paper ref [2] — Müller 1939 |

These are pre-existing, standalone claims — **not** created by
`scripts/seed-smoking-cancer.ts` or `scripts/seed-trajectories.ts`. The
`trajectory:smoking-lung-cancer` seed (Doll & Hill 1950 → Surgeon General 1964
→ MSA 1998) referenced in the worker brief is a *third*, separate claim
(`externalId: 'trajectory:smoking-lung-cancer'` in `seed-trajectories.ts`) and
is confirmed correct — untouched here.

## Why they show "Dormant · no revisions"

Traced the render path instead of querying the DB:

1. **`app/claims/[id]/AdaptiveClaimTimeline.tsx`** (lines ~433, ~449, ~492-494)
   computes a `dormantWord` ("no new activity") and a duration purely from
   `claim.statusHistory` — the `ClaimStatusHistory` rows. The same pattern
   drives `app/settling-curve/SettlingCurve.tsx`'s "dormant since \<year\>"
   label. **Zero `ClaimStatusHistory` rows ⇒ the dormant/no-revisions
   state**, independent of whether the claim has Edges.
2. **`lib/transition-contract.ts`**'s `resolveDisplayAxis()` falls back to the
   stored `Claim.epistemicAxis` when there's no REVERSED/ABANDONED terminal
   row. If `epistemicAxis` was never stamped (only happens as a side effect of
   `emitTransition` → `stampClaimAxis`, or at ingest), the claim reads as
   unclassified/"unreviewed since emergence" per
   `AUDIT-WHITEPAPER-GAP-2026-07-03.md` §2.
3. **The 50/100 score** is a per-source `EdgeRevision.newScore`, a completely
   separate table from `ClaimStatusHistory`. `EdgeRevision` is the "source of
   truth for all scores — initial score written here on Edge creation"
   (`prisma/schema.prisma` comment on the model). 50 reads as the pipeline's
   neutral/unreviewed default — these two claims apparently carry only
   auto-ingested edges whose revisions were never bumped by a curator, which
   is a **second, independent problem** from the empty status history.

**Conclusion: two claims, two separate defects, one root cause (never
curated).** Fixing the score alone (adding Edges/EdgeRevisions) would NOT
clear "Dormant · no revisions" — that specifically requires real
`ClaimStatusHistory` rows. Per `specs/OPENCLAW-DATA-DOCTRINE.md` §3, those
rows are only ever written through `lib/transition-contract.ts`'s
`emitTransition()` — "No raw SQL INSERT into `ClaimStatusHistory`, ever."

## What I drafted (Step 3)

`scripts/seed-smoking-cancer.ts` was extended (not replaced) with a new "Step
7 (AA-1)" block that calls `emitTransition()` directly against the two
existing claim IDs above — the same sanctioned write path used by
`scripts/event-pipelines/scotus-overrulings.ts` and friends. It does **not**
create new Claim rows (these claims already exist); it only proposes
`ClaimStatusHistory` transitions + upserts the underlying `Source` rows
(reusing the exact same `externalId` slugs as `seed-trajectories.ts` —
`src:doll-hill-bmj-1950`, `src:surgeon-general-1964`, `src:tobacco-msa-1998`
— so no duplicate Source rows are created) and, only under `--execute`,
stamps `humanReviewed: true` on both claims (a genuine review action, not a
filter workaround — see AGENTS.md's `humanReviewed`/`autoApproved` rule).

I deliberately did **not** add new Edges/EdgeRevisions in this pass. The
`ClaimStatusHistory` transitions are the load-bearing fix for "Dormant · no
revisions"; adding Edges on top is a separate, smaller task (bumping the
50/100 default) that Robert can fold in later once `--execute` lands and the
claim pages are re-checked live.

## Why I chose 3 transitions for Müller and 2 for Surgeon General

Both sequences mirror `trajectory:smoking-lung-cancer` exactly (same sources,
same dates, same reasons where applicable), just anchored to each claim's own
starting point:

- **Müller 1939** genuinely starts the clock in 1939 (CONTESTED, before Doll &
  Hill existed), so it gets the full 3-row arc: 1939 CONTESTED → 1950-09-30
  SETTLED (Doll & Hill independent confirmation) → 1964-01-11 SETTLED
  re-ratified by INSTITUTIONAL (Surgeon General).
- **Surgeon General 1964** is itself the institutional resolution — its
  claim's own "birth" is the SETTLED verdict, so it gets a 2-row arc: 1964-01-11
  null → SETTLED (INSTITUTIONAL) → 1998-11-23 SETTLED re-ratified by PUBLIC
  (Master Settlement Agreement).

I did **not** insert a fake CONTESTED phase after either claim's SETTLED
resolution to represent industry pushback — the scientific/institutional
consensus never actually reversed, and `AGENTS.md`'s quiet-reversal-tracking
principle is about real reversals, not synthetic ones for narrative color.
Industry contestation is already modeled correctly elsewhere via
`MetaEdge{type: SUPPRESSED}` on the `childE`/`childF` claims in
`seed-smoking-cancer.ts`.
