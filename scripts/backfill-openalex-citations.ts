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
const OA_BATCH = 50;      // ids.openalex OR-filter cap
const UPDATE_BATCH = 1000;

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

  const updates: [string, string][] = []; // [externalId, jsonPatch]
  let fetched = 0, noRecord = 0;
  const fetchedAt = new Date().toISOString();

  for (let i = 0; i < workIds.length; i += OA_BATCH) {
    const batch = workIds.slice(i, i + OA_BATCH);
    const filter = `ids.openalex:${batch.map((w) => `https://openalex.org/${w}`).join("|")}`;
    const url = `${OA_BASE}?filter=${encodeURIComponent(filter)}&select=id,cited_by_count,counts_by_year&per-page=${OA_BATCH}&mailto=${MAILTO}`;
    let works: OAWork[] = [];
    try { works = await oaFetch(url); } catch (e) {
      console.error(`  batch ${i}: ${(e as Error).message}`);
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
      const patch = JSON.stringify({
        cited_by_count: w.cited_by_count ?? 0,
        citationsByYear: byYear,
        citationsFetchedAt: fetchedAt,
      });
      updates.push([ext, patch]);
      fetched++;
    }
    noRecord += batch.length - seen.size;
    if ((i / OA_BATCH) % 20 === 0 || i + OA_BATCH >= workIds.length)
      process.stdout.write(`\r  fetched ${fetched.toLocaleString()} · no OA record ${noRecord.toLocaleString()} · ${Math.min(i + OA_BATCH, workIds.length)}/${workIds.length}   `);

    // Fail fast: if the very first batch of 50 known-good work ids matches
    // NOTHING, the OpenAlex filter syntax is wrong — abort before burning
    // thousands of empty calls. (The URL couldn't be verified offline.)
    if (i === 0 && fetched === 0) {
      console.error(
        `\n  ABORT: first batch of ${batch.length} work ids returned 0 matches.\n` +
        `  The OpenAlex filter URL is likely wrong. Test one by hand:\n` +
        `    ${OA_BASE}?filter=${encodeURIComponent(filter)}&select=id,cited_by_count&mailto=${MAILTO}\n` +
        `  If that returns results, the filter key needs adjusting in this script.`,
      );
      process.exit(1);
    }
  }
  console.log();

  const top = [...updates]
    .map(([ext, p]) => [ext, (JSON.parse(p).cited_by_count as number) ?? 0] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  console.log(`  most-cited fetched: ${top.map(([, n]) => n.toLocaleString()).join(", ")}`);

  if (!EXECUTE) {
    console.log(`\nDRY RUN — would update ${updates.length.toLocaleString()} claims. Re-run with --execute.`);
    return;
  }

  let written = 0;
  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    const batch = updates.slice(i, i + UPDATE_BATCH);
    const values = batch.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2}::jsonb)`).join(", ");
    const params = batch.flat();
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "Claim" c
       SET metadata = COALESCE(c.metadata, '{}'::jsonb) || v.patch
       FROM (VALUES ${values}) AS v(ext, patch)
       WHERE c."externalId" = v.ext`,
      ...params,
    );
    written += Number(n);
    process.stdout.write(`\r  updated ${written.toLocaleString()}/${updates.length.toLocaleString()}   `);
  }
  console.log();

  const verify = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Claim" c
     WHERE c."ingestedBy" = $1 AND (c.metadata->>'cited_by_count') ~ '^\\d+$'`,
    INGESTED_BY,
  )) as { n: number }[];
  console.log(`  DB verification: ${verify[0].n.toLocaleString()} openalex claims now carry cited_by_count`);
  console.log(`\nDone. The promoter now prioritizes high-impact papers automatically.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
