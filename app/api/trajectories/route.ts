import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

function classifyDomain(ingestedBy: string | null): string {
  if (!ingestedBy) return "history";
  for (const [re, domain] of DOMAIN_RULES) {
    if (re.test(ingestedBy)) return domain;
  }
  return "history";
}

function classifyEra(emergedAt: Date | null): string {
  if (!emergedAt) return "Unknown";
  const y = emergedAt.getFullYear();
  if (y < 500)  return "Ancient & Classical";
  if (y < 1400) return "Medieval & Islamic Golden Age";
  if (y < 1750) return "Early Modern";
  if (y < 1900) return "Industrial & Colonial";
  if (y < 1950) return "WWI / WWII & Interwar";
  if (y < 1990) return "Cold War & Postwar";
  return "Modern";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  // minMilestones=2 ensures single-point auto-generated entries never appear
  const minMilestones = parseInt(searchParams.get("minMilestones") ?? "2");
  // source=curated → only trajectory: claims | source=auto → only non-trajectory | omit → both
  const source = searchParams.get("source") ?? "all";
  // cap for non-curated results to avoid returning millions at once
  const limit = parseInt(searchParams.get("limit") ?? "5000");

  const [curated, auto] = await Promise.all([
    // Curated trajectory: claims — no statusHistory filter, always show all
    source !== "auto"
      ? prisma.claim.findMany({
          where: {
            deleted: false,
            OR: [
              { verificationStatus: null },
              { verificationStatus: { not: "DEPRECATED" as const } },
            ],
            externalId: { startsWith: "trajectory:" },
          },
          select: {
            id: true,
            externalId: true,
            text: true,
            claimEmergedAt: true,
            ingestedBy: true,
            statusHistory: {
              orderBy: { occurredAt: "asc" },
              select: { community: true, toAxis: true, occurredAt: true },
            },
          },
        })
      : Promise.resolve([]),

    // Auto-generated: regular DB claims with status history
    source !== "curated"
      ? prisma.claim.findMany({
          where: {
            deleted: false,
            verificationStatus: { not: "DEPRECATED" as const },
            statusHistory: { some: {} },
            OR: [
              { externalId: null },
              { externalId: { not: { startsWith: "trajectory:" } } },
            ],
          },
          select: {
            id: true,
            externalId: true,
            text: true,
            claimEmergedAt: true,
            ingestedBy: true,
            statusHistory: {
              orderBy: { occurredAt: "asc" },
              select: { community: true, toAxis: true, occurredAt: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  // Curated always shown; auto filtered to minMilestones
  const allClaims = [
    ...curated,
    ...auto.filter((c) => c.statusHistory.length >= minMilestones),
  ];

  const list = allClaims.map((c) => {
      const sorted = [...c.statusHistory].sort(
        (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
      );
      const last = sorted[sorted.length - 1];
      const first = sorted[0];
      const isCurated = c.externalId?.startsWith("trajectory:") ?? false;
      return {
        id: isCurated
          ? c.externalId!.replace(/^trajectory:/, "")
          : c.id,
        claimId: c.id,
        claim: c.text.length > 160 ? c.text.slice(0, 157) + "…" : c.text,
        domain: classifyDomain(c.ingestedBy),
        era: classifyEra(c.claimEmergedAt),
        communities: [...new Set(c.statusHistory.map((s) => s.community))],
        transitionCount: c.statusHistory.length,
        hasReversal: c.statusHistory.some((s) => s.toAxis === "REVERSED"),
        hasAbandonment: c.statusHistory.some((s) => s.toAxis === "ABANDONED"),
        currentAxis: last?.toAxis ?? null,
        firstYear: first ? first.occurredAt.getUTCFullYear() : null,
        lastYear: last ? last.occurredAt.getUTCFullYear() : null,
        isCurated,
        milestones: sorted.map((s) => ({
          year: s.occurredAt.getUTCFullYear(),
          axis: s.toAxis,
        })),
      };
    });

  return NextResponse.json(list);
}
