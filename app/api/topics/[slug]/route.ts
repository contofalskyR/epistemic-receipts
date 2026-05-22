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
  const party = req.nextUrl.searchParams.get("party") ?? "";
  const leader = req.nextUrl.searchParams.get("leader") ?? "";

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      parentTopic: {
        include: {
          parentTopic: { include: { parentTopic: true } },
        },
      },
      children: {
        include: {
          _count: { select: { claims: true } },
          children: {
            include: { _count: { select: { claims: true } } },
            orderBy: { name: "asc" },
          },
        },
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

  const showDeprecated = req.nextUrl.searchParams.get("deprecated") === "1";
  const baseClaimFilter = {
    deleted: false,
    ...(showDeprecated ? {} : { NOT: { verificationStatus: "DEPRECATED" } }),
  };
  const pcFilter = party || leader ? {
    edges: {
      some: {
        source: {
          politicalContext: {
            ...(party ? { hogParty: party } : {}),
            ...(leader ? { headOfGovernment: leader } : {}),
          },
        },
      },
    },
  } : {};

  // Include claims from children and grandchildren so container topics
  // (Congress → Era → Session) aggregate all descendant claims.
  const grandchildIds = topic.children.flatMap(c => c.children.map((gc: { id: string }) => gc.id));
  const topicIds = [topic.id, ...topic.children.map(c => c.id), ...grandchildIds];
  const claimWhere = {
    topicId: { in: topicIds },
    claim: { ...baseClaimFilter, ...pcFilter },
  };

  const claimOrderBy =
    sort === "most_sources"
      ? { claim: { edges: { _count: "desc" as const } } }
      : sort === "emerged_asc"
        ? { claim: { claimEmergedAt: "asc" as const } }
        : { claim: { claimEmergedAt: "desc" as const } };

  const [total, claimTopics, distinctParties] = await Promise.all([
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
            edges: {
              where: { deleted: false },
              select: { source: { select: { politicalContext: { select: { hogParty: true, headOfGovernment: true } } } } },
              take: 5,
            },
          },
        },
      },
    }),
    prisma.politicalContext.findMany({
      where: {
        hogParty: { not: null },
        source: {
          edges: {
            some: {
              deleted: false,
              claim: {
                ...baseClaimFilter,
                topics: { some: { topicId: { in: topicIds } } },
              },
            },
          },
        },
      },
      distinct: ["hogParty"],
      select: { hogParty: true },
      orderBy: { hogParty: "asc" },
    }),
  ]);

  const partyNames = distinctParties
    .map(pc => pc.hogParty)
    .filter((p): p is string => p !== null);

  const partyCounts = await Promise.all(
    partyNames.map(p =>
      prisma.claimTopic.count({
        where: {
          topicId: { in: topicIds },
          claim: {
            ...baseClaimFilter,
            edges: { some: { source: { politicalContext: { hogParty: p } } } },
          },
        },
      }).then(count => ({ party: p, claimCount: count }))
    )
  );

  const availableParties = partyCounts.sort((a, b) => b.claimCount - a.claimCount);

  // When a party is selected, return the distinct leaders within that party for sub-filtering
  let availableLeaders: { leader: string; claimCount: number }[] = [];
  if (party) {
    const distinctLeaders = await prisma.politicalContext.findMany({
      where: {
        hogParty: party,
        headOfGovernment: { not: null },
        source: {
          edges: {
            some: {
              deleted: false,
              claim: { ...baseClaimFilter, topics: { some: { topicId: { in: topicIds } } } },
            },
          },
        },
      },
      distinct: ["headOfGovernment"],
      select: { headOfGovernment: true },
    });

    const leaderNames = distinctLeaders
      .map(l => l.headOfGovernment)
      .filter((l): l is string => l !== null);

    availableLeaders = await Promise.all(
      leaderNames.map(l =>
        prisma.claimTopic.count({
          where: {
            topicId: { in: topicIds },
            claim: {
              ...baseClaimFilter,
              edges: {
                some: {
                  source: {
                    politicalContext: { hogParty: party, headOfGovernment: l },
                  },
                },
              },
            },
          },
        }).then(count => ({ leader: l, claimCount: count }))
      )
    );
    availableLeaders.sort((a, b) => b.claimCount - a.claimCount);
  }

  return NextResponse.json({
    topic: {
      id: topic.id, name: topic.name, slug: topic.slug,
      domain: topic.domain, description: topic.description,
      parentTopicId: topic.parentTopicId,
      children: topic.children.map(c => ({
        id: c.id, name: c.name, slug: c.slug,
        claimCount: c._count.claims + c.children.reduce((sum: number, gc: { _count: { claims: number } }) => sum + gc._count.claims, 0),
      })),
    },
    parentChain: buildParentChain(topic),
    siblings: siblings.map(s => ({ id: s.id, name: s.name, slug: s.slug, claimCount: s._count.claims })),
    claims: claimTopics.map(ct => ct.claim),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    availableParties,
    availableLeaders,
  });
}
