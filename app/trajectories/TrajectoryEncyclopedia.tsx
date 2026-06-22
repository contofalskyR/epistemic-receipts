"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SettlingCurveMini from "../components/SettlingCurveMini";

const C = {
  bg: "#08080f",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#f0a000",
};

interface EraDef {
  key: string;
  label: string;
  range: string;
}

interface TrajectoryItem {
  id: string;
  claim: string;
  startYear: number | null;
  endYear: number | null;
  era: string;
  transitionCount: number;
  communities: string[];
  hasReversal: boolean;
  hasAbandonment: boolean;
  milestones: { year: number; axis: string }[];
}

interface HistoryResponse {
  eras: EraDef[];
  eraCounts: Record<string, number>;
  total: number;
  items: TrajectoryItem[];
}

const PAGE_SIZE = 24;

function truncate(s: string, n = 100) {
  if (s.length <= n) return s;
  return s.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

function yearRange(start: number | null, end: number | null) {
  if (start == null) return "undated";
  if (end == null || end === start) return `${start}`;
  return `${start} → ${end}`;
}

export default function TrajectoryEncyclopedia() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [era, setEra] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Load the full set once; count is well under 500 so filtering, search, and
  // pagination all happen client-side for instant tab switching.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then((r) => r.json())
      .then((d: HistoryResponse) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eraTabs: EraDef[] = useMemo(
    () => [{ key: "all", label: "All", range: "" }, ...(data?.eras ?? [])],
    [data]
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.items.filter((it) => {
      if (era !== "all" && it.era !== era) return false;
      if (q && !it.claim.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, era, query]);

  const eraLabel = (key: string) =>
    data?.eras.find((e) => e.key === key)?.label ?? key;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const countFor = (key: string) => data?.eraCounts?.[key] ?? 0;

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100%" }} className="w-full">
      <div className="mx-auto px-5 py-8" style={{ maxWidth: 1100 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-xs tracking-widest" style={{ color: C.brand }}>
            EPISTEMIC RECEIPTS
          </div>
          <div className="font-mono text-xs tracking-widest" style={{ color: C.faint }}>
            TRAJECTORY ENCYCLOPEDIA
          </div>
        </div>

        <h1 className="font-semibold tracking-tight mb-2" style={{ fontSize: 30, lineHeight: 1.1 }}>
          History of settled claims
        </h1>
        <p className="mb-6" style={{ color: C.mut, fontSize: 13.5, maxWidth: 680, lineHeight: 1.5 }}>
          Every trajectory tracks one historical claim&apos;s dated, sourced status changes across
          five communities — expert literature, institutions, courts, the public, and markets.
          Browse by era, search the claims, and open any one to trace its settling curve.
        </p>

        {/* Era tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "thin" }}>
          {eraTabs.map((t) => {
            const on = t.key === era;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setEra(t.key);
                  setPage(1);
                }}
                className="shrink-0 px-3 py-2 rounded text-left transition-colors"
                style={{
                  background: on ? "#1a1a2b" : "transparent",
                  border: `1px solid ${on ? C.brand : C.panelEdge}`,
                  minWidth: 92,
                }}
              >
                <div className="text-xs font-semibold" style={{ color: on ? C.ink : C.mut }}>
                  {t.label}
                </div>
                <div className="font-mono mt-0.5" style={{ fontSize: 10, color: on ? C.brand : C.faint }}>
                  {t.range ? `${t.range} · ` : ""}
                  {countFor(t.key)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mb-5">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search claims — e.g. 'Caesar', 'continental drift', 'tobacco'"
            className="w-full px-3 py-2 rounded text-sm focus:outline-none"
            style={{
              background: C.panel,
              border: `1px solid ${C.panelEdge}`,
              color: C.ink,
            }}
          />
        </div>

        {/* Result count */}
        {!loading && !failed && (
          <p className="font-mono mb-4" style={{ fontSize: 11, color: C.faint }}>
            {filtered.length} {filtered.length === 1 ? "trajectory" : "trajectories"}
            {era !== "all" ? ` · ${eraLabel(era)}` : ""}
            {query ? ` · matching “${query}”` : ""}
          </p>
        )}

        {/* Body */}
        {loading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                aria-hidden
                style={{
                  height: 132,
                  borderRadius: 8,
                  background: "linear-gradient(90deg,#10101c,#16162a,#10101c)",
                  border: `1px solid ${C.panelEdge}`,
                }}
              />
            ))}
          </div>
        ) : failed ? (
          <p style={{ color: C.mut, fontSize: 14 }}>
            Couldn&apos;t load trajectories. Please try again.
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center" style={{ color: C.mut, fontSize: 14 }}>
            No trajectories match{query ? ` “${query}”` : " this era"}.
          </p>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((it) => (
                <Link
                  key={it.id}
                  href={`/settling-curve?t=${encodeURIComponent(it.id)}`}
                  className="block rounded-lg p-4 transition-colors group"
                  style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className="font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                      style={{ fontSize: 9.5, color: C.brand, border: `1px solid ${C.brand}55` }}
                    >
                      {eraLabel(it.era)}
                    </span>
                    <span className="font-mono" style={{ fontSize: 11, color: C.faint }}>
                      {yearRange(it.startYear, it.endYear)}
                    </span>
                  </div>

                  <p
                    className="mb-3"
                    style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.4, minHeight: 38 }}
                  >
                    {truncate(it.claim)}
                  </p>

                  {/* Preview sparkline of this trajectory's settling curve */}
                  <div className="mb-3">
                    <SettlingCurveMini
                      milestones={it.milestones}
                      ariaLabel={`Epistemic trajectory sparkline for: ${it.claim}`}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-mono" style={{ fontSize: 10.5, color: C.mut }}>
                      {it.transitionCount}{" "}
                      {it.transitionCount === 1 ? "transition" : "transitions"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {it.hasReversal && (
                        <span className="font-mono" style={{ fontSize: 10, color: "#f43f5e" }}>
                          ↩ reversed
                        </span>
                      )}
                      {it.hasAbandonment && (
                        <span className="font-mono" style={{ fontSize: 10, color: "#6b7280" }}>
                          ✕ abandoned
                        </span>
                      )}
                      <span
                        className="font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ fontSize: 11, color: C.brand }}
                      >
                        view →
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded font-mono transition-colors disabled:opacity-40"
                  style={{ fontSize: 12, color: C.ink, border: `1px solid ${C.panelEdge}` }}
                >
                  ← Prev
                </button>
                <span className="font-mono" style={{ fontSize: 12, color: C.mut }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded font-mono transition-colors disabled:opacity-40"
                  style={{ fontSize: 12, color: C.ink, border: `1px solid ${C.panelEdge}` }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
