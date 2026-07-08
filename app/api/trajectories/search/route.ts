import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Domain classification — checked in order; first match wins.
// Kept in sync with /api/trajectories/route.ts.
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

function classifyDomain(ingestedBy: string | null): string {
  if (!ingestedBy) return "history";
  for (const [re, domain] of DOMAIN_RULES) {
    if (re.test(ingestedBy)) return domain;
  }
  return "history";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  if (!q) return NextResponse.json([]);

  const claims = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [
        { verificationStatus: null },
        { verificationStatus: { not: "DEPRECATED" as const } },
      ],
      statusHistory: { some: {} },
      text: { contains: q, mode: "insensitive" },
      NOT: { externalId: { startsWith: "trajectory:" } },
    },
    select: {
      id: true,
      text: true,
      claimEmergedAt: true,
      ingestedBy: true,
      statusHistory: {
        orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
        select: { community: true, toAxis: true, occurredAt: true },
      },
    },
    take: limit,
    skip: offset,
    orderBy: { claimEmergedAt: "desc" },
  });

  const list = claims.map((c) => {
    const sorted = [...c.statusHistory].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
    );
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    return {
      id: c.id,
      claimId: c.id,
      claim: c.text.length > 160 ? c.text.slice(0, 157) + "…" : c.text,
      domain: classifyDomain(c.ingestedBy),
      communities: [...new Set(c.statusHistory.map((s) => s.community))],
      transitionCount: c.statusHistory.length,
      hasReversal: c.statusHistory.some((s) => s.toAxis === "REVERSED"),
      hasAbandonment: c.statusHistory.some((s) => s.toAxis === "ABANDONED"),
      currentAxis: last?.toAxis ?? null,
      firstYear: first ? first.occurredAt.getUTCFullYear() : null,
      lastYear: last ? last.occurredAt.getUTCFullYear() : null,
      isCurated: false,
      milestones: sorted.map((s) => ({
        year: s.occurredAt.getUTCFullYear(),
        axis: s.toAxis,
      })),
    };
  });

  return NextResponse.json(list);
}
