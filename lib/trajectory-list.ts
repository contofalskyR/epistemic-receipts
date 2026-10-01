import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LIVE_CLAIM_WHERE, liveClaimSql } from "@/lib/corpus";

// The curated trajectory list — one loader for /settling-curve (SSR initial
// grid) and /api/trajectories (client refresh), cached for an hour so anonymous
// visits never run the 1.4 s curated query (STATUS.md Phase 5).
//
// Why chunks: the whole list serialises to ~3.1 MB (5,698 cards, 2026-09-30),
// over the Data Cache's 2 MB per-entry limit on Vercel — a single
// unstable_cache entry would silently never be stored. Each chunk is ~550 KB.
// Ordering by externalId makes the chunk boundaries stable between requests.

export const CURATED_WHERE = {
  ...LIVE_CLAIM_WHERE,
  externalId: { startsWith: "trajectory:" },
} satisfies Prisma.ClaimWhereInput;

const CHUNK = 1000;
const REVALIDATE = 3600;

const TRAJECTORY_SELECT = {
  id: true,
  externalId: true,
  text: true,
  claimEmergedAt: true,
  ingestedBy: true,
  statusHistory: {
    // Chain order (seq), date fallback for unstamped legacy rows — a date
    // re-sort would undo exactly what seq fixes (docs/ORDERING-SEMANTICS-2026-07-08.md).
    orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
    select: { community: true, toAxis: true, occurredAt: true },
  },
} satisfies Prisma.ClaimSelect;

export type TrajectoryListItem = {
  id: string;
  claimId: string;
  claim: string;
  domain: string;
  era: string;
  communities: string[];
  transitionCount: number;
  hasReversal: boolean;
  hasAbandonment: boolean;
  currentAxis: string | null;
  firstYear: number | null;
  lastYear: number | null;
  isCurated: boolean;
  milestones: { year: number; axis: string }[];
};

// Domain classification — checked in order; first match wins.
const DOMAIN_RULES: [RegExp, string][] = [
  [/medicine|pharma|drug|fda|clinical|who_gho|openfda|chebi|faers/i, "medicine"],
  [/astronomy|space|nasa|exoplanet/i, "astronomy"],
  [/climate|environment|epa/i, "climate"],
  [/nutrition|diet/i, "nutrition"],
  [/law|court|judicial|litigation|scotus|circuit|bia|icsid/i, "law"],
  [/legislation|congress|parliament|riksdag|bundestag|senate/i, "politics"],
  [/voteview|vote/i, "politics"],
  [/openalex|journal|crossref|retract/i, "science"],
  [/nara|jacar|archive/i, "history"],
  [/worldbank|vdem|sipri|ucdp|ofac/i, "global"],
];

export function classifyDomain(ingestedBy: string | null): string {
  if (!ingestedBy) return "history";
  for (const [re, domain] of DOMAIN_RULES) {
    if (re.test(ingestedBy)) return domain;
  }
  return "history";
}

export function classifyEra(emergedAt: Date | null): string {
  if (!emergedAt) return "Unknown";
  const y = emergedAt.getFullYear();
  if (y < 500) return "Ancient & Classical";
  if (y < 1400) return "Medieval & Islamic Golden Age";
  if (y < 1750) return "Early Modern";
  if (y < 1900) return "Industrial & Colonial";
  if (y < 1950) return "WWI / WWII & Interwar";
  if (y < 1990) return "Cold War & Postwar";
  return "Modern";
}

type Row = {
  id: string;
  externalId: string | null;
  text: string;
  claimEmergedAt: Date | null;
  ingestedBy: string | null;
  statusHistory: { community: string; toAxis: string; occurredAt: Date }[];
};

/** Plain JSON shape (years, not Dates) so it survives the data cache. */
export function toListItem(c: Row): TrajectoryListItem {
  const sorted = c.statusHistory;
  const last = sorted[sorted.length - 1];
  const first = sorted[0];
  const isCurated = c.externalId?.startsWith("trajectory:") ?? false;
  return {
    id: isCurated ? c.externalId!.replace(/^trajectory:/, "") : c.id,
    claimId: c.id,
    claim: c.text.length > 160 ? c.text.slice(0, 157) + "…" : c.text,
    domain: classifyDomain(c.ingestedBy),
    era: classifyEra(c.claimEmergedAt),
    communities: [...new Set(sorted.map((s) => s.community))],
    transitionCount: sorted.length,
    hasReversal: sorted.some((s) => s.toAxis === "REVERSED"),
    hasAbandonment: sorted.some((s) => s.toAxis === "ABANDONED"),
    currentAxis: last?.toAxis ?? null,
    firstYear: first ? first.occurredAt.getUTCFullYear() : null,
    lastYear: last ? last.occurredAt.getUTCFullYear() : null,
    isCurated,
    milestones: sorted.map((s) => ({ year: s.occurredAt.getUTCFullYear(), axis: s.toAxis })),
  };
}

const countCurated = unstable_cache(
  async () => prisma.claim.count({ where: CURATED_WHERE }),
  ["curated-trajectories-count"],
  { revalidate: REVALIDATE },
);

const loadCuratedChunk = unstable_cache(
  async (chunk: number): Promise<TrajectoryListItem[]> => {
    const rows = await prisma.claim.findMany({
      where: CURATED_WHERE,
      select: TRAJECTORY_SELECT,
      orderBy: { externalId: "asc" },
      skip: chunk * CHUNK,
      take: CHUNK,
    });
    return rows.map(toListItem);
  },
  ["curated-trajectories-chunk"],
  { revalidate: REVALIDATE },
);

/** Every curated (trajectory:*) claim as a list card, from the hourly cache. */
export async function getCuratedTrajectories(): Promise<TrajectoryListItem[]> {
  const total = await countCurated();
  const chunks = Math.max(1, Math.ceil(total / CHUNK));
  const parts = await Promise.all(Array.from({ length: chunks }, (_, i) => loadCuratedChunk(i)));
  return parts.flat();
}

// ─── Auto-generated trajectories ─────────────────────────────────────────────
//
// The newest non-curated claims with at least `minMilestones` transitions. The
// count filter runs in SQL: Prisma has no relation-count filter in `where`,
// and the old loader filtered after `take` — the 5,000 newest claims with any
// history each carry one transition, so the list came back empty while
// 236,181 live claims had two or more (2026-09-30).
//
// Two hourly cache layers: the id list (one small entry) and the cards in
// 1,000-id chunks — 5,000 cards measure ~2.9 MB by the Data Cache's own count,
// over its 2 MB entry limit. A chunk is keyed by its ids, so it always matches
// the id list that asked for it. Only the full list is cached: `limit` slices
// afterwards and `minMilestones` is capped in the key, so query-string values
// cannot grow the key space.

export const AUTO_LIMIT = 5000;
const MAX_KEY_MILESTONES = 10;

/** Ids of the newest live non-curated claims with ≥ `minMilestones`
 *  transitions, newest first. Bulk ingests share a `createdAt`, so `id` breaks
 *  ties — the order (and every chunk boundary) is stable between runs. */
export function autoTrajectoryIdsSql(minMilestones: number, limit: number): Prisma.Sql {
  return Prisma.sql`
    SELECT c.id
    FROM (
      SELECT "claimId" FROM "ClaimStatusHistory"
      GROUP BY "claimId"
      HAVING COUNT(*) >= ${minMilestones}
    ) h
    JOIN "Claim" c ON c.id = h."claimId"
    WHERE ${liveClaimSql("c")}
      AND (c."externalId" IS NULL OR c."externalId" NOT LIKE 'trajectory:%')
    ORDER BY c."createdAt" DESC, c.id DESC
    LIMIT ${limit}`;
}

const loadAutoIds = unstable_cache(
  async (minMilestones: number): Promise<string[]> => {
    const rows = await prisma.$queryRaw<{ id: string }[]>(autoTrajectoryIdsSql(minMilestones, AUTO_LIMIT));
    return rows.map((r) => r.id);
  },
  ["auto-trajectory-ids"],
  { revalidate: REVALIDATE },
);

const loadAutoChunk = unstable_cache(
  async (ids: string[], minMilestones: number): Promise<TrajectoryListItem[]> => {
    const rows = await prisma.claim.findMany({
      where: { AND: [LIVE_CLAIM_WHERE, { id: { in: ids } }] },
      select: TRAJECTORY_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    // SQL order; re-checked in case a row changed since the id list was cached.
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row && row.statusHistory.length >= minMilestones ? [toListItem(row)] : [];
    });
  },
  ["auto-trajectories-chunk"],
  { revalidate: REVALIDATE },
);

/** The newest `limit` (≤ AUTO_LIMIT) auto-generated claims with at least
 *  `minMilestones` transitions, as list cards, newest first, from the hourly
 *  cache. Both arguments may come straight from a query string: NaN falls back
 *  to the defaults. */
export async function getAutoTrajectories(
  limit: number = AUTO_LIMIT,
  minMilestones = 2,
): Promise<TrajectoryListItem[]> {
  const take = Number.isFinite(limit) ? Math.min(AUTO_LIMIT, Math.max(1, Math.floor(limit))) : AUTO_LIMIT;
  const min = Number.isFinite(minMilestones) ? Math.max(1, Math.floor(minMilestones)) : 2;
  const keyMin = Math.min(min, MAX_KEY_MILESTONES);
  const ids = await loadAutoIds(keyMin);
  const chunks: string[][] = [];
  for (let i = 0; i < Math.min(take, ids.length); i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const parts = await Promise.all(chunks.map((chunk) => loadAutoChunk(chunk, keyMin)));
  return parts
    .flat()
    .filter((t) => t.transitionCount >= min)
    .slice(0, take);
}
