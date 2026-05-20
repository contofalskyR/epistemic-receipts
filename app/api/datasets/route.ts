import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const stats = await prisma.source.groupBy({
    by: ["ingestedBy"],
    where: { deleted: false },
    _count: { id: true },
    _max: { createdAt: true },
    orderBy: { _count: { id: "desc" } },
  });

  const result = stats.map((row) => ({
    ingestedBy: row.ingestedBy,
    count: row._count.id,
    lastIngestedAt: row._max.createdAt,
  }));

  return NextResponse.json(result);
}
