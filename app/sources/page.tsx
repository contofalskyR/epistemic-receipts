"use client";
import { useEffect, useState } from "react";

interface SourceEntry {
  ingestedBy: string;
  label: string;
  sourceUrl: string;
  count: number;
}

interface CategoryBucket {
  name: string;
  totalCount: number;
  sourceCount: number;
  sources: SourceEntry[];
}

interface SourcesSummary {
  totalClaims: number;
  totalSources: number;
  generatedAt: string;
  categories: CategoryBucket[];
  unmapped: SourceEntry[];
}

const CATEGORY_ACCENT: Record<string, string> = {
  "US Federal Government":             "border-blue-700/50 text-blue-300",
  "Courts & Legal":                    "border-amber-700/50 text-amber-300",
  "Science & Medicine":                "border-violet-700/50 text-violet-300",
  "International Organizations":       "border-sky-700/50 text-sky-300",
  "Pharmaceutical & Health":           "border-rose-700/50 text-rose-300",
  "National Parliaments / Legislation": "border-emerald-700/50 text-emerald-300",
  "Archives & Historical":             "border-orange-700/50 text-orange-300",
  Other:                               "border-gray-700/50 text-gray-300",
};

function hostname(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function SourcesPage() {
  const [data, setData] = useState<SourcesSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sources-summary")
      .then((r) => r.json())
      .then((d: SourcesSummary) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Sources</h1>
        <p className="text-sm text-gray-400 max-w-3xl">
          Every external API, archive, and primary-record database we pull from, grouped by category.
          Counts update live from the claim graph. For pipeline-level operational detail, see{" "}
          <a href="/datasets" className="text-blue-400 hover:underline">Datasets</a>.
        </p>
      </header>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Total claims</div>
              <div className="text-xl font-semibold text-white tabular-nums">
                {data.totalClaims.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Distinct sources</div>
              <div className="text-xl font-semibold text-white tabular-nums">
                {data.totalSources.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Categories</div>
              <div className="text-xl font-semibold text-white tabular-nums">
                {data.categories.length}
              </div>
            </div>
          </div>

          {data.categories.map((cat) => (
            <section key={cat.name} className="space-y-3">
              <header className={`flex items-baseline justify-between border-b pb-2 ${CATEGORY_ACCENT[cat.name] ?? CATEGORY_ACCENT.Other}`}>
                <h2 className="text-base font-semibold">{cat.name}</h2>
                <div className="text-xs text-gray-500 tabular-nums">
                  {cat.sourceCount} source{cat.sourceCount === 1 ? "" : "s"} ·{" "}
                  <span className="text-gray-300">{cat.totalCount.toLocaleString()}</span> claims
                </div>
              </header>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {cat.sources.map((s) => (
                  <li
                    key={s.ingestedBy}
                    className="rounded border border-gray-800 bg-gray-900 px-3 py-2.5 flex flex-col gap-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-white leading-snug">{s.label}</p>
                      <span className="shrink-0 text-xs font-semibold text-white tabular-nums">
                        {s.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span className="font-mono truncate">{s.ingestedBy}</span>
                      {s.sourceUrl && (
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline truncate max-w-[160px] text-right ml-2"
                        >
                          {hostname(s.sourceUrl)} ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {data.unmapped.length > 0 && (
            <section className="space-y-3">
              <header className="flex items-baseline justify-between border-b pb-2 border-gray-800">
                <h2 className="text-base font-semibold text-gray-400">Unmapped</h2>
                <div className="text-xs text-gray-600 tabular-nums">
                  {data.unmapped.length} source{data.unmapped.length === 1 ? "" : "s"}
                </div>
              </header>
              <p className="text-xs text-gray-500 italic">
                These ingester tags exist in the claim graph but are not yet categorized in the registry.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.unmapped.map((s) => (
                  <li key={s.ingestedBy} className="rounded border border-gray-800 bg-gray-900 px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-gray-400 truncate">{s.ingestedBy}</span>
                    <span className="text-xs font-semibold text-white tabular-nums">{s.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-gray-600 text-center pb-4">
            {data.totalSources} sources · {data.totalClaims.toLocaleString()} claims · generated{" "}
            {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
