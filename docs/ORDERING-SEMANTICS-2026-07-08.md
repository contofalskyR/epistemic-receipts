# Ordering Semantics — the decision (2026-07-08)

**Status: DECIDED — Option B, approved by Robert 2026-07-08, with two amendments:**

1. **Prepend-aware seq.** amendBaseline/prepend paths renumber the claim's rows in
   the same transaction (claims have few rows; renumbering is cheap). A plain max+1
   counter is NOT acceptable — NZ phase-2 prepends entry rows.
2. **Unique constraint on (claimId, seq)**, assigned inside the insert transaction.
   (Implementation note: renumbering sets the claim's seq values to NULL then
   assigns finals within the transaction — Postgres treats NULLs as distinct in
   unique indexes, so shifts never collide transiently.)

**Correction for the record (Robert):** the circularity argument against Option A
below is partly wrong — many of the ~290 scrambled arcs have coherent pointers; the
date sort is what lies. The structural killer for A is **branching**: rows sharing a
fromAxis (cross-community re-ratification lanes) mean the pointer graph does not
define a single linear order at all. Consequence for the backfill: where a unique
linear pointer chain exists, it wins over date order; date order is the fallback,
and genuinely underivable claims go to residue for eyeball review.

Build order: migration + contract → backfill (preflight → execute → audit) →
consumer swaps → rechain fix runs against seq.

## The problem, in plain terms

Every curve is a list of transition rows: `null→SETTLED`, `SETTLED→REVERSED`, and so
on. The rows carry two things that can disagree about order:

1. **Dates** (`occurredAt` + a precision flag). A YEAR-precision date is stored as
   Jan-1 of that year. So "sometime in 2019" sorts *before* "15 June 2019" even when
   it actually happened after. ~290 arcs render scrambled because of this.
2. **Chain pointers** (`fromAxis`): each row says which state it came from. Logically
   these define the true sequence, but nothing today reads them for ordering.

Everything that displays or checks a curve sorts by date. Ten different places do
this, each slightly differently: the DB queries tiebreak by ingest time, the public
API doesn't tiebreak at all, and the curve renderer itself rounds every date to
**year + month** — day-of-month is ignored entirely. The chain-integrity audit and
the rechain fixer also sort by date, which is why 5 claims sit in
`logs/rechain-skipped-*.jsonl`: two rows share the exact same date, so date order is
genuinely underivable and the fixer honestly refuses to guess.

House rule that stands regardless: **we never nudge dates to fix sort order** — that
would fabricate precision.

## Option A — chain-following render

Derive order by walking the pointers: start at the entry row (`fromAxis = null`),
follow `toAxis → fromAxis` links.

- **For:** no schema change; uses information the transition contract already writes.
- **Against:**
  - Nothing in the codebase does this today. All ~10 consumers (curve page, mini
    curves, three API families, the MCP server, CSV/BibTeX exports, the claim-diff
    tool) would need new shared assembly logic — including the SQL-side audits,
    where "follow the pointers" means recursive queries instead of one `ORDER BY`.
  - **Circularity, the fatal flaw:** chain-following only works when pointers are
    coherent. The ~290 broken arcs are broken *because their pointers are wrong or
    ambiguous*. The sick population is exactly the one the cure can't treat.
  - The curve's x-axis is still time. Chain order and date positions would coexist,
    and every renderer has to reconcile them anyway.

## Option B — explicit `seq` column (recommended)

Add an integer `seq` to the transition table: 1, 2, 3 per claim. The transition
contract (the single sanctioned write path) assigns it on every new row. A one-time
backfill stamps existing rows. Everything then sorts by `seq` — one universal,
precision-independent key that works identically in Prisma, raw SQL, the client,
and exports.

- **For:**
  - Fits the project's philosophy: the ledger *states* its order as a recorded,
    auditable fact instead of deriving it from dates that are honestly coarse.
    A receipt has a line order.
  - Resolves the 5 underivable ties permanently, and makes the C1 audit and the
    rechain fixer simpler (windows over `seq` instead of date+ingest-time guessing).
  - Rollout is safe: column is nullable during backfill, consumers sort
    `seq, then occurredAt, then createdAt`, so unstamped rows behave exactly as
    today. Rollback = ignore the column.
- **Against / costs:**
  - One additive schema migration. (Verified against the CI drift gate: a new
    timestamped migration folder committed in lockstep with `schema.prisma` passes
    without touching the allowlist, `prisma.config.ts`, or any applied migration.)
  - A backfill script (preflight-by-default, like everything else): where dates are
    strictly ordered, `seq` follows dates; where pointers are coherent, `seq`
    follows the chain; the handful that are neither (the 5 ties + whatever the full
    run finds) get listed for eyeball review, not guessed.
  - ~10 small `orderBy` swaps, done incrementally behind the fallback.

## What neither option changes

Dot *positions* on the time axis. A YEAR-precision dot still sits at its year even
if `seq` says it came after a specific June date; the connecting line may visibly
double back. That's honest — the data really is that coarse. If it reads badly we
can later render YEAR dots at year-center with a year-wide uncertainty whisker, but
that's a display convention to decide separately, after `seq` exists. It is not date
nudging and not part of this decision.

## Recommendation

**Option B.** Option A adds complexity to ten consumers, can't fix the broken
population, and still leaves audits guessing. `seq` is one honest column that makes
order a stored fact.

Build order if approved: migration + contract change → backfill (preflight → execute
→ audit) → consumer swaps → then the queued rechain fix runs against `seq` instead
of skipping ties.

## The question

**A or B?** (Or: B but change something — say what.)
