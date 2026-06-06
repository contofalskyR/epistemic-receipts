import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const topic = await prisma.topic.findUnique({ where: { slug } });
  if (!topic) {
    return NextResponse.json({ count: 0, samples: [] });
  }

  const claimFilter = {
    deleted: false,
    NOT: { verificationStatus: "DEPRECATED" },
  };

  const [count, sampleTopics] = await Promise.all([
    prisma.claimTopic.count({
      where: { topicId: topic.id, claim: claimFilter },
    }),
    prisma.claimTopic.findMany({
      where: { topicId: topic.id, claim: claimFilter },
      orderBy: { claim: { createdAt: "desc" } },
      take: 3,
      include: {
        claim: {
          include: {
            edges: {
              where: { deleted: false },
              select: { source: { select: { url: true } } },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const samples = sampleTopics.map((ct) => ({
    id: ct.claim.id,
    text: ct.claim.text,
    url: ct.claim.edges[0]?.source.url ?? null,
  }));

  const res = NextResponse.json({ count, samples });
  res.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  return res;
}
