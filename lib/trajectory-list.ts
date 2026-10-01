import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LIVE_CLAIM_WHERE } from "@/lib/corpus";

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

/** The newest auto-generated (non-curated) claims that have a status history,
 *  as list cards, from the hourly cache. `minMilestones` is applied after the
 *  `take`, as the API always has — see LATER.md (the newest rows all carry a
 *  single transition, so the auto list is currently empty). */
export const getAutoTrajectories = unstable_cache(
  async (limit: number, minMilestones: number): Promise<TrajectoryListItem[]> => {
    const rows = await prisma.claim.findMany({
      where: {
        AND: [
          LIVE_CLAIM_WHERE,
          { OR: [{ externalId: null }, { externalId: { not: { startsWith: "trajectory:" } } }] },
        ],
        statusHistory: { some: {} },
      },
      select: TRAJECTORY_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.filter((c) => c.statusHistory.length >= minMilestones).map(toListItem);
  },
  ["auto-trajectories"],
  { revalidate: REVALIDATE },
);
