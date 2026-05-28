"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type SerializedMatchedClaim = {
  id: string;
  text: string;
  currentStatus: string;
};

type SerializedMatch = {
  id: string;
  claimId: string;
  matchType: string;
  similarityScore: number;
  claim: SerializedMatchedClaim;
};

type SerializedBookClaim = {
  id: string;
  claimText: string;
  positionIndex: number;
  matches: SerializedMatch[];
};

type SerializedChunk = {
  id: string;
  paragraphIndex: number;
  text: string;
  claims: SerializedBookClaim[];
};

export type SerializedBook = {
  title: string;
  author: string | null;
  chunks: SerializedChunk[];
};

const ARC_COLOR: Record<string, string> = {
  SUPPORTS: "#22c55e",
  CONTRADICTS: "#ef4444",
  RELATED: "#3b82f6",
  UNVERIFIED: "#9ca3af",
};

function arcColor(t: string): string {
  return ARC_COLOR[t] ?? ARC_COLOR.UNVERIFIED;
}

const BADGE_CLASSES: Record<string, string> = {
  SUPPORTS: "bg-green-950 text-green-300 border border-green-800",
  CONTRADICTS: "bg-red-950 text-red-300 border border-red-800",
  RELATED: "bg-blue-950 text-blue-300 border border-blue-800",
  UNVERIFIED: "bg-neutral-800 text-neutral-400 border border-neutral-700",
};

function badgeClass(t: string): string {
  return BADGE_CLASSES[t] ?? BADGE_CLASSES.UNVERIFIED;
}

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
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
        <span key={k} className="inline-flex items-center gap-1 text-xs text-neutral-400">
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

export default function ReaderClient({ book }: { book: SerializedBook }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hoveredClaimId, setHoveredClaimId] = useState<string | null>(null);
  const paraRefs = useRef<Record<string, HTMLElement | null>>({});

  const allClaims = book.chunks.flatMap((c) =>
    c.claims.map((bc) => ({ ...bc, chunkId: c.id })),
  );
  const allMatches = allClaims.flatMap((bc) =>
    bc.matches.map((m) => ({
      bookClaimId: bc.id,
      bookPosition: bc.positionIndex,
      chunkId: bc.chunkId,
      claimId: m.claimId,
      matchType: m.matchType,
      similarityScore: m.similarityScore,
    })),
  );

  const claimToChunk: Record<string, string> = Object.fromEntries(
    allClaims.map((bc) => [bc.id, bc.chunkId]),
  );

  const totalPositions = Math.max(allClaims.length, 1);
  const claimsCount = allClaims.length;

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

  function scrollToChunk(chunkId: string) {
    const el = paraRefs.current[chunkId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setExpanded((prev) => ({ ...prev, [chunkId]: true }));
    }
  }

  function toggleExpand(chunkId: string) {
    setExpanded((prev) => ({ ...prev, [chunkId]: !prev[chunkId] }));
  }

  return (
    <>
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
            <line
              x1={PAD}
              x2={W - PAD}
              y1={axisY}
              y2={axisY}
              stroke="#3f3f46"
              strokeWidth={1}
            />

            {allMatches.map((m, i) => {
              const fromPos = m.bookPosition;
              const toPos = hash(m.claimId) % totalPositions;
              const x1 = xFor(fromPos);
              const x2 = xFor(toPos);
              const distance = Math.abs(toPos - fromPos);
              const heightRatio =
                totalPositions <= 1 ? 0 : distance / (totalPositions - 1);
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

            {allClaims.map((bc) => {
              const isHovered = hoveredClaimId === bc.id;
              return (
                <circle
                  key={bc.id}
                  cx={xFor(bc.positionIndex)}
                  cy={axisY}
                  r={isHovered ? 4 : 2}
                  fill={isHovered ? "#f5f5f5" : "#e5e7eb"}
                  style={{ cursor: "pointer", transition: "r 0.1s" }}
                  onMouseEnter={() => setHoveredClaimId(bc.id)}
                  onMouseLeave={() => setHoveredClaimId(null)}
                  onClick={() => scrollToChunk(claimToChunk[bc.id])}
                />
              );
            })}

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
          const matchedClaims = ch.claims.filter((bc) => bc.matches.length > 0);
          const matchedClaimCount = matchedClaims.length;
          const isExpanded = expanded[ch.id] ?? false;

          return (
            <article
              key={ch.id}
              ref={(el) => {
                paraRefs.current[ch.id] = el;
              }}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 scroll-mt-4"
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-neutral-500">
                <span>¶ {ch.paragraphIndex + 1}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                  {ch.claims.length} claim{ch.claims.length === 1 ? "" : "s"}
                </span>
                {matchedClaimCount > 0 && (
                  <button
                    onClick={() => toggleExpand(ch.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950 text-blue-300 hover:bg-blue-900 transition-colors cursor-pointer"
                  >
                    {matchedClaimCount} matched {isExpanded ? "▲" : "▼"}
                  </button>
                )}
              </div>

              <p className="text-neutral-200 leading-relaxed whitespace-pre-wrap">
                {ch.text}
              </p>

              {isExpanded && matchedClaims.length > 0 && (
                <div className="mt-4 space-y-4 border-t border-neutral-800 pt-3">
                  {matchedClaims.map((bc) => (
                    <div key={bc.id}>
                      <p className="text-xs text-neutral-300 font-medium mb-2 leading-snug">
                        {bc.claimText}
                      </p>
                      <ul className="space-y-1 pl-2 border-l border-neutral-700">
                        {bc.matches.map((m) => (
                          <li key={m.id}>
                            <Link
                              href={`/claims/${m.claimId}`}
                              className="flex items-start gap-2 hover:bg-neutral-800 rounded px-2 py-1.5 transition-colors group"
                            >
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 mt-0.5 ${badgeClass(m.matchType)}`}
                              >
                                {m.matchType}
                              </span>
                              <span className="text-neutral-400 text-xs group-hover:text-neutral-200 transition-colors leading-snug flex-1">
                                {m.claim.text.length > 120
                                  ? m.claim.text.slice(0, 120) + "…"
                                  : m.claim.text}
                              </span>
                              {m.similarityScore > 0 && (
                                <span className="text-neutral-600 text-xs flex-shrink-0 tabular-nums">
                                  {(m.similarityScore * 100).toFixed(0)}%
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </>
  );
}
