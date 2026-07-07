---
license: other
license_name: epistemic-receipts-community
license_link: https://epistemic.tools/license/community
language:
- en
tags:
- temporal-reasoning
- hallucination-detection
- epistemic-status
- knowledge-cutoff
- fact-checking
pretty_name: Epistemic Receipts Temporal-Knowledge Eval (er-eval-v1)
size_categories:
- 1K<n<10K
---

# Epistemic Receipts Temporal-Knowledge Eval Set — er-eval-v1

A benchmark for measuring LLM temporal knowledge and hallucination on
epistemic-status questions: "what was the consensus on X as of date T, and
what changed it?"

## Dataset Description

**Free slice:** 500 items (all four item types, includes all case-study claims).  
**Full set:** 5,000 items (commercial license — contact epistemic.tools).

### Item types

| Type | Description | Gold format |
|------|-------------|-------------|
| `as_of_status` | Given claim + date, what was the epistemic axis? | One of: RECORDED, SETTLED, CONTESTED, OPEN, UNRESOLVABLE, REVERSED, ABANDONED |
| `transition_attribution` | What source caused a status change? | Source title + date (±30 days, fuzzy title match) |
| `reversal_awareness` | Did the consensus ever reverse? When? | `{reversed, date}` |
| `negative_control` | Plausible but fabricated claim — is it in the record? | NOT IN RECORD |

### What the benchmark tests

- Temporal reasoning: does the model apply knowledge-as-of-date or anachronistically apply later facts?
- Hallucination detection: does the model invent source citations for fabricated claims?
- Reversal awareness: does the model know about consensus reversals — almost uniquely tested here.

## Construction

Gold labels derived exclusively from `ClaimStatusHistory` transitions in the
Epistemic Receipts database, filtered to:
- Marker-sourced transitions only (`sourceId IS NOT NULL`)
- Claims with ≥2 qualifying transitions
- `datePrecision` of DAY or MONTH (YEAR with ≥365-day as-of offset)

Negative controls: real claim texts perturbed by replacing named entities.
Similarity-checked against corpus (TF-IDF cosine < 0.85) to verify no collision.

Leakage screen: items excluded if gold label derivable from claim text (regex).
Ambiguity screen: MONTH-precision transitions excluded if as-of date falls in same calendar month.

**Deterministic:** builder seeded (`--seed 42`), two runs on same DB snapshot
produce identical SHA-256 hash.

## Methodology

See [epistemic.tools/methodology](https://epistemic.tools/methodology) and
`specs/23-eval-product.md` in the source repository.

## Scoring

```bash
git clone https://github.com/epistemic-receipts/epistemic-receipts
cd epistemic-receipts
# Run reference adapter (OpenAI-compatible)
OPENAI_API_KEY=sk-... npx tsx packages/eval/adapters/openai.ts \
  --items eval-set-free-er-eval-v1.jsonl --model gpt-4o \
  --out model-answers-gpt4o.jsonl
# Score
npx tsx packages/eval/score.ts \
  --items eval-set-free-er-eval-v1.jsonl \
  --answers model-answers-gpt4o.jsonl \
  --model gpt-4o
```

## License

Free slice: community license (non-commercial research and evaluation).  
Full set: commercial license. See [epistemic.tools/license](https://epistemic.tools/license).

## Citation

```bibtex
@dataset{epistemic_receipts_eval_2026,
  title  = {Epistemic Receipts Temporal-Knowledge Eval Set (er-eval-v1)},
  author = {Contofalsky, Robert},
  year   = {2026},
  url    = {https://huggingface.co/datasets/epistemic-receipts/er-eval-v1},
}
```
