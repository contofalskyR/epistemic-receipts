"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";

type OpinionHit = {
  id: string;
  caseName: string;
  court: string;
  pipeline: string;
  date: string | null;
  epistemicAxis: string | null;
  sourceUrl: string | null;
  linkedLegislation: number;
};

type OpinionsResponse = {
  total: number;
  page: number;
  limit: number;
  pages: number;
  results: OpinionHit[];
};

const COURTS = [
  { value: "all", label: "All Courts" },
  { value: "scotus", label: "SCOTUS" },
  { value: "circuits", label: "Circuit Courts" },
  { value: "state", label: "State Supreme" },
  { value: "other", label: "Other" },
] as const;

const COURT_STYLE: Record<string, string> = {
  SCOTUS: "bg-amber-950 text-amber-300 border border-amber-900/50",
  Circuit: "bg-blue-950 text-blue-300 border border-blue-900/50",
  State: "bg-purple-950 text-purple-300 border border-purple-900/50",
  BIA: "bg-teal-950 text-teal-300 border border-teal-900/50",
  Tax: "bg-green-950 text-green-300 border border-green-900/50",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export default function OpinionsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlCourt = (searchParams.get("court") ?? "all") as "all" | "scotus" | "circuits" | "state" | "other";
  const urlDateFrom = searchParams.get("dateFrom") ?? "";
  const urlDateTo = searchParams.get("dateTo") ?? "";
  const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [court, setCourt] = useState(urlCourt);
  const [dateFrom, setDateFrom] = useState(urlDateFrom);
  const [dateTo, setDateTo] = useState(urlDateTo);
  const [page, setPage] = useState(urlPage);
  const [data, setData] = useState<OpinionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const pushUrl = useCallback(
    (c: string, df: string, dt: string, p: number) => {
      const sp = new URLSearchParams();
      if (c !== "all") sp.set("court", c);
      if (df) sp.set("dateFrom", df);
      if (dt) sp.set("dateTo", dt);
      if (p > 1) sp.set("page", String(p));
      const qs = sp.toString();
      router.push(`/opinions${qs ? "?" + qs : ""}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    setCourt(urlCourt);
    setDateFrom(urlDateFrom);
    setDateTo(urlDateTo);
    setPage(urlPage);
  }, [urlCourt, urlDateFrom, urlDateTo, urlPage]);

  useEffect(() => {
    setLoading(true);
    const sp = new URLSearchParams({ limit: "50", page: String(page) });
    if (court !== "all") sp.set("court", court);
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);

    fetch(`/api/opinions?${sp.toString()}`)
      .then(r => r.json())
      .then((d: OpinionsResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [court, dateFrom, dateTo, page]);

  function handleCourtChange(v: string) {
    setCourt(v as typeof court);
    setPage(1);
    pushUrl(v, dateFrom, dateTo, 1);
  }

  function handleDateFromChange(v: string) {
    setDateFrom(v);
    setPage(1);
    pushUrl(court, v, dateTo, 1);
  }

  function handleDateToChange(v: string) {
    setDateTo(v);
    setPage(1);
    pushUrl(court, dateFrom, v, 1);
  }

  function handlePage(p: number) {
    setPage(p);
    pushUrl(court, dateFrom, dateTo, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Court Opinions</h1>
        <p className="text-gray-400 text-sm mb-6">
          {total.toLocaleString()} opinions from CourtListener — SCOTUS, federal circuits, state supreme courts, and more.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Court pills */}
          <div className="flex gap-2 flex-wrap">
            {COURTS.map(c => (
              <button
                key={c.value}
                onClick={() => handleCourtChange(c.value)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  court === c.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={dateFrom}
              onChange={e => handleDateFromChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
              placeholder="From"
            />
            <span className="text-gray-500 text-sm">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => handleDateToChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
              placeholder="To"
            />
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : !data || data.results.length === 0 ? (
          <p className="text-gray-500 text-sm">No opinions found.</p>
        ) : (
          <>
            <div className="space-y-2">
              {data.results.map(op => (
                <Link
                  key={op.id}
                  href={`/claims/${op.id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium leading-snug truncate">{op.caseName}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            COURT_STYLE[op.court] ?? "bg-gray-800 text-gray-400 border border-gray-700"
                          }`}
                        >
                          {op.court}
                        </span>
                        <span className="text-gray-500 text-xs">{formatDate(op.date)}</span>
                        {op.linkedLegislation > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-400 border border-emerald-900/50">
                            {op.linkedLegislation} bill{op.linkedLegislation !== 1 ? "s" : ""} linked
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <EpistemicAxisBadge axis={op.epistemicAxis} />
                      {op.sourceUrl && (
                        <a
                          href={op.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
                        >
                          CourtListener ↗
                        </a>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => handlePage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-sm disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="text-gray-400 text-sm">
                  Page {page} of {pages}
                </span>
                <button
                  onClick={() => handlePage(Math.min(pages, page + 1))}
                  disabled={page >= pages}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-sm disabled:opacity-40"
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
