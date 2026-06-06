import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const savedQuery = await prisma.savedQuery.findUnique({ where: { id } });
  if (!savedQuery || savedQuery.profileId !== profile.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const filters = savedQuery.filters as {
    topics?: string[];
    countries?: string[];
    sources?: string[];
    polityIds?: string[];
    q?: string;
  };

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const claims = await prisma.claim.findMany({
    where: {
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
      createdAt: { gte: cutoff },
      ...(filters.q ? { text: { contains: filters.q, mode: "insensitive" } } : {}),
      ...(filters.topics?.length
        ? { topics: { some: { topic: { slug: { in: filters.topics } } } } }
        : {}),
      ...(filters.polityIds?.length
        ? { polityLinks: { some: { polityId: { in: filters.polityIds } } } }
        : {}),
    },
    select: { id: true, text: true, currentStatus: true, ingestedBy: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ claims });
}
