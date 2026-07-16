"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";

/**
 * "What moved in what you follow" (B12-4) — top-of-/feed digest for readers
 * with follows. Real dated transitions only; when nothing moved (or the
 * reader follows nothing), this renders nothing — no filler.
 */

const STORAGE_KEY = "er_profile_key";

type Move = {
  claimId: string;
  claimText: string;
  fromAxis: string | null;
  toAxis: string;
  occurredAt: string;
  recordedAt: string;
  via: string;
};

function readKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FollowingActivity() {
  const [moves, setMoves] = useState<Move[]>([]);

  useEffect(() => {
    const key = readKey();
    if (!key || key.length < 8) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/feed/following?key=${encodeURIComponent(key)}`,
          { cache: "no-store" },
        );
        if (!r.ok || cancelled) return;
        const data: { moves?: Move[] } = await r.json();
        if (!cancelled) setMoves(data.moves ?? []);
      } catch {
        /* render nothing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (moves.length === 0) return null;

  const claimCount = new Set(moves.map((m) => m.claimId)).size;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio size={14} className="text-amber-400" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Following
        </h2>
        <Link
          href="/following"
          className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          manage →
        </Link>
      </div>
      <p className="text-sm text-gray-300">
        {claimCount} of your followed claims moved this week.
      </p>
      <ul className="space-y-2">
        {moves.map((m, i) => (
          <li
            key={`${m.claimId}-${i}`}
            className="rounded-lg border border-amber-900/40 bg-amber-950/10 hover:bg-amber-950/20 transition-colors p-3"
          >
            <Link href={`/claims/${m.claimId}`} className="block space-y-1.5">
              <p className="text-sm text-gray-100 leading-snug line-clamp-2">
                {m.claimText}
              </p>
              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                <span className="px-1.5 py-0.5 rounded-full font-medium bg-amber-900/60 text-amber-300 font-mono">
                  {m.fromAxis ? `${m.fromAxis} → ${m.toAxis}` : m.toAxis}
                </span>
                <span className="text-gray-500">{m.via}</span>
                <span className="text-gray-600 ml-auto">{fmtDate(m.occurredAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
