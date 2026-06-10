"use client";

import { useEffect, useState } from "react";

type AxisEntry = { axis: string; n: number; pct: number };
type TypeEntry = { type: string; n: number; pct: number };
type PipelineEntry = { pipeline: string; n: number; pct: number };

type CorpusPayload = {
  total_claims: number;
  sourced_pct: number;
  human_reviewed_n: number;
  human_reviewed_pct: number;
  epistemic_axis: AxisEntry[];
  claim_type: TypeEntry[];
  pipeline_breakdown: PipelineEntry[];
  coverage_note: string;
};

const AXIS_COLORS: Record<string, string> = {
  SETTLED: "bg-green-700/80",
  RECORDED: "bg-blue-700/70",
  CONTESTED: "bg-amber-700/70",
  UNRESOLVABLE: "bg-red-900/70",
};

const AXIS_LABELS: Record<string, string> = {
  SETTLED: "Settled",
  RECORDED: "Recorded",
  CONTESTED: "Contested",
  UNRESOLVABLE: "Unresolvable",
};

export default function CorpusStatsSection() {
  const [data, setData] = useState<CorpusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/corpus-stats")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CorpusPayload>;
      })
      .then(setData)
      .catch((e) => setError(e.message ?? "Failed to load corpus stats"));
  }, []);

  if (error) {
    return (
      <p className="text-xs text-red-400 font-mono">Corpus stats unavailable: {error}</p>
    );
  }

  if (!data) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 w-64 rounded bg-zinc-800" />
        <div className="h-24 rounded bg-zinc-800" />
      </div>
    );
  }

  const maxAxisN = Math.max(1, ...data.epistemic_axis.map((a) => a.n));
  const maxPipelineN = Math.max(1, ...data.pipeline_breakdown.map((p) => p.n));

  return (
    <div className="space-y-6">
      {/* Hero composition line */}
      <div className="rounded border border-zinc-800 bg-zinc-950 px-5 py-4">
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">
          Corpus
        </p>
        <p className="text-xl font-semibold text-white leading-snug">
          {data.total_claims.toLocaleString()} claims
          {" · "}
          <span className="text-green-300">{data.sourced_pct.toFixed(1)}%</span> carry a primary source
          {" · "}
          <span className="text-amber-300">{data.human_reviewed_pct.toFixed(1)}%</span> human-reviewed
        </p>
        <p className="mt-2 text-xs text-zinc-500 max-w-2xl leading-relaxed">
          {data.coverage_note}
        </p>
      </div>

      {/* Epistemic axis breakdown */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Epistemic axis breakdown</h2>
          <p className="text-xs text-zinc-500 mt-1">
            How each claim is classified by epistemic status. This is the primary lens for
            understanding what kind of knowledge this corpus contains.
          </p>
        </div>

        {/* Stacked bar */}
        <div className="h-6 rounded overflow-hidden flex">
          {data.epistemic_axis.map((a) => (
            <div
              key={a.axis}
              className={`h-full ${AXIS_COLORS[a.axis] ?? "bg-zinc-700"} transition-all`}
              style={{ width: `${a.pct}%` }}
              title={`${AXIS_LABELS[a.axis] ?? a.axis}: ${a.n.toLocaleString()} (${a.pct}%)`}
            />
          ))}
        </div>

        <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3">
          {data.epistemic_axis.map((a) => (
            <div key={a.axis} className="space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${AXIS_COLORS[a.axis] ?? "bg-zinc-600"}`}
                  />
                  <span className="text-zinc-200 text-xs">
                    {AXIS_LABELS[a.axis] ?? a.axis}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                  {a.n.toLocaleString()}{" "}
                  <span className="text-zinc-500">({a.pct}%)</span>
                </div>
              </div>
              <div className="h-2 rounded-sm bg-zinc-900 overflow-hidden">
                <div
                  className={`h-full ${AXIS_COLORS[a.axis] ?? "bg-zinc-700"}`}
                  style={{ width: `${(a.n / maxAxisN) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Human review callout */}
      <section className="rounded border border-zinc-700 bg-zinc-900/40 px-4 py-3 space-y-1">
        <p className="text-sm font-medium text-zinc-100">
          Human review rate:{" "}
          <span className="text-amber-300 tabular-nums">{data.human_reviewed_pct.toFixed(1)}%</span>
          {" "}
          <span className="text-zinc-500 text-xs font-normal">
            ({data.human_reviewed_n.toLocaleString()} of {data.total_claims.toLocaleString()} claims)
          </span>
        </p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          A low human-review rate is expected for a bulk-ingested corpus. It does not mean claims
          are untrustworthy — it means most provenance checking is structural (pipeline-enforced
          source links), not editorial (hand-audited). Claims marked VERIFIED, HARD_FACT, or
          DISPUTED have been individually reviewed.
        </p>
      </section>

      {/* Pipeline breakdown */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Pipeline breakdown</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Which ingest pipelines contributed claims. Top 20 by claim count.
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-2">
          {data.pipeline_breakdown.map((p) => (
            <div key={p.pipeline} className="space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xs text-zinc-300 font-mono">{p.pipeline}</span>
                <div className="text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                  {p.n.toLocaleString()}{" "}
                  <span className="text-zinc-600">({p.pct}%)</span>
                </div>
              </div>
              <div className="h-1.5 rounded-sm bg-zinc-900 overflow-hidden">
                <div
                  className="h-full bg-indigo-700/60"
                  style={{ width: `${(p.n / maxPipelineN) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CSV link */}
      <div className="text-xs text-zinc-600">
        <a
          href="/api/corpus-stats?format=csv"
          className="hover:text-zinc-400 underline transition-colors"
        >
          Download pipeline breakdown CSV
        </a>
      </div>
    </div>
  );
}
