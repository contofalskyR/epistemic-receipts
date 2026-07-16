# OpenAlex LLM Promoter — Post-Run Audit & Expansion Plan

**Run completed:** 2026-07-16 · `openalex_v1` · ≥5,000 `cited_by_count` tier **exhausted** (runs #1–92)  
**Model:** `claude-opus-4-8` · **Loop:** `scripts/loop-corpus-promoter.sh` on Mac

---

## Run summary

The first sustained batch of the OpenAlex LLM promoter targeted the 641 highest-cited `openalex_v1` papers (≥5,000 `cited_by_count`). Each was researched for a specific, dated post-publication event — retraction, failed replication, meta-analysis that overturns or confirms, guideline adoption. Widespread citation alone is not a qualifying event. Papers without a datable event were skipped. This is correct behavior, not a defect.

**Final numbers (2026-07-16, Mac logs):**

| Metric | Value |
|---|---|
| Total attempted | 667 |
| Promoted (transitions written) | 271 |
| Skipped | 252 |
| Other (errors / already-promoted) | 144 |
| Yield % | **40.6%** |
| Git commits (promoter batches) | 79 |

---

## Audit protocol

Run these after Robert pushes from the Mac. All VPS commands run as `opuser` in `~/workspace/epistemic-receipts`.

**Step 1 — confirm commits landed:**
```bash
git pull
git log --oneline --since="2026-07-15" | grep -i "openalex-promoter"
```

**Step 2 — pull attempt counts (run on Mac, in `~/Projects/epistemic-receipts`):**
```bash
wc -l logs/corpus-promoter-attempted.jsonl
grep '"result":"promoted"' logs/corpus-promoter-attempted.jsonl | wc -l
grep '"result":"skipped"'  logs/corpus-promoter-attempted.jsonl | wc -l
```

**Step 3 — DB breakdown (already run 2026-07-16):**

| toAxis | community | n |
|---|---|---|
| SETTLED | EXPERT_LITERATURE | 131 |
| CONTESTED | EXPERT_LITERATURE | 97 |
| SETTLED | INSTITUTIONAL | 80 |
| REVERSED | INSTITUTIONAL | 5 |
| REVERSED | EXPERT_LITERATURE | 3 |
| CONTESTED | INSTITUTIONAL | 2 |
| **Total** | | **318** |

318 transitions written to DB from 271 promoted claims (avg ~1.17 transitions/claim — expected, some claims get 2 steps).

**Reading:** Healthy mix — SETTLED and CONTESTED dominate as expected for high-citation academic work. Only 8 REVERSED across both communities (2.5%), no over-attribution signal. EXPERT_LITERATURE dominates (72%), INSTITUTIONAL 28% — promoter is sourcing follow-on literature correctly.

---

## Expansion decision matrix

The next decision is whether to run a larger batch. Use the yield from this run:

| Yield % (promoted/attempted) | Recommendation | Next batch | Estimated cost | Estimated runtime |
|---|---|---|---|---|
| >10% | Run next tier now | ≥1,000 cited_by_count (~8-12K claims) | $160–600 | ~3 weeks Mac (sequential) |
| 5–10% | Run next tier with pre-filter (§4) | ≥1,000 cited_by_count, filtered | $80–300 | ~1.5 weeks |
| 2–5% | Fix prompt, re-pilot 50 claims, then decide | — | — | — |
| <2% | Stop. Audit decisions.jsonl first | — | — | — |

**Runtime note:** 2.4 min/claim sequential = 8-12K claims ≈ 320-480 hours ≈ 2-3 weeks non-stop. Two parallel terminal tabs halve that. `GNU parallel -j2` would require splitting the attempt ledger. Simpler: just open two Mac terminals running the loop with different `--attempted` ledger files pointing to the same DB (idempotent upserts handle any overlap).

---

## Pre-filter proposal

The loop currently calls Opus for every claim including those almost certain to skip (obscure conference papers, 0 follow-on citations, non-English titles). A pre-screen in `pick-promotable-claim.ts` before the LLM call can cut cost 30-50%.

**Criteria to add** (filter out before emitting to the loop):

```typescript
// In the WHERE clause of pick-promotable-claim.ts:
AND (metadata->>'cited_by_count')::int >= 200          -- below this, follow-on lit is sparse
AND (metadata->>'language' IS NULL OR metadata->>'language' = 'en')  -- English only
```

Or as a post-select JS filter before the prompt is built (simpler, no schema change):

```typescript
const filtered = candidates.filter(c => {
  const cited = Number(c.metadata?.cited_by_count ?? 0)
  const lang  = c.metadata?.language ?? 'en'
  return cited >= 200 && lang === 'en'
})
```

**Expected reduction:** ~30-40% of the ≥5K cited_by_count tier passes; ~60% of lower tiers. If yield doesn't change, the pre-filter is free money.

**Where to implement:** `scripts/pick-promotable-claim.ts` around line 60 (the WHERE clause) or in the loop's post-pick JS block. Add a `--min-citations` CLI flag (default 0, override to 200 or 500) so it's tunable without code changes.

---

## Model swap trial (Fable 5 vs. Opus 4.8)

The inner research call (`claude --model claude-opus-4-8 --print`) is the core cost driver and quality gate. `anthropic/claude-fable-5` is available and worth trialing.

**Case for:** Fable 5 is a research-oriented model with broader web knowledge and stronger source attribution. For "what happened to this paper after publication," that profile fits well.

**Risk:** Fable may be less conservative — fewer skips but shallower sourcing. The mandate requires datable, URL-verifiable events; Fable could invent plausible-sounding ones.

**Trial protocol:**
1. Pick 20 claims manually (same IDs, copy from `logs/corpus-promoter-attempted.jsonl` skips)
2. Run each through both models: `claude --model claude-opus-4-8 --print` vs `claude --model anthropic/claude-fable-5 --print` with the same prompt
3. Compare: skip rates, source URL quality (do they resolve?), transition type distribution
4. If Fable's promoted output passes `apply-enrichment.ts` validation and URLs verify, swap the model line in `loop-corpus-promoter.sh`:
   ```bash
   # line ~42 in loop-corpus-promoter.sh
   --model anthropic/claude-fable-5 \
   ```

Run the trial before committing to a next-tier expansion — the model choice affects cost and quality at scale.

---

## Open question: single-step residue arc

~8,344 `crossref_retractions_v1` claims were ingested as single-step `RECORDED→REVERSED` arcs with no prior `RECORDED` baseline. These are data-correct (the arc IS the event) but the curve is incomplete. The promoter doesn't touch them (they already have 2 transitions). Closing them requires a separate pass that back-fills the `null→RECORDED` entry at the paper's original publication date. Low priority, but note it if the audit surfaces them in the DB query above.
