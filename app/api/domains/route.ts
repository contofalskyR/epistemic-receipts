import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const topics = await prisma.topic.findMany({
    select: { domain: true },
  });

  const counts: Record<string, number> = {};
  for (const t of topics) {
    counts[t.domain] = (counts[t.domain] ?? 0) + 1;
  }

  const domains = Object.entries(counts)
    .map(([domain, topicCount]) => ({ domain, topicCount }))
    .sort((a, b) => a.domain.localeCompare(b.domain));

  return NextResponse.json({ domains });
}
