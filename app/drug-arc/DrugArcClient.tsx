"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type SearchResult = {
  id: string;
  text: string;
  pipeline: string;
  pipelineLabel: string;
  color: string;
  year: number | null;
  totalReports: number | null;
  epistemicStatus: string | null;
};

const COLOR_CLASSES: Record<string, { dot: string; badge: string; border: string }> = {
  blue: {
    dot: "bg-blue-500",
    badge: "bg-blue-900/60 text-blue-300 border-blue-700/50",
    border: "border-blue-900/40",
  },
  emerald: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50",
    border: "border-emerald-900/40",
  },
  orange: {
    dot: "bg-orange-500",
    badge: "bg-orange-900/60 text-orange-300 border-orange-700/50",
    border: "border-orange-900/40",
  },
  gray: {
    dot: "bg-gray-500",
    badge: "bg-gray-800 text-gray-300 border-gray-700",
    border: "border-gray-800",
  },
};

function formatReports(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M reports`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k reports`;
  return `${n} reports`;
}

export default function DrugArcClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setResults(null);
      setSearched("");
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/drug-arc/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setSearched(data.query ?? val.trim());
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  const hasTrial = results?.some((r) => r.pipeline === "clinicaltrials_v1");
  const hasApproval = results?.some((r) => r.pipeline === "drugsatfda_v1");
  const hasAE = results?.some((r) => r.pipeline === "faers_normalized_drugs_v1");
  const arcComplete = hasTrial && hasApproval && hasAE;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Search by drug name or compound — e.g. semaglutide, atorvastatin, ibuprofen"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            searching…
          </div>
        )}
      </div>

      {/* Arc completeness banner */}
      {results && results.length > 0 && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs ${
            arcComplete
              ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-400"
              : "border-gray-700 bg-gray-900/40 text-gray-400"
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${arcComplete ? "bg-emerald-500" : "bg-gray-600"}`} />
          {arcComplete
            ? `Full arc found for "${searched}" — trial registration, FDA approval, and post-market surveillance all present.`
            : `Partial arc for "${searched}" — ${[hasTrial && "trials", hasApproval && "approvals", hasAE && "adverse events"].filter(Boolean).join(", ")} found.`}
        </div>
      )}

      {/* Results timeline */}
      {results && results.length > 0 && (
        <div className="relative">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-800" />
          <div className="space-y-0">
            {results.map((r) => {
              const c = COLOR_CLASSES[r.color] ?? COLOR_CLASSES.gray;
              return (
                <div key={r.id} className="relative pl-10 pb-6 last:pb-0">
                  <div
                    className={`absolute left-0 top-1.5 w-7 h-7 rounded-full ${c.dot} flex items-center justify-center shadow-lg ring-4 ring-gray-950`}
                  >
                    <span className="text-white font-bold text-[9px] leading-none">
                      {r.year ? String(r.year).slice(2) : "—"}
                    </span>
                  </div>
                  <div className={`rounded-lg border ${c.border} bg-gray-900/50 px-4 py-3 space-y-2`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="text-xs text-gray-500 font-mono">{r.year ?? "—"}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${c.badge}`}>
                        {r.pipelineLabel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{r.text}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/claims/${r.id}`}
                        className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                      >
                        View claim →
                      </Link>
                      {r.totalReports !== null && (
                        <span className="text-xs text-orange-500/70">
                          {formatReports(r.totalReports)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results && results.length === 0 && searched && (
        <p className="text-sm text-gray-500 py-2">
          No records found for &ldquo;{searched}&rdquo; across clinical trials, FDA approvals, or adverse event data.
        </p>
      )}

      {!results && !loading && (
        <p className="text-xs text-gray-600 py-1">
          Results will appear as you type. Searches clinical trials, FDA approval records, and FAERS drug aggregates.
        </p>
      )}
    </div>
  );
}
