import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ArcReader from "./ArcReader";

export const dynamic = "force-dynamic";

type ReaderProps = { params: Promise<{ bookId: string }> };

export default async function ReaderPage({ params }: ReaderProps) {
  const { bookId } = await params;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chunks: {
        orderBy: { paragraphIndex: "asc" },
        include: {
          claims: {
            orderBy: { positionIndex: "asc" },
            include: { matches: true },
          },
        },
      },
    },
  });

  if (!book) notFound();

  // Collect every receipt-claim id that appears in any match, then fetch them
  // in one query so we can render claim text + links without an N+1.
  const receiptIds = Array.from(
    new Set(
      book.chunks.flatMap((c) =>
        c.claims.flatMap((bc) => bc.matches.map((m) => m.claimId)),
      ),
    ),
  );
  const receipts = await prisma.claim.findMany({
    where: { id: { in: receiptIds } },
    select: {
      id: true,
      text: true,
      currentStatus: true,
      verificationStatus: true,
      ingestedBy: true,
    },
  });
  const receiptById = new Map(receipts.map((r) => [r.id, r]));

  const claimsCount = book.chunks.reduce((s, c) => s + c.claims.length, 0);
  const matchesCount = book.chunks.reduce(
    (s, c) => s + c.claims.reduce((s2, bc) => s2 + bc.matches.length, 0),
    0,
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
            ← Home
          </Link>
          <h1 className="text-3xl font-semibold mt-3">{book.title}</h1>
          {book.author && (
            <p className="text-neutral-400 mt-1">by {book.author}</p>
          )}
          <p className="text-xs text-neutral-500 mt-2">
            {book.chunks.length} paragraphs · {claimsCount} claims ·{" "}
            {matchesCount} receipt matches
          </p>
        </header>

        <ArcReader
          chunks={book.chunks.map((c) => ({
            id: c.id,
            paragraphIndex: c.paragraphIndex,
            text: c.text,
            claims: c.claims.map((bc) => ({
              id: bc.id,
              claimText: bc.claimText,
              positionIndex: bc.positionIndex,
              matches: bc.matches.map((m) => ({
                id: m.id,
                receiptClaimId: m.claimId,
                similarityScore: m.similarityScore,
                matchType: m.matchType,
              })),
            })),
          }))}
          receipts={Object.fromEntries(
            receipts.map((r) => [
              r.id,
              {
                id: r.id,
                text: r.text,
                currentStatus: r.currentStatus,
                verificationStatus: r.verificationStatus,
                ingestedBy: r.ingestedBy,
              },
            ]),
          )}
        />
      </div>
    </main>
  );
}
