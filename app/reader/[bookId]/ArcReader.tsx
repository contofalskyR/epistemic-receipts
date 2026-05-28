"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Match = {
  id: string;
  receiptClaimId: string;
  similarityScore: number;
  matchType: string;
};

type BookClaim = {
  id: string;
  claimText: string;
  positionIndex: number;
  matches: Match[];
};

type Chunk = {
  id: string;
  paragraphIndex: number;
  text: string;
  claims: BookClaim[];
};

type Receipt = {
  id: string;
  text: string;
  currentStatus: string;
  verificationStatus: string | null;
  ingestedBy: string;
};

const MATCH_COLOR: Record<string, string> = {
  SUPPORTS:    "#22c55e", // green-500
  CONTRADICTS: "#ef4444", // red-500
  RELATED:     "#3b82f6", // blue-500
  UNVERIFIED:  "#9ca3af", // gray-400
};

function matchColor(t: string): string {
  return MATCH_COLOR[t] ?? MATCH_COLOR.UNVERIFIED;
}

export default function ArcReader({
  chunks,
  receipts,
}: {
  chunks: Chunk[];
  receipts: Record<string, Receipt>;
}) {
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

  // Build the global x-axis: every BookClaim, then every unique matched
  // receipt claim, in the order they first appear (BibleViz-style: both
  // endpoints share a single axis).
  const { positions, claimById, totalCount } = useMemo(() => {
    const positions = new Map<string, number>();
    const claimById = new Map<string, BookClaim>();
    for (const ch of chunks) {
      for (const bc of ch.claims) {
        positions.set(`book:${bc.id}`, positions.size);
        claimById.set(bc.id, bc);
      }
    }
    for (const ch of chunks) {
      for (const bc of ch.claims) {
        for (const m of bc.matches) {
          const key = `receipt:${m.receiptClaimId}`;
          if (!positions.has(key)) positions.set(key, positions.size);
        }
      }
    }
    return { positions, claimById, totalCount: positions.size };
  }, [chunks]);

  const allArcs = useMemo(() => {
    const arcs: {
      bookClaimId: string;
      from: number;
      to: number;
      matchType: string;
      score: number;
      receiptId: string;
    }[] = [];
    for (const ch of chunks) {
      for (const bc of ch.claims) {
        const from = positions.get(`book:${bc.id}`)!;
        for (const m of bc.matches) {
          const to = positions.get(`receipt:${m.receiptClaimId}`)!;
          arcs.push({
            bookClaimId: bc.id,
            from,
            to,
            matchType: m.matchType,
            score: m.similarityScore,
            receiptId: m.receiptClaimId,
          });
        }
      }
    }
    return arcs;
  }, [chunks, positions]);

  // SVG geometry
  const VIEW_WIDTH = 1000;
  const PAD = 20;
  const AXIS_Y = 360;
  const usable = VIEW_WIDTH - 2 * PAD;
  const xFor = (pos: number) =>
    totalCount <= 1 ? PAD : PAD + (pos / (totalCount - 1)) * usable;

  const bookClaimCount = chunks.reduce((s, c) => s + c.claims.length, 0);
  const receiptCount = totalCount - bookClaimCount;

  return (
    <>
      {/* Arc diagram */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-8">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-3">
          <span>BibleViz-style arc diagram — book claims (left) ↔ matched receipts (right)</span>
          <Legend />
        </div>
        {totalCount === 0 ? (
          <p className="text-neutral-500 text-sm py-12 text-center">
            No claims extracted yet.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${AXIS_Y + 40}`}
            className="w-full h-auto"
            role="img"
            aria-label="Arc diagram of book claims and matched receipts"
          >
            {/* Axis */}
            <line
              x1={PAD}
              x2={VIEW_WIDTH - PAD}
              y1={AXIS_Y}
              y2={AXIS_Y}
              stroke="#3f3f46"
              strokeWidth={1}
            />
            {/* Split marker between book claims and receipt claims */}
            {receiptCount > 0 && (
              <line
                x1={xFor(bookClaimCount - 0.5)}
                x2={xFor(bookClaimCount - 0.5)}
                y1={AXIS_Y - 6}
                y2={AXIS_Y + 6}
                stroke="#71717a"
                strokeDasharray="2,2"
              />
            )}

            {/* Arcs */}
            {allArcs.map((arc, i) => {
              const x1 = xFor(arc.from);
              const x2 = xFor(arc.to);
              const mid = (x1 + x2) / 2;
              const radius = Math.abs(x2 - x1) / 2;
              const isActive = activeClaimId === arc.bookClaimId;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${AXIS_Y} A ${radius} ${radius} 0 0 1 ${x2} ${AXIS_Y}`}
                  fill="none"
                  stroke={matchColor(arc.matchType)}
                  strokeWidth={isActive ? 1.8 : 0.7}
                  strokeOpacity={
                    activeClaimId === null
                      ? 0.45
                      : isActive
                        ? 1
                        : 0.08
                  }
                  style={{ pointerEvents: "none" }}
                  data-mid={mid}
                />
              );
            })}

            {/* Tick dots (book claims = white, receipts = neutral) */}
            {Array.from(positions.entries()).map(([key, pos]) => {
              const isBook = key.startsWith("book:");
              return (
                <circle
                  key={key}
                  cx={xFor(pos)}
                  cy={AXIS_Y}
                  r={isBook ? 2.2 : 1.6}
                  fill={isBook ? "#e5e7eb" : "#6b7280"}
                />
              );
            })}

            {/* Labels */}
            <text x={PAD} y={AXIS_Y + 26} fill="#a1a1aa" fontSize={11}>
              {bookClaimCount} book claims
            </text>
            <text
              x={VIEW_WIDTH - PAD}
              y={AXIS_Y + 26}
              fill="#a1a1aa"
              fontSize={11}
              textAnchor="end"
            >
              {receiptCount} matched receipts
            </text>
          </svg>
        )}
      </section>

      {/* Book text with paragraph badges */}
      <section className="space-y-6">
        {chunks.map((ch) => (
          <ChunkBlock
            key={ch.id}
            chunk={ch}
            receipts={receipts}
            activeClaimId={activeClaimId}
            onActivate={setActiveClaimId}
          />
        ))}
      </section>
    </>
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
            style={{ background: matchColor(k) }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function ChunkBlock({
  chunk,
  receipts,
  activeClaimId,
  onActivate,
}: {
  chunk: Chunk;
  receipts: Record<string, Receipt>;
  activeClaimId: string | null;
  onActivate: (id: string | null) => void;
}) {
  const claimCount = chunk.claims.length;
  const matchCount = chunk.claims.reduce((s, bc) => s + bc.matches.length, 0);
  return (
    <article className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2 text-xs text-neutral-500">
        <span>¶ {chunk.paragraphIndex + 1}</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
          {claimCount} claim{claimCount === 1 ? "" : "s"}
        </span>
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950 text-blue-300">
            {matchCount} match{matchCount === 1 ? "" : "es"}
          </span>
        )}
      </div>
      <p className="text-neutral-200 leading-relaxed whitespace-pre-wrap">
        {chunk.text}
      </p>
      {chunk.claims.length > 0 && (
        <ul className="mt-3 space-y-2">
          {chunk.claims.map((bc) => (
            <ClaimRow
              key={bc.id}
              claim={bc}
              receipts={receipts}
              activeClaimId={activeClaimId}
              onActivate={onActivate}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function ClaimRow({
  claim,
  receipts,
  activeClaimId,
  onActivate,
}: {
  claim: BookClaim;
  receipts: Record<string, Receipt>;
  activeClaimId: string | null;
  onActivate: (id: string | null) => void;
}) {
  const active = activeClaimId === claim.id;
  return (
    <li
      className={`rounded border ${active ? "border-blue-500/60 bg-blue-950/30" : "border-neutral-800 bg-neutral-950/50"} p-3 cursor-pointer transition-colors`}
      onMouseEnter={() => onActivate(claim.id)}
      onMouseLeave={() => onActivate(null)}
      onClick={() => onActivate(active ? null : claim.id)}
    >
      <div className="flex items-start gap-3">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1 shrink-0">
          #{claim.positionIndex}
        </span>
        <div className="flex-1">
          <p className="text-sm text-neutral-200">{claim.claimText}</p>
          {claim.matches.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {claim.matches.map((m) => {
                const r = receipts[m.receiptClaimId];
                return (
                  <li
                    key={m.id}
                    className="text-xs flex items-start gap-2 pl-2 border-l-2"
                    style={{ borderColor: matchColor(m.matchType) }}
                  >
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] uppercase"
                      style={{
                        background: matchColor(m.matchType) + "22",
                        color: matchColor(m.matchType),
                      }}
                    >
                      {m.matchType}
                    </span>
                    <span className="text-neutral-500 shrink-0">
                      {m.similarityScore.toFixed(3)}
                    </span>
                    {r ? (
                      <Link
                        href={`/claims/${r.id}`}
                        className="text-neutral-300 hover:text-blue-400"
                      >
                        {r.text}
                      </Link>
                    ) : (
                      <span className="text-neutral-500 italic">
                        (claim deleted)
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500 mt-1 italic">
              no matches above threshold
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
