import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export async function GET() {
  const groups = await prisma.topic.groupBy({
    by: ["domain"],
    _count: { _all: true },
    orderBy: { domain: "asc" },
  });

  const domains = groups.map(g => ({ domain: g.domain, topicCount: g._count._all }));
  return NextResponse.json({ domains });
}
