import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BooksClient, { type SerializedBook } from "./BooksClient";

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

      <section className="mt-10 rounded-md border border-neutral-800 bg-neutral-900/40 p-4">
        <h2 className="text-sm font-semibold text-neutral-200 mb-2">
          Add a book
        </h2>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Book upload through the UI is not wired up yet. To ingest a new book,
          run from the project root:
        </p>
        <pre className="mt-2 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded p-2 overflow-x-auto">
{`npx ts-node --project tsconfig.scripts.json scripts/ingest-book.ts <path> <title> [author]`}
        </pre>
        <p className="text-xs text-neutral-500 mt-2">
          Once ingested, the book appears here and the{" "}
          <span className="text-neutral-300">Match against DB</span> button will
          run{" "}
          <code className="text-neutral-300">match-book-to-graph.ts</code> as a
          background job.
        </p>
      </section>
    </div>
  );
}
