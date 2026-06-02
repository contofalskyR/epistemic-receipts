import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 600;

const FOLLOWUP_TYPES = ["OUTCOME", "STATUS_UPDATE", "SUPERSEDED_BY", "REVERSED", "EXPANDED"] as const;
type FollowUpType = (typeof FOLLOWUP_TYPES)[number];

type FollowUpClaim = {
  id: string;
  text: string;
  year: number | null;
  ingestedBy: string;
  sourceUrl: string | null;
  verificationStatus: string | null;
  relationType: FollowUpType;
  context: Record<string, unknown> | null;
};

type FollowUpGroup = Record<FollowUpType, FollowUpClaim[]>;

function pickSourceUrl(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  if (typeof m.source_url === "string" && m.source_url.length > 0) return m.source_url;
  if (typeof m.url === "string" && m.url.length > 0) return m.url;
  if (typeof m.doi === "string" && m.doi.length > 0) {
    return m.doi.startsWith("http") ? m.doi : `https://doi.org/${m.doi.replace(/^https?:\/\/doi\.org\//, "")}`;
  }
  return null;
}

function pickYear(claim: { claimEmergedAt: Date | null; metadata: unknown }): number | null {
  if (claim.metadata && typeof claim.metadata === "object") {
    const meta = claim.metadata as Record<string, unknown>;
    const y = meta.publication_year ?? meta.year;
    if (typeof y === "number") return y;
    if (typeof y === "string" && /^\d{4}/.test(y)) return parseInt(y.slice(0, 4), 10);
    const eff = meta.effective_time;
    if (typeof eff === "string" && /^\d{4}/.test(eff)) return parseInt(eff.slice(0, 4), 10);
  }
  if (claim.claimEmergedAt) return claim.claimEmergedAt.getUTCFullYear();
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const relations = await prisma.claimRelation.findMany({
    where: { fromClaimId: id, relationType: { in: FOLLOWUP_TYPES as unknown as string[] } },
    include: {
      toClaim: {
        select: {
          id: true,
          text: true,
          claimEmergedAt: true,
          verificationStatus: true,
          ingestedBy: true,
          metadata: true,
          deleted: true,
        },
      },
    },
  });

  const grouped: FollowUpGroup = {
    OUTCOME: [],
    STATUS_UPDATE: [],
    SUPERSEDED_BY: [],
    REVERSED: [],
    EXPANDED: [],
  };

  for (const r of relations) {
    if (!r.toClaim || r.toClaim.deleted) continue;
    const c = r.toClaim;
    const relType = r.relationType as FollowUpType;
    if (!FOLLOWUP_TYPES.includes(relType)) continue;
    grouped[relType].push({
      id: c.id,
      text: c.text,
      year: r.year ?? pickYear({ claimEmergedAt: c.claimEmergedAt, metadata: c.metadata }),
      ingestedBy: c.ingestedBy,
      sourceUrl: pickSourceUrl(c.metadata),
      verificationStatus: c.verificationStatus,
      relationType: relType,
      context: (r.followUpContext as Record<string, unknown> | null) ?? null,
    });
  }

  for (const k of FOLLOWUP_TYPES) {
    grouped[k].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }

  return NextResponse.json(grouped, {
    headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=3600" },
  });
}
