import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export async function GET() {
  const events = await prisma.historicalEvent.findMany({
    orderBy: [{ startDate: "asc" }],
    include: {
      _count: {
        select: { claims: true, votes: true, polities: true },
      },
    },
  });

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      description: e.description,
      startDate: e.startDate?.toISOString() ?? null,
      endDate: e.endDate?.toISOString() ?? null,
      category: e.category,
      claimCount: e._count.claims,
      voteCount: e._count.votes,
      polityCount: e._count.polities,
    })),
  });
}
