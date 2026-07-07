# Spec 50 — Search & Embedding Upgrade

Phase 2–3 (before search is a paid feature) · Depends on: 00 · Model: **Opus 4.8** · Scope: ~1 week of agent sessions

## Objective
Current semantic search: 384-dim MiniLM (@xenova/transformers) on `TrajectorySearchDoc` only — the weakest link before `/v1/search` and `verify` are sold. Upgrade embeddings, cover ALL claims, add ANN indexing, combine with tsvector into hybrid search, and prove the improvement with an eval — not vibes.

## Design (decided)
- **Model: `text-embedding-3-small` (1536-dim, OpenAI)** — chosen for cost (~$0.02/1M tokens: full 1M-claim corpus ≈ single-digit dollars), quality, and the `@ai-sdk/openai` dependency already present. Wrap behind `lib/embeddings.ts` (single provider interface: `embed(texts[]) → vectors`) so the provider is swappable; record `model` + `dims` on every row.
- **New table `ClaimEmbedding`** (claimId unique FK, embedding `vector(1536)`, model, contentHash, updatedAt) — separate from TrajectorySearchDoc (which stays for trajectory-specific search until deprecated). Embed text = claim text + top-3 topic names + pipeline display name (deterministic composition, hashed → re-embed only when contentHash changes).
- Backfill: batched (2048/req), resumable via harness-style cursor, rate-limit aware, run from a script not Vercel. Budget guard: hard cap env var on spend per run.
- **Index: HNSW** (`m=16, ef_construction=64`, cosine) — build AFTER backfill completes (much faster). Raw-SQL migration (pgvector ops aren't Prisma-native; follow the existing tsvector migration pattern). Check Neon plan memory limits for 1M×1536 HNSW build; if build fails on plan limits, fall back to IVFFlat (lists=1000) and say so — do not silently ship without an index.
- **Hybrid search** in `lib/search.ts`, used by site `/search` AND `/v1/search` AND `verify`: tsvector top-100 + vector top-100 → Reciprocal Rank Fusion (k=60) → optional filters. Weights configurable; ship RRF defaults, don't hand-tune per query.
- Incremental: new/updated claims get embeddings via a nightly job (contentHash diff), so search doesn't decay as pipelines run.

## The eval (do this FIRST, before changing anything)
`tests/search-eval/queries.jsonl` — 60 hand-written queries with graded relevant claim IDs (find them via existing search + manual browsing): 20 navigational ("Korematsu v United States", "semaglutide approval"), 20 topical ("papers retracted for image manipulation", "EU AI legislation 2024"), 10 vocabulary-mismatch ("weight loss drug heart risk" → FAERS/label claims), 10 cross-lingual-ish/paraphrase ("law about forgetting personal data online"). Metric: nDCG@10 + recall@50, scripted runner.
Baseline the CURRENT search first; then measure tsvector-only, vector-only, hybrid. **Ship hybrid only if it beats baseline on nDCG@10 overall AND doesn't regress the navigational subset** (semantic search classically breaks exact-title lookups; RRF usually protects this — verify, don't assume).

## Deliverables
1. Eval set + runner + baseline numbers (first PR, before any changes).
2. `ClaimEmbedding` migration, `lib/embeddings.ts`, backfill script, nightly incremental job.
3. HNSW migration + `lib/search.ts` hybrid + wiring into `/search`, `/v1/search`, `verify`.
4. `docs/runbooks/search.md`: re-embedding procedure (model swap), index rebuild, cost notes, eval-before-ship rule.

## Out of scope
Meilisearch/Typesense (only if tsvector becomes the complaint later), reranker models, multilingual embeddings (note as follow-up — the corpus HAS non-English legislation; add 5 such queries to the eval to quantify the gap for the future).

## Acceptance criteria
- Eval table in PR: baseline vs tsvector vs vector vs hybrid, overall + per-category. Hybrid wins per the ship rule above.
- p95 hybrid latency < 500ms on production-size data (measure on staging with full backfill; paste numbers with and without index to prove the index matters).
- Backfill: 100% of non-deleted claims have embeddings (count query); resumability proven (kill-restart, no duplicate spend — contentHash guard).
- Incremental job: ingest 10 new claims on staging → embeddings appear after job run.
- Spend guard triggers correctly on an artificially low cap.

## Verification
Paste: eval comparison table, latency numbers, coverage counts, kill-restart log.
