import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 600;

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
      statusHistory: {
        orderBy: { occurredAt: "asc" },
        select: { community: true, toAxis: true, occurredAt: true },
      },
    },
  });

  const list = claims.map((c) => ({
    id: c.externalId!.replace(/^trajectory:/, ""),
    claimId: c.id,
    claim: c.text,
    era: classifyEra(c.claimEmergedAt),
    communities: [...new Set(c.statusHistory.map((s) => s.community))],
    transitionCount: c.statusHistory.length,
    hasReversal: c.statusHistory.some((s) => s.toAxis === "REVERSED"),
    hasAbandonment: c.statusHistory.some((s) => s.toAxis === "ABANDONED"),
  }));

  return NextResponse.json(list);
}
