# Spec 23 — Temporal-Knowledge Eval Set

Phase 2 · Depends on: 11 · Model: **Opus 4.8** · Scope: ~3–5 agent sessions
This spec has the most data-quality judgment. When in doubt, exclude the item — a small clean eval beats a large noisy one.

## Objective
Package `ClaimStatusHistory` into a versioned eval set measuring temporal knowledge and hallucination: "what was the epistemic status of X as of date T, and what changed it?" Free public slice establishes the citation; full set is a commercial product.

## Item construction (decided)
Source population: claims with ≥2 `ClaimStatusHistory` transitions with `datePrecision` of DAY or MONTH (YEAR-precision transitions may only be used with as-of dates ≥ 1 year after the transition). Exclude: DEPRECATED claims, anything from known-bad pipelines, claims whose transitions lack marker sources, claims where `humanReviewed = false` on the status history — **eval gold labels must trace to human-reviewed or marker-sourced transitions only.**

Item types:
1. **As-of status** (core): `{claim_text, as_of_date}` → gold = axis at that date (latest transition ≤ date; RECORDED if only emerged). Sample as-of dates strategically: just before a transition, just after, and long-stable periods — the "just before" items are the hallucination trap (models anachronistically apply later knowledge).
2. **Transition attribution**: `{claim_text, from_axis, to_axis}` → gold = marker source (title + date; scored by date within ±30d and fuzzy title match).
3. **Reversal awareness**: claims with REVERSED/ABANDONED transitions → "did the consensus on X ever reverse? when?" Gold from history. These are the differentiated items — almost no eval tests them.
4. **Negative controls** (~10%): plausible-sounding fabricated claims (constructed by perturbing real ones: wrong drug + real approval pattern, wrong case name + real legal arc). Gold = "not in record." Mark these clearly in metadata; they test whether a model invents receipts.

Sizes: free slice 500 items (all four types, all case-study claims included — they're the showcase); full set 5,000. Splits documented. Every item carries: id, type, claim_id (null for negatives), gold, receipts (source URLs), pipeline provenance, construction method.

## Harness
`packages/eval/` — plain TS runner: takes a model-output JSONL (`{item_id, answer}`), scores per type (axis exact-match; attribution date/title match; reversal yes/no + date window; negative-control = any invented specifics counts as failure), emits per-type and aggregate scores + a "temporal confusion matrix" (predicted axis vs gold by time-distance-from-transition). Include a reference adapter that runs the eval via any OpenAI-compatible or Anthropic API (env-keyed) so a buyer can reproduce in one command.

## Validation (the hard part — do not skip)
- Human-review queue: 100 random items rendered to a checklist doc for owner sign-off before any release; 200 for the commercial set.
- Leakage check: no item's gold is derivable from the claim text itself (e.g., claim text contains "retracted") — automated regex screen + flag list for human review.
- Ambiguity screen: items where two axes are defensible at the as-of date (transition same month, MONTH precision) → excluded automatically.
- Baseline runs: score 2–3 current models; if any type scores >95% or <5%, the type is mis-calibrated — revise before release. Paste baselines in PR.

## Deliverables
1. `scripts/build-eval-set.ts` (deterministic given a snapshot + seed; version stamped `er-eval-v1`).
2. `packages/eval/` harness + reference adapter + README with reproduction command.
3. Free slice published: R2 public + HuggingFace dataset (creating the HF org is a human step; leave upload script + card ready). Dataset card = methodology, construction, license (community license, Spec 13; commercial set under commercial license).
4. Announcement-ready summary in `docs/eval-v1-results.md`: construction stats + baseline scores table.

## Out of scope
Leaderboard site. Continuous eval service. Non-English items.

## Acceptance criteria
- Builder is deterministic (two runs, identical output hash). Every item passes schema validation.
- Human-review checklist generated; PR blocks release behind owner sign-off checkbox.
- Leakage screen + ambiguity screen outputs included; excluded counts reported.
- Baselines run end-to-end via the reference adapter; per-type scores in the results doc; no type outside 5–95%.
- Negative controls: verified none collide with a real DB claim (similarity check against corpus).

## Verification
Paste: determinism hashes, screen outputs, baseline score table, collision-check output.
