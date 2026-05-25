import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type FieldTopic = {
  id: string;
  name: string;
  slug: string;
  domain: string;
};

export type AcademicFieldNode = {
  id: number;
  name: string;
  slug: string;
  level: number;
  claimCount: number;
  topicCount: number;
  children: AcademicFieldNode[];
  topics: FieldTopic[];
};

// GET /api/fields
// ?parent=<slug>  — drill into a field's direct children (defaults to top-level, level=0)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentSlug = searchParams.get("parent");

  if (parentSlug) {
    // Drill into children of the given parent
    const parent = await prisma.academicField.findUnique({
      where: { slug: parentSlug },
      select: { id: true, name: true, slug: true, level: true, parentId: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    const children = await prisma.academicField.findMany({
      where: { parentId: parent.id },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { claims: true, topics: true } },
        topics: {
          select: { id: true, name: true, slug: true, domain: true },
        },
      },
    });

    const nodes: AcademicFieldNode[] = children.map(f => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      level: f.level,
      claimCount: f._count.claims,
      topicCount: f._count.topics,
      children: [],
      topics: f.topics,
    }));

    return NextResponse.json({ parent, fields: nodes });
  }

  // Default: top-level fields (level 0)
  const topLevel = await prisma.academicField.findMany({
    where: { level: 0 },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { claims: true, topics: true } },
      topics: {
        select: { id: true, name: true, slug: true, domain: true },
      },
      children: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { claims: true, topics: true } },
          topics: {
            select: { id: true, name: true, slug: true, domain: true },
          },
        },
      },
    },
  });

  const nodes: AcademicFieldNode[] = topLevel.map(f => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    level: f.level,
    claimCount: f._count.claims,
    topicCount: f._count.topics,
    topics: f.topics,
    children: f.children.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      level: c.level,
      claimCount: c._count.claims,
      topicCount: c._count.topics,
      topics: c.topics,
      children: [],
    })),
  }));

  return NextResponse.json({ fields: nodes });
}
