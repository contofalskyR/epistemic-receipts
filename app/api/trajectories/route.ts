import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 600;

function classifyDomain(ingestedBy: string | null): string {
  if (!ingestedBy) return "history";
  if (ingestedBy.includes("medicine")) return "medicine";
  if (ingestedBy.includes("astronomy")) return "astronomy";
  if (ingestedBy.includes("climate")) return "climate";
  if (ingestedBy.includes("nutrition")) return "nutrition";
  if (ingestedBy.includes("law")) return "law";
  return "history";
}

function classifyEra(emergedAt: Date | null): string {
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

export async function GET() {
  const claims = await prisma.claim.findMany({
    where: { externalId: { startsWith: "trajectory:" }, deleted: false },
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
  });

  const list = claims.map((c) => {
    const sorted = [...c.statusHistory].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
    );
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    return {
      id: c.externalId!.replace(/^trajectory:/, ""),
      claimId: c.id,
      claim: c.text,
      domain: classifyDomain(c.ingestedBy),
      era: classifyEra(c.claimEmergedAt),
      communities: [...new Set(c.statusHistory.map((s) => s.community))],
      transitionCount: c.statusHistory.length,
      hasReversal: c.statusHistory.some((s) => s.toAxis === "REVERSED"),
      hasAbandonment: c.statusHistory.some((s) => s.toAxis === "ABANDONED"),
      currentAxis: last?.toAxis ?? null,
      firstYear: first ? first.occurredAt.getUTCFullYear() : null,
      lastYear: last ? last.occurredAt.getUTCFullYear() : null,
      // Lean milestone series for the sidebar-row sparkline (SettlingCurveMini).
      // Only year + axis — kept minimal because the full list ships at once.
      milestones: sorted.map((s) => ({
        year: s.occurredAt.getUTCFullYear(),
        axis: s.toAxis,
      })),
    };
  });

  return NextResponse.json(list);
}
