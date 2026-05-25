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
      _count: { select: { claims: true, topics: true } },
    },
  });

  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  const [children, topics, recentClaims] = await Promise.all([
    prisma.academicField.findMany({
      where: { parentId: field.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { claims: true, topics: true } } },
    }),
    prisma.topic.findMany({
      where: { academicFieldId: field.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { claims: true } } },
    }),
    prisma.claim.findMany({
      where: { academicFieldId: field.id, deleted: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        text: true,
        currentStatus: true,
        verificationStatus: true,
        claimEmergedAt: true,
      },
    }),
  ]);

  const response: FieldDetailResponse = {
    field: {
      id: field.id,
      name: field.name,
      slug: field.slug,
      level: field.level,
      parent: field.parent,
      claimCount: field._count.claims,
      topicCount: field._count.topics,
    },
    children: children.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      level: c.level,
      claimCount: c._count.claims,
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
      verificationStatus: c.verificationStatus,
      claimEmergedAt: c.claimEmergedAt?.toISOString() ?? null,
    })),
  };

  return NextResponse.json(response);
}
