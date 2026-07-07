# Design Note — Spec 23 Temporal-Knowledge Eval Set

_Checkpoint before implementation. Covers item construction pipeline, sampling
strategy, and negative-control construction. Flags open questions where the spec
leaves room for interpretation._

---

## 1. Source population query

**Goal:** `ClaimStatusHistory` rows that are safe to derive gold labels from.

```sql
SELECT csh.*
FROM "ClaimStatusHistory" csh
JOIN "Claim" c ON c.id = csh."claimId"
LEFT JOIN "Source" s ON s.id = csh."sourceId"
WHERE
  -- Exclude deleted / DEPRECATED claims
  c.deleted = false
  AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
  -- Require marker-sourced transitions (sourceId present)
  AND csh."sourceId" IS NOT NULL
  -- Date precision filter (YEAR allowed but handled downstream)
  AND csh."datePrecision" IN ('DAY', 'MONTH', 'YEAR')
```

Post-filter: for each `claimId`, keep only claims with **≥ 2** qualifying
transitions. YEAR-precision transitions are retained in the pool but may only
generate as-of dates ≥ 365 days after `occurredAt`.

**Open question OQ-1:** `ClaimStatusHistory` has no `humanReviewed` field —
only `Claim` and `Source` do. The spec says "humanReviewed = true on history
rows." Interpreted here as: the transition must have `sourceId IS NOT NULL` (a
marker artifact exists). If the intent was also to require
`Source.humanReviewed = true`, the query above must add `AND s."humanReviewed" =
true`, which would reduce the eligible pool substantially. **Owner sign-off
needed before full build.**

---

## 2. Item construction per type

### Type 1 — As-of status

For each eligible claim, sort its qualifying transitions by `occurredAt`. For
each transition boundary, sample three as-of dates:

| Slot | Offset | Purpose |
|------|--------|---------|
| `before` | −1 day (DAY precision) / −15 days (MONTH) | Hallucination trap |
| `after` | +1 day / +15 days | Should match transition |
| `stable` | midpoint between this and next transition (or +180 days for last) | Long-stable period |

Gold = the `toAxis` of the latest transition with `occurredAt ≤ as_of_date`; if
no transition precedes the date, gold = `RECORDED`.

Ambiguity exclusion: if the winning transition has `datePrecision = MONTH` and
the as-of date falls within the same calendar month as `occurredAt`, the item
is excluded (two axes defensible).

### Type 2 — Transition attribution

For each transition with a marker source (`sourceId IS NOT NULL`), produce an
item asking which source (title + date) caused the transition from `fromAxis` →
`toAxis`. Gold = `{ title: source.name, publishedAt: source.publishedAt }`.
Scored at ±30 days and fuzzy title match (Levenshtein ratio ≥ 0.85).

### Type 3 — Reversal awareness

Select claims that have at least one transition where `toAxis IN ('REVERSED',
'ABANDONED')`. Item prompt: "Did the consensus on this claim ever reverse? When?"
Gold = `{ reversed: true, date: occurredAt }` with the date window from that
transition's precision.

### Type 4 — Negative controls (~10 % of set)

Constructed by perturbation of real claims, NOT drawn from the DB:
1. Take a real claim text; replace key named entity with a plausible fake
   (wrong drug name + real approval pattern; wrong case citation + real legal arc).
2. Assign gold = `{ inRecord: false }`.
3. Run similarity check against all real claim texts (cosine sim on TF-IDF
   vectors, threshold 0.85) to verify no accidental collision.
4. Tag `metadata.construction_method = "negcontrol_perturb_v1"`.

**Open question OQ-2:** We have no embedding service available at build time
(no GPU, no API key guaranteed). Similarity check uses offline TF-IDF
(implemented in-script). If a heavier semantic check is required, flag to owner.

---

## 3. Leakage check

Automated regex scan over `item.prompt` for:
- Known status words: `retract`, `revers`, `abandon`, `settle`, `contested`,
  `REVERSED`, `ABANDONED`, `SETTLED`
- Marker source titles / DOIs embedded in claim text

Any match → item excluded + added to `leakage-flagged.jsonl` for human review.

---

## 4. Determinism

Seed passed via `--seed` flag (default `42`). All randomness (as-of date
sampling, negative-control entity substitution, final shuffle) uses a
seeded PRNG (`mulberry32`). Two runs with same seed + same DB snapshot must
produce identical output verified by `sha256sum`.

Version stamp: every item carries `pipeline_version: "er-eval-v1"`.

---

## 5. Output sizes

| Slice | Items | Notes |
|-------|-------|-------|
| Free | 500 | All four types; includes all case-study claims |
| Full | 5,000 | Same construction; broader claim population |

Both slices written as `eval-set-free-er-eval-v1.jsonl` and
`eval-set-full-er-eval-v1.jsonl`.

---

## 6. Open questions (blocking)

| ID | Question | Impact |
|----|----------|--------|
| OQ-1 | Does gold-label sourcing require `Source.humanReviewed = true` or only `sourceId IS NOT NULL`? | Pool size, quality bar |
| OQ-2 | Is TF-IDF offline similarity sufficient for negative-control collision check, or require embedding API? | Negative-control quality |
| OQ-3 | Case-study claims: no structured list in repo. Should we use `c.humanReviewed = true AND c.ingestedBy = 'manual'` as a proxy for "case-study"? | Free-slice showcase selection |
