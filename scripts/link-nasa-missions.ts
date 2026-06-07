/**
 * link-nasa-missions.ts
 *
 * Builds DISCOVERED_BY ClaimRelation rows from NASA exoplanet claims
 * (nasa_exoplanet_v1) to the space-mission claims (space_missions_v1) that
 * physically discovered them.
 *
 * Exoplanet claim text format is:
 *   "Exoplanet X was confirmed in YYYY via <method>, orbiting host star Y,
 *    discovered by <facility/mission>."
 *
 * Only space-based observatories whose payload we ingested in space_missions_v1
 * map cleanly to a mission claim — ground observatories ("La Silla", "Keck",
 * "SuperWASP", "OGLE", "HATNet") have no corresponding orbital-launch record
 * and are skipped. Multi-facility values are also skipped.
 *
 * Discovery facility → space-mission payloadName matcher is a small explicit
 * whitelist; this is curation, not algorithmic. Each entry below was verified
 * against the actual payloadName values present in space_missions_v1.
 *
 * Confidence: high (exact mission name match, hand-curated whitelist).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-nasa-missions.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-nasa-missions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

const RELATION_TYPE = "DISCOVERED_BY";
const INSERT_BATCH = 1000;

// Each entry: array of `payloadName` substrings (case-insensitive) that
// identify the corresponding space mission. K2 is the extended Kepler mission
// using the same spacecraft.
const DISCOVERER_TO_MISSION_KEYWORDS: Record<string, string[]> = {
  "Kepler": ["Kepler"],
  "K2": ["Kepler"],
  "Transiting Exoplanet Survey Satellite (TESS)": ["TESS"],
  "TESS": ["TESS"],
  "CoRoT": ["COROT"],
  "European Space Agency (ESA) Gaia Satellite": ["Gaia"],
  "Gaia": ["Gaia"],
  "CHEOPS": ["CHEOPS"],
  "JWST": ["JWST"],
  "James Webb Space Telescope (JWST)": ["JWST"],
  "James Webb Space Telescope": ["JWST"],
};

const DISCOVERED_BY_RE = /discovered by\s+(.+?)\.\s*$/;

async function main() {
  console.log(`\nlink-nasa-missions.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // 1. Build mission keyword → claim ids index from space_missions_v1
  const missionRows = await prisma.claim.findMany({
    where: { ingestedBy: "space_missions_v1", deleted: false },
    select: { id: true, externalId: true, metadata: true },
  });
  console.log(`  Loaded ${missionRows.length} space mission claims`);

  // For each discoverer alias, resolve mission claim ids matching ALL its keywords
  const discovererToMissionClaimIds = new Map<string, Set<string>>();
  for (const [discoverer, keywords] of Object.entries(
    DISCOVERER_TO_MISSION_KEYWORDS,
  )) {
    const ids = new Set<string>();
    for (const m of missionRows) {
      const md = m.metadata as Record<string, unknown> | null;
      const payload =
        typeof md?.payloadName === "string" ? (md.payloadName as string) : "";
      if (!payload) continue;
      const lower = payload.toLowerCase();
      if (keywords.some((k) => lower.includes(k.toLowerCase()))) {
        ids.add(m.id);
      }
    }
    discovererToMissionClaimIds.set(discoverer, ids);
  }

  // Report coverage
  for (const [d, ids] of discovererToMissionClaimIds.entries()) {
    if (ids.size === 0) {
      console.log(`  WARNING: discoverer "${d}" matched 0 space missions`);
    }
  }

  // 2. Load exoplanet claims and parse the discoverer
  const exoRows = await prisma.claim.findMany({
    where: { ingestedBy: "nasa_exoplanet_v1", deleted: false },
    select: { id: true, externalId: true, text: true },
  });
  console.log(`  Loaded ${exoRows.length} exoplanet claims`);

  // Idempotency
  const existing = await prisma.claimRelation.findMany({
    where: { relationType: RELATION_TYPE },
    select: { fromClaimId: true, toClaimId: true },
  });
  const existingPairs = new Set<string>();
  for (const e of existing) existingPairs.add(`${e.fromClaimId}|${e.toClaimId}`);
  console.log(`  ${existing.length} existing ${RELATION_TYPE} relations`);

  type Candidate = {
    exoId: string;
    missionId: string;
    discoverer: string;
  };
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  let exoMatched = 0;
  let exoUnparsed = 0;
  let exoNoMission = 0;
  const unknownDiscovererCounts = new Map<string, number>();

  for (const e of exoRows) {
    const m = e.text.match(DISCOVERED_BY_RE);
    if (!m) {
      exoUnparsed++;
      continue;
    }
    const discoverer = m[1].trim();
    const missionIds = discovererToMissionClaimIds.get(discoverer);
    if (!missionIds || missionIds.size === 0) {
      exoNoMission++;
      unknownDiscovererCounts.set(
        discoverer,
        (unknownDiscovererCounts.get(discoverer) ?? 0) + 1,
      );
      continue;
    }
    exoMatched++;
    for (const mid of missionIds) {
      const key = `${e.id}|${mid}`;
      if (seen.has(key) || existingPairs.has(key)) continue;
      seen.add(key);
      candidates.push({ exoId: e.id, missionId: mid, discoverer });
    }
  }

  console.log(
    `  Exoplanets parsed: ${exoRows.length - exoUnparsed}` +
      ` · matched to mission: ${exoMatched}` +
      ` · no mission for discoverer: ${exoNoMission}` +
      ` · unparseable text: ${exoUnparsed}`,
  );
  const topUnknown = [...unknownDiscovererCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (topUnknown.length) {
    console.log(`  Top unmapped discoverers (skipped, ground-based or unmapped):`);
    for (const [d, c] of topUnknown) {
      console.log(`    ${c}× ${d}`);
    }
  }
  console.log(`  Candidate ${RELATION_TYPE} pairs (new): ${candidates.length}`);

  let inserted = 0;
  if (DRY_RUN) {
    inserted = candidates.length;
  } else {
    for (let i = 0; i < candidates.length; i += INSERT_BATCH) {
      const batch = candidates.slice(i, i + INSERT_BATCH);
      const data = batch.map((c) => ({
        fromClaimId: c.exoId,
        toClaimId: c.missionId,
        relationType: RELATION_TYPE,
        followUpContext: {
          heuristic: "discoverer_to_mission_payload_match",
          confidence: "high",
          discovererText: c.discoverer,
          pipeline_from: "nasa_exoplanet_v1",
          pipeline_to: "space_missions_v1",
        },
      }));
      const result = await prisma.claimRelation.createMany({
        data,
        skipDuplicates: true,
      });
      inserted += result.count;
    }
  }

  console.log(
    `\n  ${RELATION_TYPE} relations ${DRY_RUN ? "would-be-inserted" : "inserted"}: ${inserted}` +
      ` · already-existed: ${existing.length} · mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`,
  );

  if (!DRY_RUN) {
    const total = await prisma.claimRelation.count({
      where: { relationType: RELATION_TYPE },
    });
    console.log(`  Total ${RELATION_TYPE} relations in DB after run: ${total}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
