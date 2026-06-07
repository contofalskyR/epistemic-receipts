"use client";

import { useState } from "react";

type Alignment = "left" | "right" | "center" | "unknown";
type CrisisTag = "recession" | "high-unemployment" | "high-inflation";

interface Bucket {
  laws: number;
  lawsWithVoteData: number;
  passed: number;
  failed: number;
  passRate: number | null;
}

export interface PartyEconomicData {
  byIndicator: Record<CrisisTag, Record<Alignment, Bucket>>;
  coverage?: {
    totalInScopeLaws: number;
    lawsWithParty: number;
  };
  thresholds?: Record<string, string>;
}

interface Props {
  global: PartyEconomicData;
  us: PartyEconomicData;
}

const ROWS: { tag: CrisisTag; label: string; sublabel: string }[] = [
  { tag: "recession", label: "Recession", sublabel: "GDP contraction" },
  { tag: "high-unemployment", label: "High unemployment", sublabel: "" },
  { tag: "high-inflation", label: "High inflation", sublabel: "" },
];

function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

function ConditionRow({
  label,
  sublabel,
  threshold,
  left,
  right,
}: {
  label: string;
  sublabel: string;
  threshold: string | undefined;
  left: Bucket;
  right: Bucket;
}) {
  const leftN = left.laws;
  const rightN = right.laws;
  const total = leftN + rightN;
  const leftPct = total > 0 ? (leftN / total) * 100 : 0;
  const rightPct = total > 0 ? (rightN / total) * 100 : 0;

  return (
    <div className="space-y-2 py-3 border-b border-gray-800/50 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-gray-100 font-medium">{label}</div>
          {sublabel ? (
            <div className="text-[11px] text-gray-500">{sublabel}</div>
          ) : null}
        </div>
        <div className="text-[11px] text-gray-600 font-mono whitespace-nowrap">
          {threshold ?? ""}
        </div>
      </div>

      {total === 0 ? (
        <div className="text-xs text-gray-500 italic">No data in scope.</div>
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs">
            <div className="w-20 text-right text-blue-300 tabular-nums">
              {leftN.toLocaleString()} ({fmtPct(leftPct)})
            </div>
            <div className="flex-1 h-4 rounded bg-gray-800 overflow-hidden flex">
              <div
                className="h-full bg-blue-500/70"
                style={{ width: `${leftPct}%` }}
                title={`Left: ${leftN.toLocaleString()} laws`}
              />
              <div
                className="h-full bg-red-500/70"
                style={{ width: `${rightPct}%` }}
                title={`Right: ${rightN.toLocaleString()} laws`}
              />
            </div>
            <div className="w-20 text-left text-red-300 tabular-nums">
              {rightN.toLocaleString()} ({fmtPct(rightPct)})
            </div>
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-widest font-mono text-gray-600">
            <span>Left-coded</span>
            <span>Right-coded</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function PartyEconomicPanel({ global, us }: Props) {
  const [view, setView] = useState<"global" | "us">("global");
  const data = view === "global" ? global : us;

  const sourceLabel =
    view === "global"
      ? "Global dataset — all legislation pipelines linked to World Bank indicators."
      : "US-only — congressional + federal-register laws against US World Bank indicators.";

  return (
    <section className="space-y-3 scroll-mt-4">
      <div>
        <h2 className="text-base font-semibold text-white">
          Party Response to Economic Conditions
        </h2>
        <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
          How many laws were passed by left- vs right-coded governments while
          the country was sitting inside a recession, an unemployment spike, or
          an inflation spike (±1-year window). Bars show the relative share of
          all party-coded laws that fall into each condition.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded border border-gray-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setView("global")}
            className={`px-3 py-1.5 text-xs transition-colors ${
              view === "global"
                ? "bg-gray-800 text-white"
                : "bg-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Global
          </button>
          <button
            type="button"
            onClick={() => setView("us")}
            className={`px-3 py-1.5 text-xs transition-colors ${
              view === "us"
                ? "bg-gray-800 text-white"
                : "bg-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            US
          </button>
        </div>
        <div className="text-[11px] text-gray-500">{sourceLabel}</div>
      </div>

      <div className="rounded border border-gray-800 bg-gray-900/30 px-4 py-2">
        {ROWS.map((r) => (
          <ConditionRow
            key={r.tag}
            label={r.label}
            sublabel={r.sublabel}
            threshold={data.thresholds?.[r.tag]}
            left={data.byIndicator[r.tag].left}
            right={data.byIndicator[r.tag].right}
          />
        ))}
      </div>

      <p className="text-[11px] text-gray-600 italic max-w-3xl leading-relaxed">
        Party attribution covers 33.5% of legislation in scope. Global dataset
        includes EU national laws; US filter isolates congressional votes only.
        Crisis thresholds differ by view: the global view uses stricter
        thresholds (GDP &lt; −2%, unemployment &gt; 10%, inflation &gt; 20%) calibrated
        to capture severe events worldwide; the US view uses GDP &lt; 0%,
        unemployment &gt; 7%, inflation &gt; 5%, matched to US post-war norms.
      </p>
    </section>
  );
}
