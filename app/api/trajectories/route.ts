import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 600;

export async function GET() {
  const claims = await prisma.claim.findMany({
    where: { externalId: { startsWith: "trajectory:" }, deleted: false },
    select: {
      id: true,
      externalId: true,
      text: true,
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
    communities: [...new Set(c.statusHistory.map((s) => s.community))],
    transitionCount: c.statusHistory.length,
    hasReversal: c.statusHistory.some((s) => s.toAxis === "REVERSED"),
    hasAbandonment: c.statusHistory.some((s) => s.toAxis === "ABANDONED"),
  }));

  return NextResponse.json(list);
}
