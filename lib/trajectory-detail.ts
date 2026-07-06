import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ── Serialized (JSON-safe) trajectory-detail types ───────────────────────────
// Dates → ISO strings; passed as props to client components or used in
// generateMetadata. Do not pass raw Date objects across the server/client
// boundary.

export type TrajectoryTransition = {
  fromAxis: string | null;
  toAxis: string;
  community: string;
  occurredAt: string;
  datePrecision: string | null;
  reason: string | null;
  markerSource: { name: string; url: string | null } | null;
};

export type TrajectoryDetail = {
  claimId: string;
  claimText: string;
  ingestedBy: string | null;
  claimEmergedAt: string | null;
  transitions: TrajectoryTransition[];
};

// ── Query ─────────────────────────────────────────────────────────────────────

// CRAWLER HOT PATH — keep to one round-trip with lean selects.
// ~235k trajectory URLs; every ISR miss runs this query live against Neon.
const STATUS_HISTORY_SELECT = Prisma.validator<Prisma.ClaimStatusHistoryFindManyArgs>()({
  orderBy: [{ occurredAt: "asc" as const }, { createdAt: "asc" as const }],
  select: {
    fromAxis: true,
    toAxis: true,
    community: true,
    occurredAt: true,
    datePrecision: true,
    reason: true,
    markerSource: { select: { name: true, url: true } },
  },
});

const CLAIM_FIELDS = {
  id: true,
  text: true,
  ingestedBy: true,
  claimEmergedAt: true,
} as const;

type RawStatusHistory = Prisma.ClaimStatusHistoryGetPayload<{
  select: {
    fromAxis: true;
    toAxis: true;
    community: true;
    occurredAt: true;
    datePrecision: true;
    reason: true;
    markerSource: { select: { name: true; url: true } };
  };
}>;

function serializeTransition(s: RawStatusHistory): TrajectoryTransition {
  return {
    fromAxis: s.fromAxis,
    toAxis: s.toAxis,
    community: s.community,
    occurredAt: s.occurredAt.toISOString(),
    datePrecision: s.datePrecision,
    reason: s.reason,
    markerSource: s.markerSource ? { name: s.markerSource.name, url: s.markerSource.url } : null,
  };
}

async function queryTrajectoryDetail(id: string): Promise<TrajectoryDetail | null> {
  // Primary: trajectory externalId lookup
  let claim = await prisma.claim.findFirst({
    where: { externalId: `trajectory:${id}`, deleted: false },
    select: { ...CLAIM_FIELDS, statusHistory: STATUS_HISTORY_SELECT },
  });

  // Fallback: raw claim CUID (corpus search results)
  if (!claim) {
    claim = await prisma.claim.findFirst({
      where: { id, deleted: false },
      select: { ...CLAIM_FIELDS, statusHistory: STATUS_HISTORY_SELECT },
    });
  }

  if (!claim) return null;

  return {
    claimId: claim.id,
    claimText: claim.text,
    ingestedBy: claim.ingestedBy,
    claimEmergedAt: claim.claimEmergedAt ? claim.claimEmergedAt.toISOString() : null,
    transitions: claim.statusHistory.map(serializeTransition),
  };
}

/**
 * Fetch + serialize trajectory detail for /settling-curve/[id] (page,
 * generateMetadata). Wrapped in React cache() so the page render and
 * generateMetadata share ONE query per request.
 * Returns null when the trajectory doesn't exist.
 */
export const getTrajectoryDetail = cache(async (id: string): Promise<TrajectoryDetail | null> => {
  return queryTrajectoryDetail(id);
});
