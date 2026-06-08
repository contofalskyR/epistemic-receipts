import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type FieldDetailResponse = {
  field: {
    id: number;
    name: string;
    slug: string;
    level: number;
    parent: { id: number; name: string; slug: string; level: number } | null;
    claimCount: number;
    topicCount: number;
  };
  children: {
    id: number;
    name: string;
    slug: string;
    level: number;
    claimCount: number;
    topicCount: number;
  }[];
  topics: {
    id: string;
    name: string;
    slug: string;
    domain: string;
    claimCount: number;
  }[];
  recentClaims: {
    id: string;
    text: string;
    currentStatus: string;
    epistemicAxis: string | null;
    verificationStatus: string | null;
    claimEmergedAt: string | null;
  }[];
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const field = await prisma.academicField.findUnique({
    where: { slug },
    include: {
      parent: { select: { id: true, name: true, slug: true, level: true } },
      _count: { select: { topics: true } },
    },
  });

  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  const [children, topics] = await Promise.all([
    prisma.academicField.findMany({
      where: { parentId: field.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { topics: true } } },
    }),
    prisma.topic.findMany({
      where: { academicFieldId: field.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { claims: true } } },
    }),
  ]);

  // Sum claim counts across topics for this field
  const fieldClaimCount = topics.reduce((sum, t) => sum + t._count.claims, 0);

  // Recent claims via topics (since Claim.academicFieldId was removed)
  const topicIds = topics.map(t => t.id);
  const recentClaims = topicIds.length > 0
    ? await prisma.claim.findMany({
        where: {
          deleted: false,
          topics: { some: { topicId: { in: topicIds } } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          text: true,
          currentStatus: true,
          epistemicAxis: true,
          verificationStatus: true,
          claimEmergedAt: true,
        },
      })
    : [];

  // Claim counts per child field via topics
  const childIds = children.map(c => c.id);
  const childClaimCountMap = new Map<number, number>();
  if (childIds.length > 0) {
    const childTopics = await prisma.topic.findMany({
      where: { academicFieldId: { in: childIds } },
      include: { _count: { select: { claims: true } } },
    });
    for (const ct of childTopics) {
      if (ct.academicFieldId == null) continue;
      const prev = childClaimCountMap.get(ct.academicFieldId) ?? 0;
      childClaimCountMap.set(ct.academicFieldId, prev + ct._count.claims);
    }
  }

  const response: FieldDetailResponse = {
    field: {
      id: field.id,
      name: field.name,
      slug: field.slug,
      level: field.level,
      parent: field.parent,
      claimCount: fieldClaimCount,
      topicCount: field._count.topics,
    },
    children: children.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      level: c.level,
      claimCount: childClaimCountMap.get(c.id) ?? 0,
      topicCount: c._count.topics,
    })),
    topics: topics.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      domain: t.domain,
      claimCount: t._count.claims,
    })),
    recentClaims: recentClaims.map(c => ({
      id: c.id,
      text: c.text,
      currentStatus: c.currentStatus,
      epistemicAxis: (c as { epistemicAxis?: string | null }).epistemicAxis ?? null,
      verificationStatus: c.verificationStatus,
      claimEmergedAt: c.claimEmergedAt?.toISOString() ?? null,
    })),
  };

  return NextResponse.json(response);
}
