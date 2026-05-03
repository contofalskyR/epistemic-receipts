import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST { topicIds: string[] } — adds topics to a claim (idempotent via upsert)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { topicIds } = await req.json() as { topicIds: string[] };

  if (!Array.isArray(topicIds) || topicIds.length === 0) {
    return NextResponse.json({ error: "topicIds must be a non-empty array" }, { status: 400 });
  }

  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Upsert each topic individually — SQLite Prisma doesn't support skipDuplicates on composite PKs
  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where: { claimId_topicId: { claimId: id, topicId } },
      update: {},
      create: { claimId: id, topicId },
    });
  }

  const updated = await prisma.claimTopic.findMany({
    where: { claimId: id },
    include: { topic: { select: { id: true, name: true, slug: true, domain: true } } },
  });

  return NextResponse.json({ topics: updated.map(ct => ct.topic) });
}
