import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReaderProps = { params: Promise<{ bookId: string }> };

const ARC_COLOR: Record<string, string> = {
  SUPPORTS: "#22c55e",
  CONTRADICTS: "#ef4444",
  RELATED: "#3b82f6",
  UNVERIFIED: "#9ca3af",
};

function arcColor(t: string): string {
  return ARC_COLOR[t] ?? ARC_COLOR.UNVERIFIED;
}

// Deterministic non-negative hash of a string (djb2).
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

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

  const allClaims = book.chunks.flatMap((c) => c.claims);
  const allMatches = allClaims.flatMap((bc) =>
    bc.matches.map((m) => ({
      bookClaimId: bc.id,
      bookPosition: bc.positionIndex,
      claimId: m.claimId,
      matchType: m.matchType,
      similarityScore: m.similarityScore,
    })),
  );

  const totalPositions = Math.max(allClaims.length, 1);
  const claimsCount = allClaims.length;
  const matchesCount = allMatches.length;

  // SVG geometry per spec: 800 wide x 200 tall
  const W = 800;
  const H = 200;
  const PAD = 16;
  const usable = W - 2 * PAD;
  const axisY = H - 20;
  const xFor = (pos: number) =>
    totalPositions <= 1
      ? PAD + usable / 2
      : PAD + (pos / (totalPositions - 1)) * usable;
  const maxArcHeight = axisY - PAD;

  return (
    <div className="text-neutral-100">
      <header className="mb-6">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Home
        </Link>
        <h1 className="text-3xl font-semibold mt-3">{book.title}</h1>
        {book.author && <p className="text-neutral-400 mt-1">by {book.author}</p>}
        <p className="text-xs text-neutral-500 mt-2">
          {book.chunks.length} paragraphs · {claimsCount} claims ·{" "}
          {matchesCount} receipt matches
        </p>
      </header>

      <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-8">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-3">
          <span>BibleViz-style arc diagram — book claim positions ↔ matched receipts</span>
          <Legend />
        </div>
        {claimsCount === 0 ? (
          <p className="text-neutral-500 text-sm py-12 text-center">
            No claims extracted yet.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height="auto"
            role="img"
            aria-label="Arc diagram of book claims and matched receipts"
            style={{ maxWidth: W }}
          >
            {/* X-axis bar — one unit per claim position */}
            <line
              x1={PAD}
              x2={W - PAD}
              y1={axisY}
              y2={axisY}
              stroke="#3f3f46"
              strokeWidth={1}
            />

            {/* Arcs (quadratic beziers) */}
            {allMatches.map((m, i) => {
              const fromPos = m.bookPosition;
              const toPos = hash(m.claimId) % totalPositions;
              const x1 = xFor(fromPos);
              const x2 = xFor(toPos);
              const distance = Math.abs(toPos - fromPos);
              // Arc height proportional to distance between endpoints.
              const heightRatio = totalPositions <= 1 ? 0 : distance / (totalPositions - 1);
              const peak = axisY - heightRatio * maxArcHeight;
              const midX = (x1 + x2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${axisY} Q ${midX} ${peak}, ${x2} ${axisY}`}
                  fill="none"
                  stroke={arcColor(m.matchType)}
                  strokeWidth={0.8}
                  strokeOpacity={0.55}
                />
              );
            })}

            {/* Tick marks for each book-claim position */}
            {allClaims.map((bc) => (
              <circle
                key={bc.id}
                cx={xFor(bc.positionIndex)}
                cy={axisY}
                r={1.4}
                fill="#e5e7eb"
              />
            ))}

            {/* Axis labels */}
            <text x={PAD} y={H - 4} fill="#a1a1aa" fontSize={10}>
              ¶ start
            </text>
            <text
              x={W - PAD}
              y={H - 4}
              fill="#a1a1aa"
              fontSize={10}
              textAnchor="end"
            >
              ¶ end · {claimsCount} positions
            </text>
          </svg>
        )}
      </section>

      <section className="space-y-4">
        {book.chunks.map((ch) => {
          const matchedClaimCount = ch.claims.filter(
            (bc) => bc.matches.length > 0,
          ).length;
          return (
            <article
              key={ch.id}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-neutral-500">
                <span>¶ {ch.paragraphIndex + 1}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                  {ch.claims.length} claim{ch.claims.length === 1 ? "" : "s"}
                </span>
                {matchedClaimCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950 text-blue-300">
                    {matchedClaimCount} matched
                  </span>
                )}
              </div>
              <p className="text-neutral-200 leading-relaxed whitespace-pre-wrap">
                {ch.text}
              </p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Legend() {
  const entries: [string, string][] = [
    ["SUPPORTS", "supports"],
    ["CONTRADICTS", "contradicts"],
    ["RELATED", "related"],
    ["UNVERIFIED", "unverified"],
  ];
  return (
    <div className="flex gap-3">
      {entries.map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: arcColor(k) }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
