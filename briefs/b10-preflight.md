# B10 Preflight — Semantic Search Activation (spec-50 close-out)

**Date:** 2026-07-14  
**Branch:** `loop/search-b10-2026-07-14`  
**Worker:** Claude Sonnet 4.6 (subagent)

---

## Gate Check

| Item | Status |
|------|--------|
| `OPENAI_API_KEY` in VPS shell | **MISSING** — not in env, not in `.env.local`, not in `.env` |
| `EMBED_SPEND_CAP` / `EMBEDDING_MAX_TOKENS_PER_RUN` | **Not configured** (env var exists in backfill script but no value set) |
| B10-3 backfill | **BLOCKED** — requires API key AND explicit owner yes |

---

## B10-1: Preflight Census

### ClaimEmbedding table

| Item | Value |
|------|-------|
| Model in `prisma/schema.prisma` | ✅ Present (`ClaimEmbedding` model, line 806) |
| FK on `Claim` | `claimId @unique`, cascade delete |
| Embedding column | `vector(1536)` (Unsupported type — raw SQL operations) |
| Fields | `id`, `claimId`, `embedding`, `model`, `contentHash`, `updatedAt` |
| **Live DB row count** | **0** — table exists, no embeddings written yet |
| Total non-deleted claims | **1,757,943** |

### Backfill script

- **File:** `scripts/backfill-embeddings.ts` (spec says `embed-backfill.ts` — minor name drift, functionally identical)
- **Flags:** `--dry-run`, `--limit N`, `--verbose`
- **Cursor/resume:** cursor-based on claim `id` asc, contentHash dedup prevents double-spend on kill-restart
- **Spend guard env var:** `EMBEDDING_MAX_TOKENS_PER_RUN` (token count cap per run)
- **Estimated cost:** ~1M claims × ~50 tokens avg = ~50M tokens ≈ **$1.00 total** at text-embedding-3-small rate ($0.02/1M tokens)

### Incremental cron

- **File:** `app/api/cron/embed-incremental/route.ts`
- **Security:** CRON_SECRET bearer check + `isReadOnly()` fail-closed
- **Schedule:** nightly 02:00 UTC (vercel.json)
- **Spend guard:** same `EMBEDDING_MAX_TOKENS_PER_RUN` env var
- **Key-gated:** YES — `embedMany3Small` will fail without `OPENAI_API_KEY`; job returns error JSON (200 status so Vercel doesn't spam alerts)
- **Kill-restart safe:** contentHash dedup

### Hybrid search path (`lib/search.ts`)

- **Status: PRESENT AND ACTIVE** — not dormant
- Default mode is `hybrid` (RRF tsvector top-100 + vector top-100, k=60)
- `vectorSearch()` gracefully degrades: when `ClaimEmbedding` table is empty (current state), vector leg returns `[]` and hybrid falls back to tsvector-only
- All three endpoints wired: `/api/search`, `/api/v1/search`, `/api/v1/verify`
- `search_mode` query param selects: `tsvector` | `vector` | `hybrid`

### Eval set

- **File:** `tests/search-eval/queries.jsonl`
- **Queries:** 60 total (20 navigational, 20 topical, 10 vocab-mismatch, 10 paraphrase)
- **Before B10-2:** all `relevant_claim_ids` were `[]`
- **After B10-2:** 21/60 filled with real DB claim IDs (see below)

### Spec-50 deliverable gap

Spec says `embed-backfill.ts`; actual file is `backfill-embeddings.ts`. The comment header in the file shows the intended CLI as `scripts/embed-backfill.ts`. BUILD-STATUS.md references `npx tsx scripts/embed-backfill.ts`. **Action needed:** either rename or update BUILD-STATUS.md reference.

---

## B10-2: Eval Curation + Tsvector Baseline

### Method

Production site unreachable from VPS (DNS resolution fails for epistemicreceipts.com). Ran tsvector queries **directly against the live Neon DB** using the same SQL as `lib/search.ts`. Reviewed candidate texts and curated relevance judgments manually.

### Coverage

| Category | Queries with results | Total |
|----------|---------------------|-------|
| Navigational | 14 | 20 |
| Topical | 5 | 20 |
| Vocab-mismatch | 2 | 10 |
| Paraphrase | 0 | 10 |
| **Total** | **21** | **60** |

39/60 queries return **zero tsvector results** — exactly the queries where semantic (vector) search is expected to win.

### Tsvector baseline metrics

**On curated queries only (21/60):**

| Metric | Value |
|--------|-------|
| nDCG@10 | **96.9%** |
| Recall@50 | **100.0%** |

By category:
- Navigational: nDCG@10=95.4%, Recall@50=100% (n=14)
- Topical: nDCG@10=100.0%, Recall@50=100% (n=5)
- Vocab-mismatch: nDCG@10=100.0%, Recall@50=100% (n=2)
- Paraphrase: n=0 (no results)

**Adjusted for all 60 queries (uncovered = score 0):**

| Metric | Value |
|--------|-------|
| Adjusted nDCG@10 | **33.9%** |
| Adjusted Recall@50 | **35.0%** |

### Interpretation

The 96.9% nDCG on covered queries is expected — ground truth was bootstrapped from tsvector output, so tsvector scores near-perfect on what it can retrieve. The signal is the **35% coverage** — tsvector simply returns nothing for 65% of the query types in this eval set (all paraphrase, most vocab-mismatch, half of topical).

After backfill, the hybrid eval will include all 60 queries. The comparison that matters: hybrid nDCG@10 vs 33.9% adjusted baseline.

### Curation notes

- `nav-08` (Pfizer BNT162b2): excluded — only tsvector hit was for a pneumococcal vaccine trial, not BNT162b2
- `nav-05` (Nobel 2023): excluded 3 of 9 results (1998/2008 prize winners, unrelated MHRA approval)
- `nav-06` (Roe v Wade): excluded 3 of 6 results (fertility rate paper, abstract about elected officials)
- `nav-20` (GDPR): used 3 of 6 most directly on-topic
- `top-01` (image manipulation retractions): used first 3 of 4

---

## Stop: B10-3 Blocked

**Do not run until Robert explicitly says yes in a new message.**

The backfill command to approve:
```
OPENAI_API_KEY=<key> npx tsx scripts/backfill-embeddings.ts --limit 25
```
Pilot first with `--limit 25` to verify DB writes work, then full run without `--limit`.

**Prerequisites before approving:**
1. Add `OPENAI_API_KEY` to Vercel env vars AND to VPS shell (or `.env.local` with a `sk-` key)
2. Optionally set `EMBEDDING_MAX_TOKENS_PER_RUN=5000000` (≈$0.10 cap) for the pilot
3. Confirm script name: either rename `backfill-embeddings.ts` → `embed-backfill.ts` or note the discrepancy

**Estimated full backfill cost:** ~$1.00 (1M claims × 50 tokens avg × $0.02/1M)
