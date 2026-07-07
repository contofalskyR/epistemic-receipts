# er-eval-v1 — Epistemic Receipts Temporal-Knowledge Eval

Evaluation harness for the Epistemic Receipts temporal-knowledge benchmark.

## One-command reproduction (free slice)

```bash
# 1. Build the eval set (requires DATABASE_URL in .env.local)
npx tsx scripts/build-eval-set.ts --free --seed 42 --snapshot 2026-07-07
# → eval-set-free-er-eval-v1.jsonl

# 2. Run a model through the reference adapter (OpenAI-compatible)
OPENAI_API_KEY=sk-... \
npx tsx packages/eval/adapters/openai.ts \
  --items eval-set-free-er-eval-v1.jsonl \
  --model gpt-4o \
  --out model-answers-gpt4o.jsonl

# 3. Score
npx tsx packages/eval/score.ts \
  --items eval-set-free-er-eval-v1.jsonl \
  --answers model-answers-gpt4o.jsonl \
  --model gpt-4o \
  --out results-gpt4o.json
```

## Anthropic API adapter

```bash
ANTHROPIC_API_KEY=sk-ant-... \
npx tsx packages/eval/adapters/anthropic.ts \
  --items eval-set-free-er-eval-v1.jsonl \
  --model claude-sonnet-5 \
  --out model-answers-sonnet5.jsonl
```

## Generate human-review checklist

```bash
npx tsx packages/eval/checklist-generator.ts \
  --items eval-set-free-er-eval-v1.jsonl \
  --n 100 \
  --seed 42 \
  --out docs/human-review-checklist-free.md
```

## Upload to R2

```bash
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... \
npx tsx packages/eval/upload-r2.ts \
  --file eval-set-free-er-eval-v1.jsonl \
  --public
```

## Item schema

Every item in the JSONL files has this shape:

```typescript
{
  id: string                    // e.g. "er-eval-v1-aos-0042-000001"
  pipeline_version: string      // "er-eval-v1"
  type: ItemType                // "as_of_status" | "transition_attribution" | "reversal_awareness" | "negative_control"
  claim_id: string | null       // null for negative controls
  prompt: string                // the question to ask the model
  gold: Gold                    // structured expected answer
  receipts: string[]            // source URLs
  construction_method: string   // how the item was built
  pipeline_provenance: {
    seed: number
    snapshot_date: string
    slot?: string               // "before" | "after" | "stable"
    transition_ids?: string[]
  }
}
```

## Scoring

Answers file format — one JSON object per line:
```jsonl
{"item_id": "er-eval-v1-aos-0042-000001", "answer": "SETTLED"}
{"item_id": "er-eval-v1-ta-0042-000002", "answer": "FDA drug approval letter dated 2021-03-15"}
```

Scorer outputs per-type accuracy and flags mis-calibrated types (>95% or <5%).

## Files

| File | Purpose |
|------|---------|
| `schema.ts` | Shared type definitions |
| `score.ts` | Scoring harness CLI |
| `checklist-generator.ts` | Human-review checklist generator |
| `adapters/openai.ts` | OpenAI-compatible reference adapter |
| `adapters/anthropic.ts` | Anthropic API reference adapter |
| `upload-r2.ts` | R2 upload script |
| `huggingface-dataset-card.md` | HuggingFace dataset card (ready for HF org creation) |
