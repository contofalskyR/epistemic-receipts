/**
 * backfill-retraction-pub-dates.ts — writes the original publication date into
 * Claim.metadata.originalPublished for crossref_retractions_v1 claims.
 *
 * Why: ingest-retractions.ts fetched CrossRef's `published` field but never
 * stored it, so wave 2 of bulk-promote-corpus.ts has no date to prepend the
 * RECORDED(publication) row from. Verified against the live CrossRef API
 * (2026-07-03): the works returned by filter=has-update:true,update-type:retraction
 * ARE the original papers (titles prefixed "RETRACTED:", update-to self-refers),
 * so work.DOI == Claim.metadata.doi and work.published is the ORIGINAL
 * publication date. One cursor sweep (~27k works, ~140 pages) rebuilds the map.
 *
 * Writes (with --execute): metadata.originalPublished = "YYYY-MM-DD" | "YYYY-MM"
 * | "YYYY" (whatever precision CrossRef has), merged into existing metadata via
 * `||`. Claims that already have the key are skipped unless --refresh.
 * Matching is on the indexed unique externalId (same derivation as the
 * ingester: `crossref_retraction_${doi.replace(/[^a-z0-9]/g, "_")}`).
 *
 * House rules: dry-run by default; bind-parameterized SQL only; never guesses
 * a date (works without `published` date-parts are skipped and counted);
 * results verified against DB state after writing.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-retraction-pub-dates.ts            # dry run
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-retraction-pub-dates.ts --execute
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-retraction-pub-dates.ts --execute --refresh
 *
 * Then: wave 2 with --pub-date-key originalPublished (see CORPUS-PROMOTER-BULK-PLAN.md §4).
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Lazy so importing this module (e.g. from tests) never needs a DB.
let _prisma: PrismaClient | null = null;
const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    _prisma ??= new PrismaClient();
    return (_prisma as unknown as Record<string | symbol, unknown>)[prop];
  },
});

const EXECUTE = process.argv.includes("--execute");
const REFRESH = process.argv.includes("--refresh");

const INGESTED_BY = "crossref_retractions_v1";
const CROSSREF_BASE = "https://api.crossref.org";
const POLITE_EMAIL = "robert.contofalsky@gmail.com"; // same polite pool as the ingester
const PAGE_SIZE = 500;
const UPDATE_BATCH = 2000; // externalIds per UPDATE statement

interface CrossRefWork {
  DOI?: string;
  published?: { "date-parts"?: number[][] };
}
interface CrossRefResponse {
  message: { items?: CrossRefWork[]; "next-cursor"?: string; "total-results"?: number };
}

async function crossrefFetch(url: string, retries = 5): Promise<CrossRefResponse> {
  let delay = 2000;
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": `epistemic-receipts (mailto:${POLITE_EMAIL})` } });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
      continue;
    }
    if (!res.ok) throw new Error(`CrossRef API ${res.status} at ${url}`);
    return (await res.json()) as CrossRefResponse;
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

/** CrossRef date-parts → "YYYY" | "YYYY-MM" | "YYYY-MM-DD", or null. Never guesses. */
export function formatDateParts(published: CrossRefWork["published"]): string | null {
  const parts = published?.["date-parts"]?.[0];
  if (!parts || !parts.length) return null;
  const [y, m, d] = parts;
  if (!y || y < 1600 || y > 2100) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (m && m >= 1 && m <= 12) {
    if (d && d >= 1 && d <= 31) return `${y}-${pad(m)}-${pad(d)}`;
    return `${y}-${pad(m)}`;
  }
  return `${y}`;
}

/** Same externalId derivation as ingest-retractions.ts. */
export function externalIdForDoi(doi: string): string {
  return `crossref_retraction_${doi.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

async function sweepCrossref(): Promise<Map<string, string>> {
  const map = new Map<string, string>(); // externalId → originalPublished
  let cursor = "*";
  let fetched = 0;
  let noDate = 0;
  for (;;) {
    const url = `${CROSSREF_BASE}/works?filter=has-update:true,update-type:retraction&rows=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}&select=DOI,published&mailto=${POLITE_EMAIL}`;
    const data = await crossrefFetch(url);
    const items = data.message.items ?? [];
    for (const w of items) {
      if (!w.DOI) continue;
      const pub = formatDateParts(w.published);
      if (!pub) { noDate++; continue; }
      map.set(externalIdForDoi(w.DOI), pub);
    }
    fetched += items.length;
    const total = data.message["total-results"];
    process.stdout.write(`\r  CrossRef sweep: ${fetched}/${total ?? "?"} works (${map.size} with dates, ${noDate} without)   `);
    if (items.length < PAGE_SIZE) break;
    const next = data.message["next-cursor"];
    if (!next) break;
    cursor = next;
  }
  console.log();
  return map;
}

async function main(): Promise<void> {
  console.log(`backfill-retraction-pub-dates — ${EXECUTE ? "EXECUTE" : "DRY RUN (pass --execute to write)"}${REFRESH ? " — refresh existing keys" : ""}`);

  // 1. Which claims need the key?
  const needing = (await prisma.$queryRawUnsafe(
    `SELECT c."externalId" FROM "Claim" c
     WHERE c."ingestedBy" = $1 AND c.deleted = false
       AND c."externalId" IS NOT NULL
       ${REFRESH ? "" : `AND (c.metadata->>'originalPublished') IS NULL`}`,
    INGESTED_BY,
  )) as { externalId: string }[];
  console.log(`  claims needing originalPublished: ${needing.length}`);
  if (needing.length === 0) {
    console.log("  nothing to do.");
    return;
  }

  // 2. Rebuild doi→published map from CrossRef.
  const map = await sweepCrossref();

  // 3. Intersect.
  const pairs: [string, string][] = [];
  let unmatched = 0;
  for (const { externalId } of needing) {
    const pub = map.get(externalId);
    if (pub) pairs.push([externalId, pub]);
    else unmatched++;
  }
  console.log(`  matched with a CrossRef date: ${pairs.length}`);
  console.log(`  unmatched / dateless:         ${unmatched}  (left untouched — never guess)`);
  for (const [ext, pub] of pairs.slice(0, 3)) console.log(`    e.g. ${ext} → ${pub}`);

  if (!EXECUTE) {
    console.log("\nDRY RUN — no writes. Re-run with --execute to apply.");
    return;
  }

  // 4. Batched UPDATE ... FROM (VALUES ...) on the indexed unique externalId.
  let written = 0;
  for (let i = 0; i < pairs.length; i += UPDATE_BATCH) {
    const batch = pairs.slice(i, i + UPDATE_BATCH);
    const values = batch.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(", ");
    const params = batch.flat();
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "Claim" c
       SET metadata = COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object('originalPublished', v.pub)
       FROM (VALUES ${values}) AS v(ext, pub)
       WHERE c."externalId" = v.ext`,
      ...params,
    );
    written += Number(n);
    process.stdout.write(`\r  updated ${written}/${pairs.length}   `);
  }
  console.log();

  // 5. Verify against DB state (house rule).
  const verify = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Claim" c
     WHERE c."ingestedBy" = $1 AND c.deleted = false
       AND (c.metadata->>'originalPublished') IS NOT NULL`,
    INGESTED_BY,
  )) as { n: number }[];
  console.log(`  DB verification: ${verify[0].n} claims now carry metadata.originalPublished`);
  console.log(`\nNext: npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --wave 2 --pub-date-key originalPublished`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => _prisma?.$disconnect());
}
