import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const books = await prisma.book.findMany({
    orderBy: { ingestedAt: "desc" },
    select: {
      id: true,
      title: true,
      author: true,
      sourceUrl: true,
      ingestedAt: true,
      _count: { select: { chunks: true } },
    },
  });

  const enriched = await Promise.all(
    books.map(async (b) => {
      const [claimCount, matchCount] = await Promise.all([
        prisma.bookClaim.count({ where: { chunk: { bookId: b.id } } }),
        prisma.bookClaimMatch.count({
          where: { bookClaim: { chunk: { bookId: b.id } } },
        }),
      ]);
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        sourceUrl: b.sourceUrl,
        ingestedAt: b.ingestedAt,
        chunkCount: b._count.chunks,
        claimCount,
        matchCount,
      };
    }),
  );

  return NextResponse.json({ books: enriched });
}
