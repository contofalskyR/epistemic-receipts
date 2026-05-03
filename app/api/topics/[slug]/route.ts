import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

// Build parent chain by walking up the nested parentTopic relations.
function buildParentChain(
  topic: { name: string; slug: string; parentTopic?: { name: string; slug: string; parentTopic?: { name: string; slug: string; parentTopic?: { name: string; slug: string } | null } | null } | null }
): { name: string; slug: string }[] {
  const chain: { name: string; slug: string }[] = [];
  let current = topic.parentTopic;
  while (current) {
    chain.unshift({ name: current.name, slug: current.slug });
    current = current.parentTopic ?? null;
  }
  return chain;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const sort = req.nextUrl.searchParams.get("sort") ?? "emerged_desc";

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      parentTopic: {
        include: {
          parentTopic: { include: { parentTopic: true } },
        },
      },
      children: {
        include: { _count: { select: { claims: true } } },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!topic) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Sibling topics
  const siblings = topic.parentTopicId
    ? await prisma.topic.findMany({
        where: { parentTopicId: topic.parentTopicId, id: { not: topic.id } },
        include: { _count: { select: { claims: true } } },
        orderBy: { name: "asc" },
      })
    : [];

  const claimWhere = { topicId: topic.id, claim: { deleted: false } };

  const claimOrderBy =
    sort === "most_sources"
      ? { claim: { edges: { _count: "desc" as const } } }
      : sort === "emerged_asc"
        ? { claim: { claimEmergedAt: "asc" as const } }
        : { claim: { claimEmergedAt: "desc" as const } };

  const [total, claimTopics] = await Promise.all([
    prisma.claimTopic.count({ where: claimWhere }),
    prisma.claimTopic.findMany({
      where: claimWhere,
      orderBy: claimOrderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        claim: {
          include: {
            _count: { select: { edges: { where: { deleted: false } } } },
            topics: { select: { topic: { select: { id: true, name: true, slug: true, domain: true } } } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    topic: {
      id: topic.id, name: topic.name, slug: topic.slug,
      domain: topic.domain, description: topic.description,
      parentTopicId: topic.parentTopicId,
      children: topic.children.map(c => ({
        id: c.id, name: c.name, slug: c.slug,
        claimCount: c._count.claims,
      })),
    },
    parentChain: buildParentChain(topic),
    siblings: siblings.map(s => ({ id: s.id, name: s.name, slug: s.slug, claimCount: s._count.claims })),
    claims: claimTopics.map(ct => ct.claim),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
