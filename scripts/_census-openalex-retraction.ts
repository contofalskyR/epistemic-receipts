/**
 * _census-openalex-retraction.ts — READ-ONLY census, Phase A.1 (briefing 13).
 *
 * Where do DOIs live on each side of the openalex_v1 <-> crossref_retractions_v1
 * join; overlap count; collision count; per-side coverage %; a look at whether
 * matched openalex claims already carry conflicting ClaimStatusHistory. No writes.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/_census-openalex-retraction.ts --direct
 */
import "dotenv/config";

// --direct must take effect before the client is constructed (house convention
// from audit-chain-integrity.ts): full scans need DIRECT_URL, the Neon pooler
// kills them (P1017).
if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function normalizeDoiSql(col: string) {
  return `lower(CASE WHEN ${col}->>'doi' LIKE 'https://doi.org/%' THEN substring(${col}->>'doi' FROM length('https://doi.org/')+1) ELSE ${col}->>'doi' END)`;
}

async function main() {
  const [openalexTotal] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM "Claim" WHERE "ingestedBy" = 'openalex_v1' AND deleted = false`,
  );
  const [openalexWithDoi] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM "Claim" WHERE "ingestedBy" = 'openalex_v1' AND deleted = false AND metadata->>'doi' IS NOT NULL AND metadata->>'doi' != ''`,
  );
  const [retractionTotal] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM "Claim" WHERE "ingestedBy" = 'crossref_retractions_v1' AND deleted = false`,
  );
  const [retractionWithDoi] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM "Claim" WHERE "ingestedBy" = 'crossref_retractions_v1' AND deleted = false AND metadata->>'doi' IS NOT NULL AND metadata->>'doi' != ''`,
  );

  console.log("=== Side counts ===");
  console.log(
    `openalex_v1: ${openalexTotal.n} total, ${openalexWithDoi.n} with metadata.doi (${(Number(openalexWithDoi.n) / Number(openalexTotal.n) * 100).toFixed(1)}%)`,
  );
  console.log(
    `crossref_retractions_v1: ${retractionTotal.n} total, ${retractionWithDoi.n} with metadata.doi (${(Number(retractionWithDoi.n) / Number(retractionTotal.n) * 100).toFixed(1)}%)`,
  );

  const retractionRows = await prisma.$queryRawUnsafe<Array<{ id: string; doi: string }>>(
    `SELECT id, ${normalizeDoiSql("metadata")} AS doi FROM "Claim" WHERE "ingestedBy" = 'crossref_retractions_v1' AND deleted = false AND metadata->>'doi' IS NOT NULL AND metadata->>'doi' != ''`,
  );
  const openalexRows = await prisma.$queryRawUnsafe<Array<{ id: string; doi: string }>>(
    `SELECT id, ${normalizeDoiSql("metadata")} AS doi FROM "Claim" WHERE "ingestedBy" = 'openalex_v1' AND deleted = false AND metadata->>'doi' IS NOT NULL AND metadata->>'doi' != ''`,
  );

  const retractionDoiCounts = new Map<string, number>();
  for (const r of retractionRows) retractionDoiCounts.set(r.doi, (retractionDoiCounts.get(r.doi) ?? 0) + 1);
  const retractionCollisions = [...retractionDoiCounts.values()].filter((c) => c > 1).length;

  const openalexDoiCounts = new Map<string, number>();
  for (const r of openalexRows) openalexDoiCounts.set(r.doi, (openalexDoiCounts.get(r.doi) ?? 0) + 1);
  const openalexCollisions = [...openalexDoiCounts.values()].filter((c) => c > 1).length;

  const retractionByDoi = new Map<string, string>();
  for (const r of retractionRows) if (!retractionByDoi.has(r.doi)) retractionByDoi.set(r.doi, r.id);

  const matches: Array<{ openalexId: string; retractionId: string; doi: string }> = [];
  for (const r of openalexRows) {
    const retId = retractionByDoi.get(r.doi);
    if (retId) matches.push({ openalexId: r.id, retractionId: retId, doi: r.doi });
  }

  console.log("\n=== Overlap ===");
  console.log(`Distinct DOIs (openalex side): ${openalexDoiCounts.size} (${openalexCollisions} DOIs appear >1x on openalex side)`);
  console.log(`Distinct DOIs (retraction side): ${retractionDoiCounts.size} (${retractionCollisions} DOIs appear >1x on retraction side)`);
  console.log(`Matched pairs (openalex claim x retraction claim, DOI join): ${matches.length}`);
  console.log(`Distinct matched DOIs: ${new Set(matches.map((m) => m.doi)).size}`);

  console.log("\n=== 5 sample matches ===");
  for (const m of matches.slice(0, 5)) console.log(`  ${m.doi}  openalex=${m.openalexId}  retraction=${m.retractionId}`);

  const [existingReversed] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM "ClaimRelation" WHERE "relationType" = 'REVERSED'`,
  );
  console.log(`\nExisting ClaimRelation REVERSED rows (prior link-retractions-crossref.ts run): ${existingReversed.n}`);

  if (matches.length > 0) {
    const matchedIds = matches.map((m) => m.openalexId);
    const historyCounts = await prisma.$queryRawUnsafe<Array<{ claimid: string; n: bigint }>>(
      `SELECT "claimId" AS claimid, count(*)::bigint AS n FROM "ClaimStatusHistory" WHERE "claimId" = ANY($1::text[]) GROUP BY "claimId"`,
      matchedIds,
    );
    const withHistory = historyCounts.filter((h) => Number(h.n) > 0).length;
    const withMultiRow = historyCounts.filter((h) => Number(h.n) > 1).length;
    console.log(`Matched openalex claims with ANY existing ClaimStatusHistory row: ${withHistory} / ${matchedIds.length}`);
    console.log(`Matched openalex claims with >1 existing ClaimStatusHistory row (already curved / conflicting?): ${withMultiRow}`);

    // Sample 5 matched claims' full status history + claimEmergedAt for both
    // sides — feeds the CHECKPOINT 3 axis-semantics memo (never guess from
    // training-data recall of what crossref rows "usually" look like).
    const sampleMatches = matches.slice(0, 5);
    const sampleIds = sampleMatches.map((m) => m.openalexId);
    const sampleHistory = await prisma.$queryRawUnsafe<
      Array<{ claimId: string; fromAxis: string | null; toAxis: string; occurredAt: Date; datePrecision: string; community: string }>
    >(
      `SELECT "claimId", "fromAxis", "toAxis", "occurredAt", "datePrecision", "community" FROM "ClaimStatusHistory" WHERE "claimId" = ANY($1::text[]) ORDER BY "claimId", "occurredAt"`,
      sampleIds,
    );
    console.log("\n=== Sample matched claims' existing status history ===");
    for (const row of sampleHistory) {
      console.log(`  ${row.claimId}: ${row.fromAxis ?? "∅"} -> ${row.toAxis} @ ${row.occurredAt.toISOString().slice(0, 10)} (${row.datePrecision}, ${row.community})`);
    }

    const allIds = [...sampleIds, ...sampleMatches.map((m) => m.retractionId)];
    const emergedRows = await prisma.$queryRawUnsafe<Array<{ id: string; claimEmergedAt: Date | null }>>(
      `SELECT id, "claimEmergedAt" FROM "Claim" WHERE id = ANY($1::text[])`,
      allIds,
    );
    console.log("\n=== claimEmergedAt for sample matches (openalex + retraction) ===");
    for (const row of emergedRows) console.log(`  ${row.id}: ${row.claimEmergedAt ? row.claimEmergedAt.toISOString().slice(0, 10) : "null"}`);

    // Retraction claim TEXT for the sample (need this for the axis-semantics
    // memo: does the retraction claim's own text/date shape tell us whether
    // this should read as SETTLED->REVERSED or RECORDED->REVERSED?).
    const retractionTextRows = await prisma.$queryRawUnsafe<Array<{ id: string; text: string; metadata: unknown }>>(
      `SELECT id, text, metadata FROM "Claim" WHERE id = ANY($1::text[])`,
      sampleMatches.map((m) => m.retractionId),
    );
    console.log("\n=== Sample retraction claim text + metadata ===");
    for (const row of retractionTextRows) {
      console.log(`  ${row.id}: "${row.text}"`);
      console.log(`    metadata: ${JSON.stringify(row.metadata)}`);
    }

    // ── Full-population terminal-axis breakdown (not just the 5-sample) ──────
    // Needed for the CHECKPOINT 3 axis-semantics memo: of ALL 11k+ matches,
    // how many are already terminal=REVERSED (and does that REVERSED date
    // match the crossref retraction date — safe/idempotent — or differ —
    // a real conflict the new pipeline must skip+count, never overwrite)?
    console.log("\n=== Full-population terminal-axis breakdown (all matches) ===");
    const terminalRows = await prisma.$queryRawUnsafe<
      Array<{ claimid: string; toaxis: string; occurredat: Date }>
    >(
      `SELECT DISTINCT ON ("claimId") "claimId" AS claimid, "toAxis" AS toaxis, "occurredAt" AS occurredat
       FROM "ClaimStatusHistory"
       WHERE "claimId" = ANY($1::text[])
       ORDER BY "claimId", "seq" DESC NULLS LAST, "occurredAt" DESC`,
      matchedIds,
    );
    const terminalCounts = new Map<string, number>();
    for (const r of terminalRows) terminalCounts.set(r.toaxis, (terminalCounts.get(r.toaxis) ?? 0) + 1);
    for (const [axis, n] of [...terminalCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  terminal=${axis}: ${n}`);
    }

    // Among terminal=REVERSED claims, compare their occurredAt to the retraction
    // claim's own claimEmergedAt (the retraction date, per ingest-retractions.ts).
    // Pair via UNNEST (parallel arrays) so this is one query, not N.
    const reversedSet = new Set(terminalRows.filter((r) => r.toaxis === "REVERSED").map((r) => r.claimid));
    const reversedPairs = matches.filter((m) => reversedSet.has(m.openalexId));
    if (reversedPairs.length > 0) {
      const reversedOccurredAt = new Map(terminalRows.filter((r) => r.toaxis === "REVERSED").map((r) => [r.claimid, r.occurredat]));
      const pairRows = await prisma.$queryRawUnsafe<Array<{ openalexid: string; retractiondate: Date | null }>>(
        `SELECT p.openalexid, c."claimEmergedAt" AS retractiondate
         FROM UNNEST($1::text[], $2::text[]) AS p(openalexid, retractionid)
         JOIN "Claim" c ON c.id = p.retractionid`,
        reversedPairs.map((p) => p.openalexId),
        reversedPairs.map((p) => p.retractionId),
      );
      let dateMatch = 0, dateConflict = 0, noDate = 0;
      for (const row of pairRows) {
        const existingReversedAt = reversedOccurredAt.get(row.openalexid);
        if (!row.retractiondate || !existingReversedAt) { noDate++; continue; }
        if (row.retractiondate.getTime() === existingReversedAt.getTime()) dateMatch++; else dateConflict++;
      }
      console.log(`\n  Of ${reversedPairs.length} already-REVERSED matches: ${dateMatch} date-match the crossref retraction date (idempotent/safe), ${dateConflict} differ (real conflict — skip+count), ${noDate} unresolvable`);
    }

    // ── updateType breakdown on the REAL target population (terminal=RECORDED) ──
    // ingest-retractions.ts's claimText branches "retracted"/"withdrawn"; the
    // CrossRef filter is has-update:true,update-type:retraction but metadata.updateType
    // may still read Retraction/Withdrawal/Correction depending on publisher tagging.
    // A "Correction" is not a REVERSED-grade event — need the real distribution
    // before deciding whether toAxis is uniformly REVERSED or type-dependent.
    const recordedIds = terminalRows.filter((r) => r.toaxis === "RECORDED").map((r) => r.claimid);
    const recordedMatches = matches.filter((m) => recordedIds.includes(m.openalexId));
    if (recordedMatches.length > 0) {
      const retractionIdsForRecorded = recordedMatches.map((m) => m.retractionId);
      const updateTypeRows = await prisma.$queryRawUnsafe<Array<{ updatetype: string | null; n: bigint }>>(
        `SELECT metadata->>'updateType' AS updatetype, count(*)::bigint AS n
         FROM "Claim" WHERE id = ANY($1::text[]) GROUP BY metadata->>'updateType' ORDER BY n DESC`,
        retractionIdsForRecorded,
      );
      console.log(`\n=== updateType breakdown, target population (terminal=RECORDED, n=${recordedMatches.length}) ===`);
      for (const row of updateTypeRows) console.log(`  ${row.updatetype ?? "(null)"}: ${row.n}`);

      // Random-ish sample from the far end (avoids re-showing the same
      // materials-science-cluster rows the earlier physical-order sample hit).
      const tailSample = recordedMatches.slice(-5);
      const tailRows = await prisma.$queryRawUnsafe<Array<{ id: string; text: string; metadata: unknown }>>(
        `SELECT id, text, metadata FROM "Claim" WHERE id = ANY($1::text[])`,
        tailSample.map((m) => m.retractionId),
      );
      console.log(`\n=== Tail sample (5 more, different cluster) — retraction claim text + metadata ===`);
      for (const row of tailRows) {
        console.log(`  ${row.id}: "${row.text}"`);
        console.log(`    metadata: ${JSON.stringify(row.metadata)}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
