/**
 * Backfill claimEmergedAt for chebi_v1 claims using PubMed citation dates.
 *
 * Strategy:
 *   1. Load ChEBI flat file (database_accession.tsv.gz) → compound_id → [PMIDs]
 *   2. Batch-fetch PubMed publication dates for all unique PMIDs (200/req)
 *   3. For each compound, pick the earliest PubMed date → claimEmergedAt
 *   4. Then run auto-trajectories for chebi_v1 (handled externally)
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-chebi-dates.ts [--dry-run] [--limit N]
 *
 * Prereq: /tmp/chebi-accessions.tsv.gz must exist (download it once with:
 *   curl -s https://ftp.ebi.ac.uk/pub/databases/chebi/flat_files/database_accession.tsv.gz -o /tmp/chebi-accessions.tsv.gz
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as readline from "readline";
import * as zlib from "zlib";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i !== -1 ? parseInt(process.argv[i + 1]) : Infinity;
})();

const ACCESSION_FILE = "/tmp/chebi-accessions.tsv.gz";
const PUBMED_SOURCE_ID = "69";
const PUBMED_BATCH = 200;

async function readLines(file: string): Promise<AsyncIterable<string>> {
  const stream = fs.createReadStream(file).pipe(zlib.createGunzip());
  return readline.createInterface({ input: stream });
}

async function buildCompoundPubmedMap(
  ourCompoundIds: Set<string>
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const lines = await readLines(ACCESSION_FILE);
  let skippedHeader = false;

  for await (const line of lines) {
    if (!skippedHeader) { skippedHeader = true; continue; }
    const cols = line.split("\t");
    if (cols.length < 6) continue;
    const compoundId = cols[1];
    const accession = cols[2];
    const sourceId = cols[5].trim();
    if (sourceId !== PUBMED_SOURCE_ID) continue;
    if (!ourCompoundIds.has(compoundId)) continue;
    if (!map.has(compoundId)) map.set(compoundId, []);
    map.get(compoundId)!.push(accession);
  }

  return map;
}

async function fetchPubmedDates(pmids: string[]): Promise<Map<string, Date>> {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json&tool=epistemic-receipts&email=contact@epistemicreceipts.com`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed API error: ${res.status}`);

  const data = await res.json() as {
    result: Record<string, { pubdate?: string; sortpubdate?: string } | string[]>;
  };

  const map = new Map<string, Date>();
  for (const pmid of pmids) {
    const entry = data.result[pmid];
    if (!entry || Array.isArray(entry)) continue;
    const rawDate = entry.sortpubdate || entry.pubdate;
    if (!rawDate) continue;
    // sortpubdate format: "2021/03/15 00:00"
    // pubdate format: "2021 Mar 15" or "2021 Mar" or "2021"
    const cleaned = rawDate.split(" ")[0].replace(/\//g, "-");
    const parts = cleaned.split("-");
    if (!parts[0] || isNaN(parseInt(parts[0]))) continue;
    const y = parseInt(parts[0]);
    const m = parts[1] ? parseInt(parts[1]) : 1;
    const d = parts[2] ? parseInt(parts[2]) : 1;
    const date = new Date(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    if (!isNaN(date.getTime())) map.set(pmid, date);
  }
  return map;
}

async function main() {
  if (!fs.existsSync(ACCESSION_FILE)) {
    console.error(`Missing ${ACCESSION_FILE} — download it first:`);
    console.error(`  curl -s https://ftp.ebi.ac.uk/pub/databases/chebi/flat_files/database_accession.tsv.gz -o /tmp/chebi-accessions.tsv.gz`);
    process.exit(1);
  }

  // Load our ChEBI claims from DB
  console.log("Loading chebi_v1 claims from DB...");
  const claims = await prisma.claim.findMany({
    where: { ingestedBy: "chebi_v1", deleted: false, claimEmergedAt: null },
    select: { id: true, metadata: true },
    orderBy: { id: "asc" },
    take: LIMIT === Infinity ? undefined : LIMIT,
  });
  console.log(`  Found ${claims.length} undated chebi_v1 claims`);

  // Build compound_id → claim_id map
  const compoundToClaim = new Map<string, string>();
  const ourCompoundIds = new Set<string>();
  for (const c of claims) {
    const meta = c.metadata as Record<string, unknown> | null;
    const chebiId = meta?.chebiId;
    if (chebiId == null) continue;
    const compoundId = String(chebiId);
    ourCompoundIds.add(compoundId);
    compoundToClaim.set(compoundId, c.id);
  }
  console.log(`  ${ourCompoundIds.size} unique compound IDs`);

  // Build compound_id → [PMIDs] map from flat file
  console.log("Reading ChEBI accession flat file...");
  const compoundPmids = await buildCompoundPubmedMap(ourCompoundIds);
  console.log(`  ${compoundPmids.size} compounds have PubMed citations`);

  // Collect all unique PMIDs
  const allPmids = new Set<string>();
  for (const pmids of compoundPmids.values()) for (const p of pmids) allPmids.add(p);
  const pmidList = Array.from(allPmids);
  console.log(`  ${pmidList.length} unique PMIDs to fetch dates for`);

  // Batch fetch PubMed dates
  console.log("Fetching PubMed publication dates...");
  const pmidDates = new Map<string, Date>();
  for (let i = 0; i < pmidList.length; i += PUBMED_BATCH) {
    const batch = pmidList.slice(i, i + PUBMED_BATCH);
    try {
      const dates = await fetchPubmedDates(batch);
      for (const [pmid, date] of dates) pmidDates.set(pmid, date);
      process.stdout.write(`  Batch ${Math.floor(i/PUBMED_BATCH)+1}/${Math.ceil(pmidList.length/PUBMED_BATCH)}: ${pmidDates.size} dates collected\r`);
      await new Promise(r => setTimeout(r, 340)); // ~3 req/sec (NCBI limit without key)
    } catch (e) {
      console.error(`\n  Batch ${i/PUBMED_BATCH} error: ${(e as Error).message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log(`\n  Fetched dates for ${pmidDates.size} PMIDs`);

  // Compute earliest date per compound
  const compoundEarliestDate = new Map<string, Date>();
  for (const [compoundId, pmids] of compoundPmids) {
    let earliest: Date | null = null;
    for (const pmid of pmids) {
      const d = pmidDates.get(pmid);
      if (d && (!earliest || d < earliest)) earliest = d;
    }
    if (earliest) compoundEarliestDate.set(compoundId, earliest);
  }
  console.log(`  ${compoundEarliestDate.size} compounds have a datable earliest citation`);

  // Update DB
  let updated = 0;
  let notFound = 0;
  const updates: Array<{ id: string; date: Date }> = [];

  for (const [compoundId, date] of compoundEarliestDate) {
    const claimId = compoundToClaim.get(compoundId);
    if (!claimId) { notFound++; continue; }
    updates.push({ id: claimId, date });
  }

  console.log(`Updating ${updates.length} claims...`);
  if (!DRY_RUN) {
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await Promise.all(
        batch.map(({ id, date }) =>
          prisma.claim.update({
            where: { id },
            data: { claimEmergedAt: date, claimEmergedPrecision: "DAY" },
          })
        )
      );
      process.stdout.write(`  ${Math.min(i + 500, updates.length)}/${updates.length} updated\r`);
    }
    console.log(`\nDone. Updated: ${updated + updates.length} | No citation date: ${notFound + (claims.length - compoundToClaim.size)}`);
  } else {
    console.log(`(dry-run) Would update ${updates.length} claims`);
    if (updates.length > 0) {
      const sample = updates[0];
      console.log(`  Sample: claim ${sample.id} → ${sample.date.toISOString()}`);
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
