"use client";
import { useEffect, useState } from "react";

type TimelinePoint = { year: number; axis: string | null; n: number };

type TimelineData = {
  timeline: TimelinePoint[];
  earliest_year: number | null;
  latest_year: number | null;
  total_dated: number;
  total_claims: number;
  has_reversals: boolean;
  insufficient: boolean;
};

// Floor a year to its decade start (1987 -> 1980).
function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

export function TopicTimeline({ slug }: { slug: string }) {
  const [data, setData] = useState<TimelineData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/topics/${slug}/timeline`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  // Render nothing until loaded, or if there's not enough dated evidence.
  if (!data || data.insufficient) return null;
  const { earliest_year, latest_year, timeline, has_reversals, total_dated } = data;
  if (earliest_year == null || latest_year == null || timeline.length === 0) return null;

  // Aggregate claim counts by decade for a compact density sparkline.
  const byDecade = new Map<number, number>();
  for (const p of timeline) {
    const d = decadeOf(p.year);
    byDecade.set(d, (byDecade.get(d) ?? 0) + p.n);
  }
  const firstDecade = decadeOf(earliest_year);
  const lastDecade = decadeOf(latest_year);
  const decades: { decade: number; count: number }[] = [];
  for (let d = firstDecade; d <= lastDecade; d += 10) {
    decades.push({ decade: d, count: byDecade.get(d) ?? 0 });
  }
  const max = Math.max(1, ...decades.map(d => d.count));

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-800 pb-3 -mt-3">
      <span className="text-[11px] uppercase tracking-widest text-gray-500">
        Evidence from{" "}
        <span className="text-gray-300 font-medium tabular-nums">{earliest_year}</span>
        {" "}to{" "}
        <span className="text-gray-300 font-medium tabular-nums">{latest_year}</span>
      </span>

      {/* Decade-density sparkline */}
      <div
        className="flex items-end gap-0.5 h-6"
        title={`${total_dated.toLocaleString()} dated claims across ${decades.length} ${decades.length === 1 ? "decade" : "decades"}`}
      >
        {decades.map(({ decade, count }) => {
          const h = Math.round((count / max) * 24);
          return (
            <div
              key={decade}
              className="w-1.5 rounded-sm bg-cyan-700"
              style={{ height: count > 0 ? Math.max(h, 2) : 1, opacity: count > 0 ? 1 : 0.2 }}
              title={`${decade}s: ${count.toLocaleString()} ${count === 1 ? "claim" : "claims"}`}
            />
          );
        })}
      </div>

      {has_reversals && (
        <span
          className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-900/60"
          title="At least one claim on this topic has been retracted or reversed"
        >
          ⚠️ includes retracted findings
        </span>
      )}
    </div>
  );
}
