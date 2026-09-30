import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compactCount } from "@/lib/format";

// ─── The corpus total ────────────────────────────────────────────────────────
//
// ONE definition, ONE query, NO literals (STATUS.md, locked 2026-09-30):
// every Claim row with deleted = false. Not "classified", not "non-deprecated" —
// the ~138k never-classified rows and the 182 DEPRECATED (retired uspto_v1)
// rows are corpus rows with receipts. Default *views* still hide deprecated
// rows (LIVE_CLAIM_WHERE below); the headline counts them, and /stats says so.
//
// Before this helper the site carried four definitions and two hand-written
// literals at once: the homepage said 1.62M (Prisma's `not: "DEPRECATED"`
// silently drops NULL status) while the nav said "1.76M". Every rendered
// corpus total now goes through corpusCount(); the public figure is
// corpusCountCompact() ("1.76M"), derived, never typed.
//
// Cached in the Data Cache for an hour so app/layout.tsx (every page) never
// pays the COUNT(*) per request; ISR pages revalidate on the same window.

export const corpusCount = unstable_cache(
  async (): Promise<number> => prisma.claim.count({ where: { deleted: false } }),
  ["corpus-count"],
  { revalidate: 3600, tags: ["corpus-count"] },
);

/** The public figure — "1.76M" — derived from corpusCount(). */
export async function corpusCountCompact(): Promise<string> {
  return compactCount(await corpusCount());
}

export type PipelineCount = { ingestedBy: string; count: number };

/**
 * Per-pipeline breakdown under the SAME definition as corpusCount(), so tiles
 * and pipeline tables sum to the headline instead of each running their own
 * GROUP BY with its own filter (homepage, /pipelines, /sources and
 * /api/corpus-stats had four). Sorted by count, descending.
 */
export const corpusCountByPipeline = unstable_cache(
  async (): Promise<PipelineCount[]> => {
    const rows = await prisma.claim.groupBy({
      by: ["ingestedBy"],
      where: { deleted: false },
      _count: { _all: true },
      orderBy: { _count: { ingestedBy: "desc" } },
    });
    return rows.map((r) => ({ ingestedBy: r.ingestedBy, count: r._count._all }));
  },
  ["corpus-count-by-pipeline"],
  { revalidate: 3600, tags: ["corpus-count"] },
);

// ─── The default-view filter ─────────────────────────────────────────────────
//
// What a list, exemplar or per-topic count shows by default: non-deleted and
// not DEPRECATED. NULL verificationStatus (never classified) is IN — Prisma's
// bare `{ not: "DEPRECATED" }` compiles to `<> 'DEPRECATED'`, which SQL
// evaluates to NULL for NULL rows and so drops ~138k claims on the floor.
// Always use these two, never hand-roll the condition.

export const LIVE_CLAIM_WHERE = {
  deleted: false,
  OR: [{ verificationStatus: null }, { verificationStatus: { not: "DEPRECATED" } }],
} satisfies Prisma.ClaimWhereInput;

/** Raw-SQL twin of LIVE_CLAIM_WHERE for $queryRaw; `alias` is the Claim alias. */
export function liveClaimSql(alias = "c"): Prisma.Sql {
  const a = Prisma.raw(alias);
  return Prisma.sql`${a}.deleted = false AND ${a}."verificationStatus" IS DISTINCT FROM 'DEPRECATED'`;
}
