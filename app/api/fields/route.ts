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

// Count claims per AcademicField via Claim → ClaimTopic → Topic → AcademicField.
async function fetchClaimCountsByField(fieldIds: number[]): Promise<Map<number, number>> {
  if (fieldIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ field_id: number; cnt: bigint }[]>`
    SELECT t."academicFieldId" AS field_id, COUNT(ct."claimId") AS cnt
    FROM "Topic" t
    JOIN "ClaimTopic" ct ON ct."topicId" = t.id
    WHERE t."academicFieldId" = ANY(${fieldIds})
    GROUP BY t."academicFieldId"
  `;
  return new Map(rows.map(r => [r.field_id, Number(r.cnt)]));
}

// GET /api/fields
// ?parent=<slug>  — drill into a field's direct children (defaults to top-level, level=0)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentSlug = searchParams.get("parent");

  if (parentSlug) {
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
        _count: { select: { topics: true } },
        topics: {
          select: { id: true, name: true, slug: true, domain: true },
        },
      },
    });

    const counts = await fetchClaimCountsByField(children.map(f => f.id));

    const nodes: AcademicFieldNode[] = children.map(f => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      level: f.level,
      claimCount: counts.get(f.id) ?? 0,
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
      _count: { select: { topics: true } },
      topics: {
        select: { id: true, name: true, slug: true, domain: true },
      },
      children: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { topics: true } },
          topics: {
            select: { id: true, name: true, slug: true, domain: true },
          },
        },
      },
    },
  });

  const allFieldIds = topLevel.flatMap(f => [f.id, ...f.children.map(c => c.id)]);
  const counts = await fetchClaimCountsByField(allFieldIds);

  const nodes: AcademicFieldNode[] = topLevel.map(f => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    level: f.level,
    claimCount: counts.get(f.id) ?? 0,
    topicCount: f._count.topics,
    topics: f.topics,
    children: f.children.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      level: c.level,
      claimCount: counts.get(c.id) ?? 0,
      topicCount: c._count.topics,
      topics: c.topics,
      children: [],
    })),
  }));

  return NextResponse.json({ fields: nodes });
}
