# Briefing 06 — Quiet Reversals (findings that stopped being believed)

## Why

White paper Future Work #2, and the hardest thing this product can do: formal retractions are covered (26k+ curved in wave 2), but the more common failure mode in science is a finding that is never retracted — it just stops being cited, fails to replicate without fanfare, or gets contradicted by a later meta-analysis nobody press-released. No deterministic rule can find these. This briefing builds the assembly line: signal → candidates → LLM research → human gate.

**Prerequisites:** briefing 01 (unique constraint) landed; openalex promoter has been running long enough to have produced some CONTESTED/REVERSED curves (they calibrate what real reversal arcs look like in this corpus).

## The epistemic trap — read this before designing anything

Citation decay is NOT reversal. Every paper's citations decay with age, and the *most successful* findings decay fastest into invisibility because they become textbook knowledge nobody cites ("obliteration by incorporation" — Merton). A naive decay detector flags the corpus's best claims as its failures. Therefore:

1. Decay is only ever a **candidate signal**, never evidence. Candidates need a discriminating co-signal (failed replication, contradicting meta-analysis, retraction of the finding's evidentiary base).
2. A quiet reversal only becomes a receipt when **someone wrote the quiet part down**. A ClaimStatusHistory row needs a date and a source; "the field moved on" has neither until a citable document (review article, meta-analysis, replication report, guideline removal) says so. No adjudicating document → no transition, however suggestive the decay curve. This is non-negotiable (never fabricate; the date is the document's date, precision as warranted, community EXPERT_LITERATURE).
3. Asserting ABANDONED/REVERSED on a living researcher's work is an **editorial act** (AGENTS.md: editorial-not-algorithmic). The pipeline produces proposals; a human ships them.

## Phase A — citation-trajectory backfill (data, no judgment)

Claims carry `openalexId`. For each live openalex_v1 claim, fetch the full citations-per-year histogram in ONE API call per claim:

```
GET https://api.openalex.org/works?filter=cites:{openalexId}&group_by=publication_year&mailto=<polite email>
```

(Do NOT rely on the work object's `counts_by_year` — it only covers roughly the last decade; the group_by gives the full distribution.) Store as `metadata.citationsByYear = {"1998": 12, ...}` plus `metadata.citationsFetchedAt`, merged not clobbered — follow `scripts/backfill-retraction-pub-dates.ts` exactly (dry-run default, batched UPDATE on indexed id, DB-verified counts). Rate limits: OpenAlex polite pool ~10 req/s, 100k/day — 217k claims ≈ 3 days of sweeps; make the script resumable (cursor file, skip claims already carrying a fresh `citationsFetchedAt`). Prioritize claims by `cited_by_count` desc so the interesting half finishes first.

While in the citing set, also cheaply harvest co-signals per claim (same call family):
- `filter=cites:{id},title.search:replication|meta-analysis|systematic review` → count + top DOIs
- `filter=cites:{id},is_retracted:true` → how much of its citing support was itself retracted
Store counts under `metadata.quietSignals`.

## Phase B — candidate generator (read-only, ranked output)

`scripts/find-quiet-reversal-candidates.ts`: score = decay component (peak year, post-peak slope, share of citations in last 5y — age-normalized against the claim's own publication-year cohort within the corpus, not absolute) × co-signal component (replication/meta-analysis mentions, retracted-support share). Output ranked JSONL + human-readable report to `logs/`, with the top N annotated: claim text, curve link, decay stats, co-signal DOIs. **No DB writes.** Explicitly down-rank the incorporation pattern (huge lifetime citations, presence in guidelines/textbooks per co-signals) and label those "possible obliteration-by-incorporation — likely SETTLED, not abandoned"; they're candidates for a *settling* transition instead, which is also valuable.

## Phase C — LLM research pass

Feed candidates (not the whole corpus) to the promoter loop via `pick-promotable-claim.ts --pipeline` extension or a `--candidates <jsonl>` flag. Dedicated prompt, same contract as the openalex prompt plus:
- The decay stats and co-signal DOIs are given as leads, not conclusions.
- Acceptable outcomes: `RECORDED→CONTESTED` (dated challenge), `CONTESTED→ABANDONED` or `RECORDED→ABANDONED` (a citable document records that the field moved on — reviews with "early reports suggested… however", guideline removals, textbook reversals), `RECORDED→SETTLED` (incorporation case), or SKIP.
- SKIP remains the expected majority outcome. Decay + vibes ≠ a receipt.

## Phase D — human gate (mandatory for ABANDONED/REVERSED)

Unlike the standard loop, quiet-reversal enrichment scripts are NOT auto-applied. Write them to `scripts/enrichments/quiet-reversals/pending/`, with a summary block (claim, proposed transitions, sources, the candidate evidence) at the top of each file. Telegram ping lists pending count. The owner reviews and runs `apply-enrichment.ts` per script (or a small `review-quiet-reversals.sh` helper that shows the summary and asks y/n). `humanReviewed: true` is set only by this step — never by the generator (AGENTS.md: the flag means a human reviewed it).

## Verification

- Phase A: spot-check 5 claims' `citationsByYear` against the OpenAlex UI; fetched-count == DB count.
- Phase B: the report's top-20 must survive a manual smell test — if a Nobel-line finding ranks as "abandoned", the normalization is wrong; fix before Phase C.
- Phase C/D: every applied transition has a resolving URL that was fetch-verified; ABANDONED rows all carry document dates, not decay dates.
- End state metric: count of ABANDONED/CONTESTED transitions with `reason` citing a quiet-reversal document — the number the white paper can point at for Future Work #2.
