/**
 * Search eval runner.
 *
 * Measures nDCG@10 and Recall@50 for each search mode against the graded
 * query set in queries.jsonl, then prints a comparison table.
 *
 * Modes tested:
 *   baseline  — current /api/search (tsvector + trgm fallback)
 *   tsvector  — tsvector-only (same endpoint, future: dedicated param)
 *   vector    — vector-only (ClaimEmbedding cosine)
 *   hybrid    — RRF(tsvector + vector) via /api/search?mode=hybrid
 *
 * Metrics:
 *   nDCG@10   — primary ranking quality metric
 *   Recall@50 — coverage check: how many relevant docs appear in top 50
 *
 * Usage:
 *   SEARCH_BASE=https://epistemicreceipts.com npx tsx tests/search-eval/run-eval.ts --mode baseline
 *   SEARCH_BASE=http://localhost:3000 npx tsx tests/search-eval/run-eval.ts --mode all
 *
 * Note: queries with empty relevant_claim_ids are skipped (not yet curated).
 * Run bootstrap-claim-ids.ts first to populate candidates, then review them.
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SEARCH_BASE = process.env.SEARCH_BASE ?? 'http://localhost:3000';
const QUERIES_FILE = path.join(__dirname, 'queries.jsonl');

type EvalQuery = {
  id: string;
  category: string;
  query: string;
  relevant_claim_ids: string[];
  notes?: string;
};

type SearchMode = 'baseline' | 'tsvector' | 'vector' | 'hybrid';

type ClaimHit = {
  id: string;
  text: string;
  rank?: number | null;
};

// ── Metrics ────────────────────────────────────────────────────────────────────

/** Ideal DCG for top-k with `relevantCount` relevant items (all gain=1). */
function idcg(k: number, relevantCount: number): number {
  const count = Math.min(k, relevantCount);
  let s = 0;
  for (let i = 0; i < count; i++) s += 1 / Math.log2(i + 2);
  return s;
}

/** nDCG@k given ranked list and set of relevant IDs. */
function nDCG(rankedIds: string[], relevantSet: Set<string>, k: number): number {
  const top = rankedIds.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < top.length; i++) {
    if (relevantSet.has(top[i])) dcg += 1 / Math.log2(i + 2);
  }
  const ideal = idcg(k, relevantSet.size);
  return ideal === 0 ? 0 : dcg / ideal;
}

/** Recall@k: fraction of relevant docs in top-k. */
function recallAt(rankedIds: string[], relevantSet: Set<string>, k: number): number {
  if (relevantSet.size === 0) return 0;
  const top = new Set(rankedIds.slice(0, k));
  let hits = 0;
  for (const id of relevantSet) if (top.has(id)) hits++;
  return hits / relevantSet.size;
}

// ── Search fetchers ─────────────────────────────────────────────────────────────

async function fetchMode(query: string, mode: SearchMode, limit: number): Promise<string[]> {
  let url: string;

  switch (mode) {
    case 'baseline':
      url = `${SEARCH_BASE}/api/search?q=${encodeURIComponent(query)}&type=claims&limit=${limit}`;
      break;
    case 'tsvector':
      url = `${SEARCH_BASE}/api/search?q=${encodeURIComponent(query)}&type=claims&limit=${limit}&search_mode=tsvector`;
      break;
    case 'vector':
      url = `${SEARCH_BASE}/api/search?q=${encodeURIComponent(query)}&type=claims&limit=${limit}&search_mode=vector`;
      break;
    case 'hybrid':
      url = `${SEARCH_BASE}/api/search?q=${encodeURIComponent(query)}&type=claims&limit=${limit}&search_mode=hybrid`;
      break;
  }

  const res = await fetch(url);
  if (!res.ok) {
    process.stderr.write(`  WARN HTTP ${res.status} for mode=${mode} query=${query}\n`);
    return [];
  }
  const data = await res.json() as { claims: ClaimHit[] };
  return data.claims.map(c => c.id);
}

// ── Eval runner ────────────────────────────────────────────────────────────────

type CategoryStats = {
  ndcg10: number[];
  recall50: number[];
};

type ModeResults = {
  mode: SearchMode;
  overall: CategoryStats;
  navigational: CategoryStats;
  topical: CategoryStats;
  vocab_mismatch: CategoryStats;
  paraphrase: CategoryStats;
};

function emptyStats(): CategoryStats {
  return { ndcg10: [], recall50: [] };
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fmt(n: number): string {
  return (n * 100).toFixed(1).padStart(5) + '%';
}

async function evalMode(queries: EvalQuery[], mode: SearchMode): Promise<ModeResults> {
  const results: ModeResults = {
    mode,
    overall: emptyStats(),
    navigational: emptyStats(),
    topical: emptyStats(),
    vocab_mismatch: emptyStats(),
    paraphrase: emptyStats(),
  };

  let i = 0;
  for (const q of queries) {
    if (q.relevant_claim_ids.length === 0) {
      continue; // skip uncurated
    }
    i++;
    if (i % 10 === 1) process.stdout.write(`  [${mode}] processing query ${i}...\n`);

    const relevantSet = new Set(q.relevant_claim_ids);
    const ranked = await fetchMode(q.query, mode, 50);
    await new Promise(r => setTimeout(r, 100));

    const ndcg = nDCG(ranked, relevantSet, 10);
    const recall = recallAt(ranked, relevantSet, 50);

    results.overall.ndcg10.push(ndcg);
    results.overall.recall50.push(recall);

    const cat = q.category as keyof Omit<ModeResults, 'mode' | 'overall'>;
    if (results[cat]) {
      results[cat].ndcg10.push(ndcg);
      results[cat].recall50.push(recall);
    }
  }

  return results;
}

function printTable(allResults: ModeResults[]) {
  const modes = allResults.map(r => r.mode);
  const header = ['Metric', ...modes.map(m => m.padEnd(10))].join(' | ');
  const sep = '-'.repeat(header.length);

  console.log('\n' + sep);
  console.log('SEARCH EVAL RESULTS');
  console.log(sep);
  console.log(header);
  console.log(sep);

  const categories: Array<[string, keyof ModeResults]> = [
    ['Overall nDCG@10', 'overall'],
    ['Overall Recall@50', 'overall'],
    ['Navigational nDCG@10', 'navigational'],
    ['Navigational Recall@50', 'navigational'],
    ['Topical nDCG@10', 'topical'],
    ['Topical Recall@50', 'topical'],
    ['Vocab-Mismatch nDCG@10', 'vocab_mismatch'],
    ['Vocab-Mismatch Recall@50', 'vocab_mismatch'],
    ['Paraphrase nDCG@10', 'paraphrase'],
    ['Paraphrase Recall@50', 'paraphrase'],
  ];

  for (const [label, cat] of categories) {
    const isRecall = label.includes('Recall');
    const metric = isRecall ? 'recall50' : 'ndcg10';
    const row = [label.padEnd(28), ...allResults.map(r => {
      const stats = r[cat] as CategoryStats | undefined;
      if (!stats) return '  N/A    ';
      const v = mean(stats[metric]);
      return fmt(v);
    })].join(' | ');
    console.log(row);
  }

  console.log(sep);

  // Print query counts per category
  for (const mode of allResults) {
    console.log(`\n[${mode.mode}] query counts:`);
    for (const cat of ['overall', 'navigational', 'topical', 'vocab_mismatch', 'paraphrase'] as const) {
      const stats = mode[cat] as CategoryStats;
      console.log(`  ${cat}: n=${stats.ndcg10.length}`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find(a => a.startsWith('--mode='))?.slice(7)
    ?? args[args.indexOf('--mode') + 1]
    ?? 'all';

  const modesToRun: SearchMode[] = modeArg === 'all'
    ? ['baseline', 'tsvector', 'vector', 'hybrid']
    : [modeArg as SearchMode];

  const lines = fs.readFileSync(QUERIES_FILE, 'utf8').trim().split('\n');
  const queries: EvalQuery[] = lines.map(l => JSON.parse(l));

  const curated = queries.filter(q => q.relevant_claim_ids.length > 0);
  console.log(`Loaded ${queries.length} queries, ${curated.length} with curated IDs`);

  if (curated.length === 0) {
    console.error('No queries have relevant_claim_ids. Run bootstrap-claim-ids.ts first, then curate the IDs.');
    process.exit(1);
  }

  const allResults: ModeResults[] = [];

  for (const mode of modesToRun) {
    console.log(`\nEvaluating mode: ${mode}`);
    const result = await evalMode(queries, mode);
    allResults.push(result);
  }

  printTable(allResults);

  // Emit JSON for programmatic use
  const outPath = path.join(__dirname, 'eval-results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    ts: new Date().toISOString(),
    modes: allResults.map(r => ({
      mode: r.mode,
      overall_ndcg10: mean(r.overall.ndcg10),
      overall_recall50: mean(r.overall.recall50),
      navigational_ndcg10: mean(r.navigational.ndcg10),
      topical_ndcg10: mean(r.topical.ndcg10),
      vocab_mismatch_ndcg10: mean(r.vocab_mismatch.ndcg10),
      paraphrase_ndcg10: mean(r.paraphrase.ndcg10),
    })),
  }, null, 2));
  console.log(`\nResults written to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
