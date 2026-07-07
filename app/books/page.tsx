import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BooksClient, { type SerializedBook } from "./BooksClient";


export const metadata = {
  title: 'Books — Epistemic Receipts',
  description:
    'Book analysis — match book passages against the sourced claims in the graph.',
};

export const dynamic = "force-dynamic";

export default async function BooksPage() {
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

  const enriched: SerializedBook[] = await Promise.all(
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
        ingestedAt: b.ingestedAt.toISOString(),
        chunkCount: b._count.chunks,
        claimCount,
        matchCount,
      };
    }),
  );

  return (
    <div className="text-neutral-100">
      <header className="mb-6">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          ← Home
        </Link>
        <h1 className="text-3xl font-semibold mt-3">Books</h1>
        <p className="text-neutral-400 mt-1 text-sm">
          Ingested books, their extracted claims, and matches against the
          knowledge graph. Trigger a fresh DB match per book.
        </p>
      </header>

      <BooksClient books={enriched} />
    </div>
  );
}
