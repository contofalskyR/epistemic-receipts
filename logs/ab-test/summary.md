# A/B test — corpus promoter model comparison (opus-4-8 vs fable-5)

**Date:** 2026-07-16 · **Harness:** `scripts/ab-test-promoter.sh` @ branch `loop/ab-test-promoter-2026-07-16` · **Test set:** first 20 `"skipped"` claims by file order from `logs/corpus-promoter-attempted.jsonl` (the hardest cases — production opus previously found no qualifying event for any of them) · **Mode:** observation-only; nothing applied, no DB writes.

**Disclosure:** this summary was graded by a Fable-family model (claude-fable-5). The rubric below is mechanical where possible and every raw output is preserved in this directory — spot-check the grading against the receipts before acting on the verdict.

---

## Mechanical results

| | opus-4-8 | fable-5 |
|---|---|---|
| Valid outputs (contract-conforming) | 19/20 | **20/20** |
| PROMOTED | 5 | 4 |
| SKIPPED | 14 | 16 |
| Invalid | 1 (see anomaly note) | 0 |
| Total cost | $20.84 | **$16.99** (−18%) |
| Avg latency | **101s** | 154s (+53%) |
| Hallucinated/implausible URLs | 0 found | 0 found |

Every PROMOTED output on both sides carries a VERIFICATION_LOG of real, well-formed identifiers (Crossref/OpenAlex API checks, `is_retracted` lookups, honest failure notes like "Wiley bot-block; identity confirmed via Crossref"). URL-shape review found no fabricated DOI patterns on either side. Per the test spec, URLs were pattern-checked, not fetched — spot-fetch before applying anything.

**Agreement matrix (20 claims):** 13 both-skip · 2 both-promote (ERA5 → IPCC AR6; ERA-Interim → ECMWF/IPCC AR5 — converging on the same verdicts via different but real adjudicating documents) · 2 fable-only promotes · 3 opus-only promotes.

**Skip quality:** high and equivalent on both sides — specific, evidence-cited (Crossref `update-to` checks, citation counts, age), correctly refusing to settle young/uncited/methods papers. Both models independently detected two corpus claim/DOI mismatches (the Braun & Clarke claim text is a mismatched citing paper; likewise the COSIT 2022 item) — a side-finding for the error-rate audit, not a model difference.

## The five disagreements (the actual signal)

1. **Retraction-note claim (fable promoted, opus skipped)** — the standout output of the test. Fable found the Crossref `updated-by` relation binding the retraction note to its original article, quoted the note verbatim, explicitly declined to invent a CONTESTED waypoint ("no separately-dated expression of concern... so none is asserted"), deterministic IDs, DAY precision. Matches the wave-2 house convention for retraction arcs. **Do not apply it without an owner policy call:** if the original paper carries its own arc via `crossref_retractions_v1`, applying this creates a duplicate-arc risk. The output is correct; the policy is undecided.
2. **PSO 1995 (fable promoted)** — the weakest promotion of the test. Adjudicating doc is a 2007 *Swarm Intelligence* "overview" **co-authored by Kennedy, PSO's own inventor** — self-ratification-adjacent, softer than the prompt's category-4 bar. A strict reviewer rejects this one.
3. **GLOBOCAN 2011 (opus promoted)** — settling doc is the 2018 successor report from the same IARC/ACS body **with co-author overlap** — same self-ratification softness as #2, one notch more defensible (institutional series).
4. **Kalman 1960 (opus promoted)** — 2008 NAE Draper Prize as INSTITUTIONAL ratification. Creative, real, dated, defensible under category 4; good community attribution.
5. **Friedman 2001 (opus promoted)** — ESL 2nd-edition textbook canonization; the cleanest category-4 promotion in the test ("textbook consensus" is explicitly in the prompt).

Pattern: **opus promotes canonization events slightly more liberally; fable is more conservative except where a hard documentary adjudication exists — and it was the only model to find one.** Both models produced exactly one self-ratification-adjacent promotion each (#2, #3), which is a prompt gap, not a model gap.

## Anomaly note

One opus output (`cmpon62s705uvsawxgzzsp440-opus.txt`, 447 bytes) contains leaked instruction-fragment text with no output contract — captured during the first harness run, whose validation only required a non-empty result. The patched harness (same branch) now requires `is_error: false` **and** the `PROMOTED:/SKIPPED:/FILE:` contract, and would have retried it. Counted as invalid, not as a skip; attribution ambiguous (CLI glitch vs model), single occurrence.

## Verdict

**Swap to Fable for the ≥4,000-citation tier**, on: cost (−18% at quality parity), contract compliance (20/20), equal-or-better skip discipline on the corpus's poison metric (false promotion), zero hallucinated identifiers, and the only hard-document solve in the set. Fable's +53% latency is irrelevant to an unattended loop. This is a 20-claim sample of skip-tier cases — treat it as directional, not definitive.

Three conditions attach:

1. **Prompt amendment before the tier runs (either model):** adjudicating documents must be *independent of the original authors* — kills the PSO-overview/GLOBOCAN-successor class of soft promotion on both sides.
2. **Owner policy call before applying fable's retraction-note output:** decide the openalex-retraction-note convention (model-as-finding-arc vs skip-as-terminal) with the crossref_retractions_v1 dedup question answered.
3. **Re-eval checkpoint:** after the first 100 tier claims, sample 10 promotions for human review before letting the remaining ~880 run. If the promotion-quality profile shifts from this test's, halt and re-judge.

*Grader's note: the mechanical columns favor fable; the qualitative column is closer to a tie with different biases. A human weighing disagreement #2 (fable's weakest) more heavily than #1 (fable's best) could reasonably call this inconclusive and keep opus. The raw outputs are all here; the call is the owner's.*
