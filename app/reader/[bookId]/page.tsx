import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ReaderClient, { type SerializedBook } from "./ReaderClient";

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
            include: {
              matches: {
                include: {
                  claim: {
                    select: { id: true, text: true, epistemicAxis: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!book) notFound();

  const allClaims = book.chunks.flatMap((c) => c.claims);
  const allMatches = allClaims.flatMap((bc) => bc.matches);
  const claimsCount = allClaims.length;
  const matchesCount = allMatches.length;

  const serialized: SerializedBook = {
    title: book.title,
    author: book.author,
    chunks: book.chunks.map((ch) => ({
      id: ch.id,
      paragraphIndex: ch.paragraphIndex,
      text: ch.text,
      claims: ch.claims.map((bc) => ({
        id: bc.id,
        claimText: bc.claimText,
        positionIndex: bc.positionIndex,
        matches: bc.matches.map((m) => ({
          id: m.id,
          claimId: m.claimId,
          matchType: m.matchType,
          similarityScore: m.similarityScore,
          reason: m.reason ?? null,
          claim: {
            id: m.claim.id,
            text: m.claim.text,
            epistemicAxis: m.claim.epistemicAxis ?? null,
          },
        })),
      })),
    })),
  };

  return (
    <div className="text-neutral-100">
      <header className="mb-6">
        <Link href="/books" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Books
        </Link>
        <h1 className="text-3xl font-semibold mt-3">{book.title}</h1>
        {book.author && <p className="text-neutral-400 mt-1">by {book.author}</p>}
        <p className="text-xs text-neutral-500 mt-2">
          {book.chunks.length} paragraphs · {claimsCount} claims ·{" "}
          {matchesCount} receipt matches
        </p>
      </header>

      <ReaderClient book={serialized} />
    </div>
  );
}
