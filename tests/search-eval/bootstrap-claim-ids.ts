/**
 * Bootstrap script: populates relevant_claim_ids in queries.jsonl by calling
 * the /api/search endpoint and extracting the top claim IDs for each query.
 *
 * This produces candidates — a human must review and trim to truly-relevant IDs
 * before the eval numbers are meaningful.
 *
 * Usage: SEARCH_BASE=https://epistemicreceipts.com npx tsx tests/search-eval/bootstrap-claim-ids.ts
 *        SEARCH_BASE=http://localhost:3000 npx tsx tests/search-eval/bootstrap-claim-ids.ts
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

const SEARCH_BASE = process.env.SEARCH_BASE ?? 'http://localhost:3000';
const QUERIES_FILE = path.join(__dirname, 'queries.jsonl');
const TOP_K = 10; // candidates per query to surface for human review

type EvalQuery = {
  id: string;
  category: string;
  query: string;
  relevant_claim_ids: string[];
  notes?: string;
};

async function fetchTopClaims(query: string): Promise<string[]> {
  const url = `${SEARCH_BASE}/api/search?q=${encodeURIComponent(query)}&type=claims&limit=${TOP_K}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for query: ${query}`);
  const data = await res.json() as { claims: { id: string; text: string }[] };
  return data.claims.map(c => c.id);
}

async function main() {
  const lines = fs.readFileSync(QUERIES_FILE, 'utf8').trim().split('\n');
  const queries: EvalQuery[] = lines.map(l => JSON.parse(l));

  const updated: EvalQuery[] = [];
  let i = 0;

  for (const q of queries) {
    i++;
    process.stdout.write(`[${i}/${queries.length}] ${q.id} — ${q.query}\n`);
    if (q.relevant_claim_ids.length > 0) {
      process.stdout.write(`  Already has ${q.relevant_claim_ids.length} IDs, skipping\n`);
      updated.push(q);
      continue;
    }
    try {
      const ids = await fetchTopClaims(q.query);
      process.stdout.write(`  Found ${ids.length} candidate IDs\n`);
      // Store as candidates — prefix with "?" so humans know review is needed
      updated.push({ ...q, relevant_claim_ids: ids });
      await new Promise(r => setTimeout(r, 200)); // be kind to the API
    } catch (e) {
      process.stderr.write(`  ERROR: ${e}\n`);
      updated.push(q);
    }
  }

  const out = updated.map(q => JSON.stringify(q)).join('\n') + '\n';
  fs.writeFileSync(QUERIES_FILE, out);
  console.log(`\nBootstrap complete. Review ${QUERIES_FILE} — all populated IDs are candidates`);
  console.log('that need human curation before running the eval for real nDCG scores.');
}

main().catch(e => { console.error(e); process.exit(1); });
