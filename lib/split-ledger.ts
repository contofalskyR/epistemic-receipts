/**
 * lib/split-ledger.ts — shared query library for /split-ledger page and the
 * B4-1 tiering script.
 *
 * Tier classification rules (mirrors b4-divergence-tiers.ts):
 *   Tier 1 — Conflict: one community's latest axis ∈ {SETTLED, REVERSED}
 *     AND another community's latest axis ∈ {CONTESTED, REVERSED, ABANDONED},
 *     with the two axes being different (incompatible endpoints).
 *   Tier 2 — Stage-lag: divergent, but not Tier 1. Same arc at different stages.
 *
 * Never fabricate counts or claim text — every value comes from DB rows.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const COMMUNITY_LABEL: Record<string, string> = {
  EXPERT_LITERATURE: "Expert literature",
  INSTITUTIONAL: "Institutional",
  JUDICIAL: "Judicial",
  PUBLIC: "Public record",
  MARKET: "Market",
};

// Canonical ordered list of community pairs by divergence frequency (from B3-6)
export const TIER2_COMMUNITY_PAIRS: string[] = [
  "EXPERT_LITERATURE ↔ INSTITUTIONAL",
  "EXPERT_LITERATURE ↔ PUBLIC",
  "INSTITUTIONAL ↔ PUBLIC",
  "JUDICIAL ↔ PUBLIC",
  "INSTITUTIONAL ↔ JUDICIAL",
  "EXPERT_LITERATURE ↔ MARKET",
  "EXPERT_LITERATURE ↔ JUDICIAL",
  "INSTITUTIONAL ↔ MARKET",
  "MARKET ↔ PUBLIC",
  "JUDICIAL ↔ MARKET",
];

export type CommunityEntry = {
  community: string;
  latestAxis: string;
  latestDate: string; // ISO date string YYYY-MM-DD
};

export type SplitLedgerClaim = {
  claimId: string;
  text: string;
  communityEntries: CommunityEntry[];
  transitionCount: number;
  firstYear: number | null;
  lastYear: number | null;
};

const TIER1_ANCHOR = new Set(["SETTLED", "REVERSED"]);
const TIER1_OTHER = new Set(["CONTESTED", "REVERSED", "ABANDONED"]);

function classifyTier(axes: string[]): 1 | 2 {
  for (const a of axes) {
    if (!TIER1_ANCHOR.has(a)) continue;
    for (const b of axes) {
      if (a === b) continue;
      if (TIER1_OTHER.has(b)) return 1;
    }
  }
  return 2;
}

type ClaimLatestAxes = {
  claimId: string;
  community: string;
  latestAxis: string;
  latestDate: Date;
};

type ClaimMeta = {
  claimId: string;
  text: string;
  transitionCount: bigint;
  firstOccurredAt: Date | null;
  lastOccurredAt: Date | null;
};

// Cached classification to avoid re-querying on each paginated request.
// Keyed by tier; values are arrays of claim IDs in stable order.
let _classificationCache:
  | { tier1: string[]; tier2: string[]; tier2ByPair: Record<string, string[]> }
  | null = null;
let _cacheAge = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — matches ISR revalidate

async function getClassification() {
  const now = Date.now();
  if (_classificationCache && now - _cacheAge < CACHE_TTL_MS) {
    return _classificationCache;
  }

  // Load all multi-community claims' latest axes
  const multiIds = await prisma.$queryRaw<{ claimId: string }[]>`
    SELECT "claimId"
    FROM "ClaimStatusHistory"
    GROUP BY "claimId"
    HAVING COUNT(DISTINCT community) >= 2
  `;

  if (multiIds.length === 0) {
    _classificationCache = { tier1: [], tier2: [], tier2ByPair: {} };
    _cacheAge = now;
    return _classificationCache;
  }

  const ids = multiIds.map((r) => r.claimId);

  const latest = await prisma.$queryRaw<ClaimLatestAxes[]>`
    SELECT DISTINCT ON (csh."claimId", csh.community)
      csh."claimId",
      csh.community,
      csh."toAxis"     AS "latestAxis",
      csh."occurredAt" AS "latestDate"
    FROM "ClaimStatusHistory" csh
    WHERE csh."claimId" = ANY(${ids}::text[])
    ORDER BY csh."claimId", csh.community, csh."occurredAt" DESC, csh."createdAt" DESC
  `;

  // Group by claimId
  const byClaimId: Record<string, ClaimLatestAxes[]> = {};
  for (const row of latest) {
    if (!byClaimId[row.claimId]) byClaimId[row.claimId] = [];
    byClaimId[row.claimId].push(row);
  }

  const tier1: string[] = [];
  const tier2: string[] = [];
  const tier2ByPair: Record<string, string[]> = {};

  for (const [claimId, entries] of Object.entries(byClaimId)) {
    const axes = entries.map((e) => e.latestAxis);
    const axisSet = new Set(axes);
    if (axisSet.size <= 1) continue; // not divergent

    const tier = classifyTier(axes);
    if (tier === 1) {
      tier1.push(claimId);
    } else {
      tier2.push(claimId);
      // Index by community pair for filtering
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (entries[i].latestAxis !== entries[j].latestAxis) {
            const pair = [entries[i].community, entries[j].community].sort().join(" ↔ ");
            if (!tier2ByPair[pair]) tier2ByPair[pair] = [];
            // Only add once per claim (first mismatched pair)
            if (!tier2ByPair[pair].includes(claimId)) {
              tier2ByPair[pair].push(claimId);
            }
          }
        }
      }
    }
  }

  _classificationCache = { tier1, tier2, tier2ByPair };
  _cacheAge = now;
  return _classificationCache;
}

async function enrichClaims(
  claimIds: string[]
): Promise<Map<string, ClaimMeta>> {
  if (claimIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<ClaimMeta[]>(
    Prisma.sql`
      SELECT
        c.id AS "claimId",
        LEFT(c.text, 300) AS text,
        COUNT(csh.id)::bigint  AS "transitionCount",
        MIN(csh."occurredAt") AS "firstOccurredAt",
        MAX(csh."occurredAt") AS "lastOccurredAt"
      FROM "Claim" c
      LEFT JOIN "ClaimStatusHistory" csh ON csh."claimId" = c.id
      WHERE c.id = ANY(${claimIds}::text[])
      GROUP BY c.id, c.text
    `
  );

  const map = new Map<string, ClaimMeta>();
  for (const r of rows) map.set(r.claimId, r);
  return map;
}

async function enrichCommunityEntries(
  claimIds: string[]
): Promise<Map<string, CommunityEntry[]>> {
  if (claimIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    { claimId: string; community: string; latestAxis: string; latestDate: Date }[]
  >`
    SELECT DISTINCT ON (csh."claimId", csh.community)
      csh."claimId",
      csh.community,
      csh."toAxis"     AS "latestAxis",
      csh."occurredAt" AS "latestDate"
    FROM "ClaimStatusHistory" csh
    WHERE csh."claimId" = ANY(${claimIds}::text[])
    ORDER BY csh."claimId", csh.community, csh."occurredAt" DESC, csh."createdAt" DESC
  `;

  const map = new Map<string, CommunityEntry[]>();
  for (const row of rows) {
    if (!map.has(row.claimId)) map.set(row.claimId, []);
    map.get(row.claimId)!.push({
      community: row.community,
      latestAxis: row.latestAxis,
      latestDate: row.latestDate.toISOString().slice(0, 10),
    });
  }
  return map;
}

async function buildClaims(claimIds: string[]): Promise<SplitLedgerClaim[]> {
  const [metaMap, communityMap] = await Promise.all([
    enrichClaims(claimIds),
    enrichCommunityEntries(claimIds),
  ]);

  return claimIds.flatMap((id) => {
    const meta = metaMap.get(id);
    const entries = communityMap.get(id) ?? [];
    if (!meta) return [];
    return [
      {
        claimId: id,
        text: meta.text,
        communityEntries: entries,
        transitionCount: Number(meta.transitionCount),
        firstYear: meta.firstOccurredAt
          ? meta.firstOccurredAt.getUTCFullYear()
          : null,
        lastYear: meta.lastOccurredAt
          ? meta.lastOccurredAt.getUTCFullYear()
          : null,
      } satisfies SplitLedgerClaim,
    ];
  });
}

export const PAGE_SIZE = 50;

export async function loadTier1Claims(page = 0): Promise<{
  claims: SplitLedgerClaim[];
  total: number;
}> {
  const { tier1 } = await getClassification();
  const window = tier1.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const claims = await buildClaims(window);
  return { claims, total: tier1.length };
}

export async function loadTier2Claims(
  communityPair: string | null = null,
  page = 0
): Promise<{ claims: SplitLedgerClaim[]; total: number }> {
  const { tier2, tier2ByPair } = await getClassification();
  const source = communityPair ? (tier2ByPair[communityPair] ?? []) : tier2;
  const window = source.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const claims = await buildClaims(window);
  return { claims, total: source.length };
}

export async function loadSplitLedgerCounts(): Promise<{
  tier1: number;
  tier2: number;
}> {
  const { tier1, tier2 } = await getClassification();
  return { tier1: tier1.length, tier2: tier2.length };
}
