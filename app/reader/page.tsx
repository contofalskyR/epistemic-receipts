import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ReaderIndexPage() {
  const books = await prisma.book.findMany({
    orderBy: { ingestedAt: "desc" },
    include: {
      _count: { select: { chunks: true } },
    },
  });

  return (
    <div className="text-neutral-100">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Reader</h1>
        <p className="text-neutral-400 mt-1 text-sm">
          Books ingested through the analysis pipeline.
        </p>
      </header>

      {books.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          No books ingested yet. Run{" "}
          <code className="text-neutral-300">
            npx tsx scripts/ingest-book.ts &lt;path&gt; &lt;title&gt; [author]
          </code>{" "}
          to ingest one.
        </p>
      ) : (
        <ul className="space-y-3">
          {books.map((b) => (
            <li
              key={b.id}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-4"
            >
              <Link
                href={`/reader/${b.id}`}
                className="text-lg font-medium text-neutral-100 hover:text-blue-400"
              >
                {b.title}
              </Link>
              {b.author && (
                <p className="text-neutral-400 text-sm mt-1">by {b.author}</p>
              )}
              <p className="text-xs text-neutral-500 mt-2">
                {b._count.chunks} paragraphs · ingested{" "}
                {b.ingestedAt.toISOString().slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
