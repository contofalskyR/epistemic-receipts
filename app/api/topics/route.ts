import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Returns the full topic tree nested by domain.
// Each topic node includes claimCount (direct tags only, not inherited from children).
export async function GET() {
  const topics = await prisma.topic.findMany({
    orderBy: [{ domain: "asc" }, { name: "asc" }],
    include: { _count: { select: { claims: true } } },
  });

  type Node = {
    id: string; name: string; slug: string; domain: string;
    description: string | null; parentTopicId: string | null;
    claimCount: number; children: Node[];
  };

  const byId = new Map<string, Node>();
  const roots: Node[] = [];

  for (const t of topics) {
    byId.set(t.id, {
      id: t.id, name: t.name, slug: t.slug, domain: t.domain,
      description: t.description, parentTopicId: t.parentTopicId,
      claimCount: t._count.claims, children: [],
    });
  }

  for (const t of topics) {
    const node = byId.get(t.id)!;
    if (t.parentTopicId) {
      byId.get(t.parentTopicId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const domains: Record<string, Node[]> = {};
  for (const root of roots) {
    if (!domains[root.domain]) domains[root.domain] = [];
    domains[root.domain].push(root);
  }

  return NextResponse.json({ domains });
}
