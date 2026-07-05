"use client";

import { useState, useCallback, useEffect } from "react";
import type { TopicSummary } from "@/lib/representationGap";

type DrillRow = {
  state: string;
  year: number;
  constituentPct: number;
  delegationPct: number;
  gap: number;
};

function gapColor(gap: number): string {
  if (gap > 40) return "text-red-400";
  if (gap > 25) return "text-amber-400";
  if (gap > 15) return "text-yellow-400";
  return "text-gray-400";
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function DrillPanel({ slug }: { slug: string }) {
  const [rows, setRows] = useState<DrillRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch lazily on first render of panel
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/representation/topic/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Trigger fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <td colSpan={9} className="px-3 py-3 text-xs text-gray-500 animate-pulse">
        Loading drill-down…
      </td>
    );
  }

  if (error) {
    return (
      <td colSpan={9} className="px-3 py-3 text-xs text-red-400">
        Error: {error}
      </td>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <td colSpan={9} className="px-3 py-3 text-xs text-gray-500">
        No matched (state, year) rows for this topic.
      </td>
    );
  }

  return (
    <td colSpan={9} className="px-0 py-0">
      <div className="bg-gray-950 border-t border-gray-700/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-900/80">
              <th className="px-4 py-1.5 text-left font-medium text-gray-500 pl-8">State</th>
              <th className="px-3 py-1.5 text-right font-medium text-gray-500">Year</th>
              <th className="px-3 py-1.5 text-right font-medium text-gray-500">Constituent %</th>
              <th className="px-3 py-1.5 text-right font-medium text-gray-500">Delegation %</th>
              <th className="px-3 py-1.5 text-right font-medium text-gray-500">Gap (pp)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.state}|${r.year}`}
                className="border-t border-gray-800/40 hover:bg-gray-900/40"
              >
                <td className="px-4 py-1.5 text-gray-200 font-mono pl-8">{r.state}</td>
                <td className="px-3 py-1.5 text-right text-gray-300 tabular-nums">{r.year}</td>
                <td className="px-3 py-1.5 text-right text-gray-300 tabular-nums">{pct(r.constituentPct)}</td>
                <td className="px-3 py-1.5 text-right text-gray-300 tabular-nums">{pct(r.delegationPct)}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${gapColor(r.gap)}`}>
                  {pct(r.gap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </td>
  );
}

interface Props {
  topicSummaries: TopicSummary[];
}

export function TopicDrillTable({ topicSummaries }: Props) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  // Track which slugs have been fetched (panel mounts = fetch triggered)
  const [fetchedSlugs] = useState<Set<string>>(new Set());

  function toggle(slug: string) {
    setOpenSlug((prev) => (prev === slug ? null : slug));
  }

  function fmt(n: number | null | undefined, digits = 1): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return "—";
    return n.toFixed(digits);
  }

  // "gun_control" → "Gun Control" — raw slugs were the main readability
  // complaint on this table. Slug stays visible via title attribute.
  function humanizeSlug(slug: string): string {
    return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function pctVal(n: number): string {
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(1)}%`;
  }

  function GapBar({ gap, max = 100 }: { gap: number; max?: number }) {
    const intensity =
      gap >= 60 ? "bg-red-700"
      : gap >= 40 ? "bg-orange-600"
      : gap >= 25 ? "bg-yellow-700"
      : "bg-gray-700";
    return (
      <div className="w-24 h-1.5 rounded bg-gray-800 overflow-hidden">
        <div className={`h-full ${intensity}`} style={{ width: `${Math.min(100, (gap / max) * 100)}%` }} />
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-800 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            <th className="px-3 py-2 text-left font-medium text-gray-500">Topic</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">CCES proxy</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Rows</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Yea %</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Avg support %</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Avg gap</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Dem gap</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Rep gap</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Worst cells</th>
          </tr>
        </thead>
        <tbody>
          {topicSummaries.map((t, i) => {
            const isOpen = openSlug === t.topicSlug;
            // Ensure panel mounts (and thus fetches) when first opened
            if (isOpen) fetchedSlugs.add(t.topicSlug);
            const shouldMount = fetchedSlugs.has(t.topicSlug);

            return (
              <>
                <tr
                  key={t.topicSlug}
                  onClick={() => toggle(t.topicSlug)}
                  className={`border-b border-gray-800/50 cursor-pointer select-none transition-colors
                    ${i % 2 === 0 ? "" : "bg-gray-900/20"}
                    ${isOpen ? "bg-gray-900/60 border-gray-700" : "hover:bg-gray-900/40"}`}
                  aria-expanded={isOpen}
                  title={isOpen ? "Click to collapse" : "Click to expand drill-down"}
                >
                  <td className="px-3 py-2 text-gray-100 align-top" title={t.topicSlug}>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`text-[10px] transition-transform inline-block ${isOpen ? "rotate-90" : ""} text-gray-500`}
                        aria-hidden="true"
                      >
                        ▶
                      </span>
                      {humanizeSlug(t.topicSlug)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400 align-top font-mono text-[11px]">{t.questionCode}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{t.matchedRowCount}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{pctVal(t.avgDelegationYeaPct)}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{pctVal(t.avgConstituentSupportPct)}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums">{pctVal(t.avgGap)}</td>
                  <td className="px-3 py-2 text-right text-blue-300 tabular-nums">{fmt(t.avgDemGap)}</td>
                  <td className="px-3 py-2 text-right text-orange-300 tabular-nums">{fmt(t.avgRepGap)}</td>
                  <td className="px-3 py-2 align-top text-[11px] text-gray-500">
                    {t.topGapStates.map((s, j) => (
                      <span key={`${s.state}-${j}`} className="font-mono mr-2">
                        {s.state}&apos;{String(s.year).slice(-2)}:{s.gap.toFixed(0)}%
                      </span>
                    ))}
                  </td>
                </tr>
                {shouldMount && (
                  <tr
                    key={`${t.topicSlug}-drill`}
                    className={`border-b border-gray-700/60 ${isOpen ? "" : "hidden"}`}
                  >
                    <DrillPanel slug={t.topicSlug} />
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
