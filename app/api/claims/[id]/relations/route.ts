import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 600;

type RelatedClaim = {
  id: string;
  title: string;
  year: number | null;
  sourceUrl: string | null;
  status: string;
  verificationStatus: string | null;
  isStub: boolean;
};

type RelationGroup = {
  cites: RelatedClaim[];
  cited_by: RelatedClaim[];
  related: RelatedClaim[];
};

function pickSourceUrl(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  if (typeof m.source_url === "string" && m.source_url.length > 0) return m.source_url;
  if (typeof m.doi === "string" && m.doi.length > 0) {
    return m.doi.startsWith("http") ? m.doi : `https://doi.org/${m.doi.replace(/^https?:\/\/doi\.org\//, "")}`;
  }
  if (typeof m.openalex_id === "string" && m.openalex_id.length > 0) {
    return `https://openalex.org/${m.openalex_id}`;
  }
  return null;
}

function pickTitle(claim: { text: string; metadata: unknown }): string {
  if (claim.metadata && typeof claim.metadata === "object") {
    const t = (claim.metadata as Record<string, unknown>).title;
    if (typeof t === "string" && t.trim().length > 0) return t.trim();
  }
  return claim.text;
}

function pickYear(claim: {
  claimEmergedAt: Date | null;
  metadata: unknown;
}): number | null {
  if (claim.metadata && typeof claim.metadata === "object") {
    const y = (claim.metadata as Record<string, unknown>).publication_year;
    if (typeof y === "number") return y;
  }
  if (claim.claimEmergedAt) return claim.claimEmergedAt.getUTCFullYear();
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // We only need outgoing relations: fromClaimId = id. Each relationType lives in
  // its own row, so a single findMany gets all three categories.
  const relations = await prisma.claimRelation.findMany({
    where: { fromClaimId: id },
    orderBy: { year: "desc" },
    include: {
      toClaim: {
        select: {
          id: true,
          text: true,
          claimEmergedAt: true,
          currentStatus: true,
          verificationStatus: true,
          ingestedBy: true,
          metadata: true,
        },
      },
    },
  });

  const grouped: RelationGroup = { cites: [], cited_by: [], related: [] };

  for (const r of relations) {
    if (!r.toClaim) continue;
    const c = r.toClaim;
    const item: RelatedClaim = {
      id: c.id,
      title: pickTitle({ text: c.text, metadata: c.metadata }),
      year: r.year ?? pickYear({ claimEmergedAt: c.claimEmergedAt, metadata: c.metadata }),
      sourceUrl: pickSourceUrl(c.metadata),
      status: c.currentStatus,
      verificationStatus: c.verificationStatus,
      isStub: c.ingestedBy === "openalex_stub_v1",
    };
    if (r.relationType === "cites") grouped.cites.push(item);
    else if (r.relationType === "cited_by") grouped.cited_by.push(item);
    else if (r.relationType === "related") grouped.related.push(item);
  }

  // cited_by sort: newest first; cites/related: newest first as well
  grouped.cites.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  grouped.cited_by.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  grouped.related.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  return NextResponse.json(grouped, {
    headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=3600" },
  });
}
