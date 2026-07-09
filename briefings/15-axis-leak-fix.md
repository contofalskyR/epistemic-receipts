> **Editor's note (filed 2026-07-09).** Handoff from an external read-only
> session. This is the follow-up to the `epistemicAxis`-vs-`REVERSED` observation
> raised at the Phase A CHECKPOINT (see briefings 13/14): the settling-curve
> views correctly key off `statusHistory.toAxis`, but this session found **three
> other call sites** that read `epistemicAxis` as authoritative, so the ~11,319
> Phase A retraction claims will display/filter as CONTESTED even though their
> curves are REVERSED. It does **not** block the Phase A `--execute` (which
> writes correct `toAxis=REVERSED` rows) — it's a downstream display/query fix,
> and the pre-launch window is the cheap time to do it. Status: **proposed, not
> yet executed.** Original content verbatim below.

---

# Axis-Leak Fix — Execution Handoff

Written by a session with read-only repo access (no DB, no dev server, nothing run or type-checked). Everything below is grep/schema-confirmed except the code, which is a draft — verify against the real Prisma client before trusting it.

## Confirmed

`Claim.epistemicAxis` is a 5-value field (RECORDED/SETTLED/CONTESTED/OPEN/UNRESOLVABLE) that structurally cannot represent REVERSED or ABANDONED — those only exist on `ClaimStatusHistory.toAxis`. Three places read `epistemicAxis` as if it's authoritative:

- `app/topics/[slug]/page.tsx:736` — `<EpistemicAxisBadge axis={c.epistemicAxis} />` — display only
- `app/api/v1/claims/route.ts:41` — `where.epistemicAxis = q.epistemicAxis` — public API, query-level
- `app/api/search/route.ts:273` — same pattern — internal search

Net effect: the ~11,319 Phase A OpenAlex-retraction claims (and everything Phase B/C/D adds) show as CONTESTED on topic pages and in both filters, when their curves are actually REVERSED.

## Step 0 — check this first, might shrink the rest

`Claim.epistemicStatus` is a separate field whose vocabulary already includes a literal `"retracted"` value. Check whether Phase A is setting it correctly:

```sql
SELECT "epistemicAxis", "epistemicStatus", count(*)
FROM "Claim"
WHERE "openAlexId" IS NOT NULL
GROUP BY 1, 2;
```

If `epistemicStatus = 'retracted'` is already right on these rows, check whether anything reads `epistemicStatus` instead of `epistemicAxis` anywhere in the app. If so, the real blast radius may be smaller than three call sites.

## Fix 1 — display only, low risk, do this one now

Add to `lib/transition-contract.ts`, next to `FACT_STATUSES`:

```typescript
export function resolveDisplayAxis(claim: {
  epistemicAxis: string | null
  statusHistory: { toAxis: string; seq: number | null }[]
}): string | null {
  const latest = [...claim.statusHistory].sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0))[0]
  if (latest && (latest.toAxis === "REVERSED" || latest.toAxis === "ABANDONED")) {
    return latest.toAxis
  }
  return claim.epistemicAxis
}
```

Swap `app/topics/[slug]/page.tsx:736` to use it instead of the raw field. `statusHistory` is likely already fetched for that page for other reasons — confirm before adding a new query for it.

## Fix 2 — query-level, real work, don't rush it

`app/api/v1/claims/route.ts` and `app/api/search/route.ts` filter *in the database query*, so Fix 1's JS-side sort doesn't help here — by the time it would run, the wrong rows are already in or out of the result set. This needs a window-function query — latest `toAxis` per `claimId` via `ROW_NUMBER() OVER (PARTITION BY "claimId" ORDER BY "seq" DESC)` — computed server-side. `scripts/audit-chain-integrity.ts` already does the same shape of aggregate/window-function rewrite for performance reasons (its own docblock explains why); read that file for the existing pattern rather than writing new SQL from nothing. The public API should also start accepting `epistemicAxis=REVERSED` as a valid query value once this lands — it currently can't, since REVERSED isn't a value the column holds.

## Before calling it done

Per AGENTS.md: run `audit-chain-integrity.ts` after touching `lib/transition-contract.ts`, since it's a shared module. Manually hit both endpoints with `epistemicAxis=CONTESTED` and `epistemicAxis=REVERSED`, before and after, and diff against a known Phase A claim ID to confirm it moved.

## Why now instead of later

Site is pre-launch. Nothing external depends on the current (wrong) filter behavior yet. This is the cheap window to fix the query semantics — it gets more expensive once a real API consumer has built against what's there today.
