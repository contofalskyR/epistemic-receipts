import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyDomain, classifyEra, type TrajectoryListItem } from "@/lib/trajectory-list";

// The explorer's machine-derived lens (/settling-curve?lens=machine), ported
// from /trajectories when it folded into the explorer (6b follow-ups, owner
// 2026-10-12). Notable non-curated curves: at least one REVERSED/ABANDONED
// transition, OR 3+ transitions, OR an arc spanning a year or more — which
// leaves out the ~206k same-day RECORDED→SETTLED certification pairs (honest
// receipts, degenerate curves). Ranked reversals → transition count → span.

export const MACHINE_LENS_LIMIT = 1000;

type Row = {
  id: string;
  text: string;
  ingestedBy: string | null;
  claimEmergedAt: Date | null;
  n: number;
  first_at: Date;
  last_at: Date;
  has_rev: boolean;
  has_aband: boolean;
};

const MACHINE_LENS_SQL = Prisma.sql`
  WITH agg AS (
    SELECT "claimId",
           COUNT(*)::int AS n,
           MIN("occurredAt") AS first_at,
           MAX("occurredAt") AS last_at,
           BOOL_OR("toAxis" = 'REVERSED')  AS has_rev,
           BOOL_OR("toAxis" = 'ABANDONED') AS has_aband
    FROM "ClaimStatusHistory"
    GROUP BY 1
    HAVING COUNT(*) >= 2
       AND (BOOL_OR("toAxis" = 'REVERSED')
            OR BOOL_OR("toAxis" = 'ABANDONED')
            OR COUNT(*) >= 3
            OR MAX("occurredAt") - MIN("occurredAt") >= interval '365 days')
  )
  SELECT c.id, c.text, c."ingestedBy", c."claimEmergedAt",
         a.n, a.first_at, a.last_at, a.has_rev, a.has_aband
  FROM agg a
  JOIN "Claim" c ON c.id = a."claimId"
  WHERE c.deleted = false
    AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
    AND (c."externalId" IS NULL OR c."externalId" NOT LIKE 'trajectory:%')
  ORDER BY a.has_rev DESC, a.n DESC, (a.last_at - a.first_at) DESC
  LIMIT ${MACHINE_LENS_LIMIT}`;

/** The machine lens in the explorer's list-item shape, cached for an hour. */
export const getMachineTrajectories = unstable_cache(
  async (): Promise<TrajectoryListItem[]> => {
    const rows = await prisma.$queryRaw<Row[]>(MACHINE_LENS_SQL);
    const history = await prisma.claimStatusHistory.findMany({
      where: { claimId: { in: rows.map((r) => r.id) } },
      orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
      select: { claimId: true, toAxis: true, community: true, occurredAt: true },
    });
    const byClaim = new Map<string, typeof history>();
    for (const h of history) byClaim.set(h.claimId, [...(byClaim.get(h.claimId) ?? []), h]);
    return rows.map((r) => {
      const hs = byClaim.get(r.id) ?? [];
      return {
        id: r.id, // a claim id: the explorer opens it by CUID
        claimId: r.id,
        claim: r.text.length > 160 ? r.text.slice(0, 157) + "…" : r.text,
        domain: classifyDomain(r.ingestedBy),
        era: classifyEra(r.claimEmergedAt),
        communities: [...new Set(hs.map((h) => String(h.community)))],
        transitionCount: r.n,
        hasReversal: r.has_rev,
        hasAbandonment: r.has_aband,
        currentAxis: hs[hs.length - 1]?.toAxis ?? null,
        firstYear: r.first_at.getUTCFullYear(),
        lastYear: r.last_at.getUTCFullYear(),
        emergedYear: r.claimEmergedAt ? r.claimEmergedAt.getUTCFullYear() : null,
        isCurated: false,
        milestones: hs.map((h) => ({ year: h.occurredAt.getUTCFullYear(), axis: h.toAxis })),
      };
    });
  },
  ["machine-trajectories", "v1"],
  { revalidate: 3600 },
);
