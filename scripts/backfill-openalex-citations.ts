/**
 * backfill-openalex-citations.ts — briefing 06 Phase A (citation data).
 *
 * ingest-openalex.ts stored no citation count, so the promoter's
 * high-impact-first ordering has nothing to sort on (pick-promotable-claim.ts
 * falls back to date). This sweep fetches, for every openalex_v1 claim:
 *   metadata.cited_by_count   — lifetime citations (drives promoter priority)
 *   metadata.citationsByYear  — { "2019": 12, ... } per-year histogram
 *                               (briefing 06 Phase B quiet-reversal signal)
 *   metadata.citationsFetchedAt — ISO timestamp (resumability marker)
 *
 * Efficient: OpenAlex `ids.openalex` filter takes 50 works per request, so
 * ~313k claims ≈ 6,300 calls ≈ minutes at the polite-pool rate. Resumable —
 * skips claims already carrying a fresh citationsFetchedAt (unless --refresh).
 *
 * House rules: dry-run default; never guesses (claims OpenAlex has no record
 * for are left untouched and counted); metadata merged not clobbered; DB-
 * verified after; bind-parameterized UPDATE on the indexed externalId.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-openalex-citations.ts            # dry run
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-openalex-citations.ts --execute
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-openalex-citations.ts --execute --limit 5000
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-openalex-citations.ts --execute --refresh
 *
 * Then the promoter auto-prioritizes high-impact papers — no code change
 * (pick-promotable-claim.ts already ORDER BY cited_by_count DESC).
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXECUTE = process.argv.includes("--execute");
const REFRESH = process.argv.includes("--refresh");
function argNum(flag: string): number | null {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return null;
  const n = parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
const LIMIT = argNum("--limit");

const INGESTED_BY = "openalex_v1";
const OA_BASE = "https://api.openalex.org/works";
const MAILTO = "robert.contofalsky@gmail.com"; // same polite pool as the ingester
const OA_BATCH = 50;        // ids.openalex OR-filter cap
const UPDATE_BATCH = 1000;
const FLUSH_EVERY = 20;    // flush to DB every N fetch-batches (~1,000 claims)
const THROTTLE_MS = 120;   // gap between OpenAlex calls (polite-pool friendly)

interface OAWork {
  id?: string;
  cited_by_count?: number | null;
  counts_by_year?: { year: number; cited_by_count: number }[];
}

function extractWorkId(oaId: string | undefined): string | null {
  if (!oaId) return null;
  const m = oaId.match(/W\d+$/);
  return m ? m[0] : null;
}

async function oaFetch(url: string, retries = 5): Promise<OAWork[]> {
  let delay = 2000;
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": `epistemic-receipts (mailto:${MAILTO})` } });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
      continue;
    }
    if (!res.ok) throw new Error(`OpenAlex ${res.status} at ${url}`);
    const data = (await res.json()) as { results?: OAWork[] };
    return data.results ?? [];
  }
  throw new Error(`OpenAlex failed after ${retries} retries: ${url}`);
}

async function main(): Promise<void> {
  console.log(`backfill-openalex-citations — ${EXECUTE ? "EXECUTE" : "DRY RUN (pass --execute to write)"}${REFRESH ? " — refresh" : ""}`);

  // Claims needing citation data, carrying an openalex_id we can query.
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT c."externalId", c.metadata->>'openalex_id' AS work_id
     FROM "Claim" c
     WHERE c."ingestedBy" = $1 AND c.deleted = false
       AND c."externalId" IS NOT NULL
       AND (c.metadata->>'openalex_id') IS NOT NULL
       ${REFRESH ? "" : `AND (c.metadata->>'citationsFetchedAt') IS NULL`}
     ${LIMIT ? `LIMIT ${LIMIT}` : ""}`,
    INGESTED_BY,
  )) as { externalId: string; work_id: string }[];

  console.log(`  claims needing citation data: ${rows.length.toLocaleString()}`);
  if (rows.length === 0) { console.log("  nothing to do."); return; }

  // work id → externalId (a work maps to one claim here).
  const byWork = new Map<string, string>();
  for (const r of rows) {
    const w = extractWorkId(r.work_id) ?? r.work_id;
    if (w) byWork.set(w, r.externalId);
  }
  const workIds = [...byWork.keys()];

  // Flush accumulated [externalId, jsonPatch] pairs to the DB. Called every
  // FLUSH_EVERY batches so progress PERSISTS mid-run — the earlier
  // accumulate-then-write design lost everything on interrupt (fixed 2026-07-05).
  async function flush(pending: [string, string][]): Promise<number> {
    if (!EXECUTE || pending.length === 0) return 0;
    let w = 0;
    for (let j = 0; j < pending.length; j += UPDATE_BATCH) {
      const chunk = pending.slice(j, j + UPDATE_BATCH);
      const values = chunk.map((_, k) => `($${k * 2 + 1}, $${k * 2 + 2}::jsonb)`).join(", ");
      const n = await prisma.$executeRawUnsafe(
        `UPDATE "Claim" c
         SET metadata = COALESCE(c.metadata, '{}'::jsonb) || v.patch
         FROM (VALUES ${values}) AS v(ext, patch)
         WHERE c."externalId" = v.ext`,
        ...chunk.flat(),
      );
      w += Number(n);
    }
    return w;
  }

  let pending: [string, string][] = [];
  let fetched = 0, noRecord = 0, written = 0, maxCited = 0, failedBatches = 0;
  const fetchedAt = new Date().toISOString();

  for (let i = 0; i < workIds.length; i += OA_BATCH) {
    const batch = workIds.slice(i, i + OA_BATCH);
    const filter = `ids.openalex:${batch.map((w) => `https://openalex.org/${w}`).join("|")}`;
    const url = `${OA_BASE}?filter=${encodeURIComponent(filter)}&select=id,cited_by_count,counts_by_year&per-page=${OA_BATCH}&mailto=${MAILTO}`;
    let works: OAWork[] = [];
    try {
      works = await oaFetch(url);
    } catch (e) {
      // A failed batch is left un-fetched; a later --execute rerun retries it
      // (its claims still lack citationsFetchedAt). Don't lose the run over it.
      failedBatches++;
      if (failedBatches <= 3) console.error(`\n  batch @${i} failed (will retry on next run): ${(e as Error).message.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, 1500)); // back off, then continue
      continue;
    }
    const seen = new Set<string>();
    for (const w of works) {
      const wid = extractWorkId(w.id);
      if (!wid) continue;
      const ext = byWork.get(wid);
      if (!ext) continue;
      seen.add(wid);
      const byYear: Record<string, number> = {};
      for (const c of w.counts_by_year ?? []) byYear[String(c.year)] = c.cited_by_count;
      maxCited = Math.max(maxCited, w.cited_by_count ?? 0);
      pending.push([ext, JSON.stringify({
        cited_by_count: w.cited_by_count ?? 0,
        citationsByYear: byYear,
        citationsFetchedAt: fetchedAt,
      })]);
      fetched++;
    }
    noRecord += batch.length - seen.size;

    // Fail fast if the first successful batch matches nothing (wrong filter).
    if (i === 0 && works.length > 0 && fetched === 0) {
      console.error(`\n  ABORT: batch returned works but none matched our ids — filter/id mismatch.`);
      process.exit(1);
    }

    // Incremental flush — progress persists, resumability real.
    if ((i / OA_BATCH + 1) % FLUSH_EVERY === 0) {
      written += await flush(pending);
      pending = [];
    }
    if ((i / OA_BATCH) % 5 === 0 || i + OA_BATCH >= workIds.length)
      process.stdout.write(`\r  fetched ${fetched.toLocaleString()} · written ${written.toLocaleString()} · no-record ${noRecord.toLocaleString()} · failed ${failedBatches} · ${Math.min(i + OA_BATCH, workIds.length)}/${workIds.length}   `);

    await new Promise((r) => setTimeout(r, THROTTLE_MS)); // polite-pool throttle
  }
  written += await flush(pending);
  console.log();
  console.log(`  highest citation count fetched this run: ${maxCited.toLocaleString()}`);
  if (failedBatches > 0) console.log(`  ${failedBatches} batch(es) failed — rerun --execute to retry them (resumable).`);

  if (!EXECUTE) {
    console.log(`\nDRY RUN — would update ${fetched.toLocaleString()} claims. Re-run with --execute.`);
    return;
  }

  const verify = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Claim" c
     WHERE c."ingestedBy" = $1 AND (c.metadata->>'cited_by_count') ~ '^\\d+$'`,
    INGESTED_BY,
  )) as { n: number }[];
  console.log(`  DB verification: ${verify[0].n.toLocaleString()} openalex claims now carry cited_by_count`);
  console.log(`\nDone. The promoter now prioritizes high-impact papers automatically.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
