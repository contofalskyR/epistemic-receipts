import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_CENTROIDS } from "@/lib/country-centroids";

export const revalidate = 600;

// Maximum claims to inspect per pair when assembling the "recent claims" sample.
const PAIR_SAMPLE_SIZE = 5;
// Top N most-connected pairs returned.
const TOP_PAIRS = 100;

type PolityRow = {
  id: string;
  countryCode: string | null;
  name: string;
};

type ClaimRow = {
  id: string;
  text: string;
  createdAt: Date;
  claimEmergedAt: Date | null;
  polityIds: string[];
};

export async function GET() {
  // Step 1 — pull all polities (small table, ~2,361 rows). We need countryCode
  // + id mapping to bucket polities into countries.
  const polities = await prisma.polity.findMany({
    where: { countryCode: { not: null } },
    select: { id: true, countryCode: true, name: true },
  });

  if (polities.length === 0) {
    return NextResponse.json({ pairs: [], countries: [] });
  }

  const polityToCountry = new Map<string, string>();
  for (const p of polities as PolityRow[]) {
    if (p.countryCode && COUNTRY_CENTROIDS[p.countryCode]) {
      polityToCountry.set(p.id, p.countryCode);
    }
  }

  if (polityToCountry.size === 0) {
    return NextResponse.json({ pairs: [], countries: [] });
  }

  // Step 2 — find claims that have >= 2 distinct polities in our centroid set.
  // PolityClaim is large (~347k links), so we aggregate at SQL level to keep
  // the working set tight: only claims with multiple polity-country links.
  type RawRow = {
    claimId: string;
    countryCodes: string[];
  };

  const polityIdsParam = Array.from(polityToCountry.keys());

  // Build a comma-separated list of polity IDs as a CTE filter. Prisma's raw
  // query handles the array parameter via Prisma.join.
  const rawRows: Array<{ claim_id: string; country_codes: string[] }> = await prisma.$queryRaw`
    WITH eligible AS (
      SELECT pc."claimId" AS claim_id, p."countryCode" AS country_code
      FROM "PolityClaim" pc
      JOIN "Polity" p ON pc."polityId" = p.id
      WHERE p."countryCode" IS NOT NULL
    ),
    grouped AS (
      SELECT claim_id, ARRAY_AGG(DISTINCT country_code) AS country_codes
      FROM eligible
      GROUP BY claim_id
      HAVING COUNT(DISTINCT country_code) >= 2
    )
    SELECT g.claim_id, g.country_codes
    FROM grouped g
    JOIN "Claim" c ON c.id = g.claim_id AND c.deleted = false
    LIMIT 50000
  `;

  if (rawRows.length === 0) {
    return NextResponse.json({ pairs: [], countries: [] });
  }

  // Step 3 — count pairs (unordered country tuples). Stash a few recent claims
  // per pair for the side panel.
  type PairKey = string; // "AAA::BBB" sorted lexicographically
  type PairAcc = {
    countryA: string;
    countryB: string;
    claimIds: string[];
  };

  const pairAcc = new Map<PairKey, PairAcc>();

  for (const row of rawRows) {
    const codes = (row.country_codes ?? []).filter((c) => COUNTRY_CENTROIDS[c]);
    if (codes.length < 2) continue;
    const unique = Array.from(new Set(codes)).sort();
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i];
        const b = unique[j];
        const key = `${a}::${b}`;
        const entry = pairAcc.get(key);
        if (entry) {
          entry.claimIds.push(row.claim_id);
        } else {
          pairAcc.set(key, { countryA: a, countryB: b, claimIds: [row.claim_id] });
        }
      }
    }
  }

  // Step 4 — sort pairs by claim count desc, take top N.
  const topPairs = Array.from(pairAcc.values())
    .map((p) => ({ ...p, claimCount: p.claimIds.length }))
    .sort((a, b) => b.claimCount - a.claimCount)
    .slice(0, TOP_PAIRS);

  if (topPairs.length === 0) {
    return NextResponse.json({ pairs: [], countries: [] });
  }

  // Step 5 — fetch a handful of recent claims per pair.
  // We collect all distinct sample claim IDs (up to PAIR_SAMPLE_SIZE per pair)
  // and resolve them in one Claim query.
  const sampleIdSet = new Set<string>();
  const pairSamples = new Map<PairKey, string[]>();

  for (const pair of topPairs) {
    const key = `${pair.countryA}::${pair.countryB}`;
    // Use the most recently inserted PolityClaim links as a proxy for "recent"
    // by simply taking the first N claim IDs we saw; ordering within rawRows
    // is the database's natural order. Good enough for a sample.
    const sample = pair.claimIds.slice(0, PAIR_SAMPLE_SIZE);
    pairSamples.set(key, sample);
    for (const id of sample) sampleIdSet.add(id);
  }

  const claimRows = sampleIdSet.size > 0
    ? await prisma.claim.findMany({
        where: { id: { in: Array.from(sampleIdSet) }, deleted: false },
        select: {
          id: true,
          text: true,
          createdAt: true,
          claimEmergedAt: true,
        },
      })
    : [];

  const claimById = new Map(claimRows.map((c) => [c.id, c]));

  function getYear(c: { createdAt: Date; claimEmergedAt: Date | null }): number | null {
    const d = c.claimEmergedAt ?? c.createdAt;
    if (!d) return null;
    return new Date(d).getUTCFullYear();
  }

  const pairs = topPairs.map((p) => {
    const sampleIds = pairSamples.get(`${p.countryA}::${p.countryB}`) ?? [];
    const recentClaims = sampleIds
      .map((id) => claimById.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({
        id: c.id,
        title: c.text.length > 140 ? c.text.slice(0, 140) + "…" : c.text,
        year: getYear(c),
      }));

    const ca = COUNTRY_CENTROIDS[p.countryA];
    const cb = COUNTRY_CENTROIDS[p.countryB];

    return {
      countryA: p.countryA,
      countryB: p.countryB,
      countryAName: ca.name,
      countryBName: cb.name,
      startLat: ca.lat,
      startLng: ca.lng,
      endLat: cb.lat,
      endLng: cb.lng,
      claimCount: p.claimCount,
      recentClaims,
    };
  });

  // Country roster — every country that participates in at least one pair.
  const countryCodes = new Set<string>();
  for (const p of topPairs) {
    countryCodes.add(p.countryA);
    countryCodes.add(p.countryB);
  }
  const countries = Array.from(countryCodes)
    .map((code) => {
      const c = COUNTRY_CENTROIDS[code];
      return { alpha3: code, name: c.name, lat: c.lat, lng: c.lng };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ pairs, countries });
}
