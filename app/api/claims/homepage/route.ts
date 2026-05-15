import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// All filtering/sorting/search happens client-side after this single fetch.
// Works fine up to ~2000 claims. Above that, server-side pagination becomes necessary — not built yet.
export async function GET() {
  const claims = await prisma.claim.findMany({
    where: {
      deleted: false,
      parentClaimId: null,
      AND: [
        { NOT: { text: { contains: "SARS", mode: "insensitive" } } },
        { NOT: { text: { contains: "COVID", mode: "insensitive" } } },
        { NOT: { text: { contains: "coronavirus", mode: "insensitive" } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { edges: { where: { deleted: false } } } },
      children: {
        where: { deleted: false },
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { edges: { where: { deleted: false } } } },
        },
      },
      // Source names + URLs for client-side search
      edges: {
        where: { deleted: false },
        select: { source: { select: { name: true, url: true } } },
      },
      // Threshold notes for client-side search
      thresholdEvents: {
        where: { deleted: false },
        select: { note: true },
      },
      // Topics for chips + client-side filtering
      topics: {
        select: { topic: { select: { id: true, name: true, slug: true, domain: true } } },
      },
    },
  });

  return NextResponse.json({ claims });
}
