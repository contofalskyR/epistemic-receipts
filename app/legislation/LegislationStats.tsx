"use client";

import { useEffect, useState } from "react";

type HistBucket = { bucket: string; count: number };
type JurisdictionRow = {
  jurisdiction: string;
  pipeline: string;
  superseded_n: number;
  indeterminate_n: number;
  still_in_force_n: number;
  median_days: number | null;
  p25_days: number | null;
  p75_days: number | null;
};

type StatsPayload = {
  jurisdictions: string[];
  superseded: {
    n: number;
    indeterminate_n: number;
    median_days: number | null;
    p25_days: number | null;
    p75_days: number | null;
    histogram: HistBucket[];
  };
  still_in_force: { n: number };
  jurisdiction_breakdown: JurisdictionRow[];
  coverage_note: string;
};

function fmtDays(days: number | null): string {
  if (days === null) return "—";
  const yrs = days / 365.25;
  if (yrs >= 2) return `${yrs.toFixed(1)} yrs`;
  if (days >= 30) return `${Math.round(days / 30)} mo`;
  return `${days}d`;
}

export default function LegislationStats() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/legislation-stats")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<StatsPayload>;
      })
      .then(setData)
      .catch((e) => setError(e.message ?? "Failed to load stats"));
  }, []);

  if (error) {
    return (
      <p className="text-xs text-red-400 font-mono">Lifespan stats unavailable: {error}</p>
    );
  }

  if (!data) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 w-48 rounded bg-zinc-800" />
        <div className="h-20 rounded bg-zinc-800" />
      </div>
    );
  }

  const { superseded, still_in_force, jurisdiction_breakdown } = data;
  const maxHistCount = Math.max(1, ...superseded.histogram.map((b) => b.count));

  return (
    <div className="space-y-6 border-t border-zinc-800 pt-6 mt-6">
      {/* Section header */}
      <div>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Law Lifespan</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          How long before a law is superseded?
        </h2>
        <p className="mt-1 text-xs text-zinc-500 max-w-2xl leading-relaxed">
          Observed-event durations (superseded laws) are shown separately from censored/ongoing
          laws still in force. Duration is computed as superseding-claim date − enactment date
          using the <span className="font-mono">claimEmergedAt</span> field.
          Indeterminate rows (non-positive or null date difference) are excluded from duration
          stats but counted separately.
        </p>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 min-w-[140px]">
          <p className="text-xs text-zinc-500">Superseded (observed)</p>
          <p className="mt-1 text-xl font-semibold text-red-300 tabular-nums">
            {superseded.n.toLocaleString()}
          </p>
          {superseded.indeterminate_n > 0 && (
            <p className="text-[11px] text-zinc-600 mt-0.5">
              +{superseded.indeterminate_n.toLocaleString()} indeterminate
            </p>
          )}
        </div>

        <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 min-w-[140px]">
          <p className="text-xs text-zinc-500">Still in force (censored)</p>
          <p className="mt-1 text-xl font-semibold text-green-300 tabular-nums">
            {still_in_force.n.toLocaleString()}
          </p>
          <p className="text-[11px] text-zinc-600 mt-0.5">no duration assigned</p>
        </div>

        {superseded.median_days !== null && (
          <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 min-w-[140px]">
            <p className="text-xs text-zinc-500">Median lifespan</p>
            <p className="mt-1 text-xl font-semibold text-amber-300 tabular-nums">
              {fmtDays(superseded.median_days)}
            </p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              IQR {fmtDays(superseded.p25_days)} – {fmtDays(superseded.p75_days)}
            </p>
          </div>
        )}
      </div>

      {/* Histogram */}
      {superseded.histogram.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white">
            Lifespan distribution (superseded laws, n={superseded.n - superseded.indeterminate_n})
          </h3>
          <p className="text-xs text-zinc-500">
            Positive-duration events only. Indeterminate rows excluded.
            {superseded.median_days !== null && (
              <> Median marked with ↓.</>
            )}
          </p>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            {superseded.histogram.map((b) => {
              const width = (b.count / maxHistCount) * 100;
              // Mark median bucket approximately
              const isMedianBucket =
                superseded.median_days !== null &&
                ((superseded.median_days < 365 && b.bucket === "< 1 year") ||
                  (superseded.median_days >= 365 && superseded.median_days < 1825 && b.bucket === "1–4 years") ||
                  (superseded.median_days >= 1825 && superseded.median_days < 3650 && b.bucket === "5–9 years") ||
                  (superseded.median_days >= 3650 && superseded.median_days < 7300 && b.bucket === "10–19 years") ||
                  (superseded.median_days >= 7300 && superseded.median_days < 18250 && b.bucket === "20–49 years") ||
                  (superseded.median_days >= 18250 && b.bucket === "50+ years"));
              return (
                <div key={b.bucket} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-xs text-zinc-300">
                      {b.bucket}
                      {isMedianBucket && (
                        <span className="ml-1 text-amber-400 text-[10px]">← median</span>
                      )}
                    </span>
                    <span className="text-xs text-zinc-500 tabular-nums font-mono">
                      {b.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 rounded-sm bg-zinc-900 overflow-hidden">
                    <div
                      className={`h-full ${isMedianBucket ? "bg-amber-600/80" : "bg-blue-700/70"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-jurisdiction breakdown */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Jurisdiction breakdown</h3>
        <p className="text-xs text-zinc-500">
          Jurisdictions present in this corpus:{" "}
          <span className="text-zinc-300">{data.jurisdictions.join(", ")}</span>. Duration stats
          available for jurisdictions with supersession data only.
        </p>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Jurisdiction</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Superseded (n)
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Indet.</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Still in force
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Median</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">P25</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">P75</th>
              </tr>
            </thead>
            <tbody>
              {jurisdiction_breakdown.map((r, i) => (
                <tr
                  key={r.pipeline}
                  className={`border-b border-zinc-800/50 last:border-0 ${
                    i % 2 === 0 ? "" : "bg-zinc-900/20"
                  }`}
                >
                  <td className="px-3 py-2 text-zinc-100 align-top">{r.jurisdiction}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">
                    {r.superseded_n.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-500 tabular-nums align-top">
                    {r.indeterminate_n > 0 ? r.indeterminate_n.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">
                    {r.still_in_force_n.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-amber-300 tabular-nums align-top">
                    {fmtDays(r.median_days)}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-400 tabular-nums align-top">
                    {fmtDays(r.p25_days)}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-400 tabular-nums align-top">
                    {fmtDays(r.p75_days)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV link */}
      <div className="text-xs text-zinc-600">
        <a
          href="/api/legislation-stats?format=csv"
          className="hover:text-zinc-400 underline transition-colors"
        >
          Download CSV
        </a>
        {" · "}
        <span className="italic">
          Coverage: Cyprus, Chile, Luxembourg, United Kingdom have supersession date data.
          All other jurisdictions are recorded as still-in-force (censored).
        </span>
      </div>
    </div>
  );
}
