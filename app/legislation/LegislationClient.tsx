"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type BillHit = {
  id: string;
  title: string;
  body: string | null;
  status: string | null;
  billType: string | null;
  billNumber: string | null;
  congress: number | null;
  sourceUrl: string | null;
  introducedDate: string | null;
  updatedAt: string;
};

type BillsResponse = {
  bills: BillHit[];
  total: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 25;

const STATUSES = [
  { value: "all", label: "All" },
  { value: "status-introduced", label: "Introduced" },
  { value: "status-in-progress", label: "In Progress" },
  { value: "status-passed-house", label: "Passed House" },
  { value: "status-passed-senate", label: "Passed Senate" },
  { value: "status-enacted", label: "Enacted" },
  { value: "status-vetoed", label: "Vetoed" },
] as const;

const TYPES = [
  { value: "all", label: "All types" },
  { value: "hr", label: "House Bills (HR)" },
  { value: "s", label: "Senate Bills (S)" },
  { value: "hjres", label: "Joint Resolutions (HJRES)" },
  { value: "sjres", label: "Joint Resolutions (SJRES)" },
  { value: "hres", label: "House Resolutions" },
  { value: "sres", label: "Senate Resolutions" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  "status-enacted": "bg-green-950 text-green-400 border border-green-900/50",
  "status-passed-house": "bg-blue-950 text-blue-300 border border-blue-900/50",
  "status-passed-senate": "bg-blue-950 text-blue-300 border border-blue-900/50",
  "status-in-progress": "bg-yellow-950 text-yellow-400 border border-yellow-900/50",
  "status-introduced": "bg-gray-800 text-gray-400 border border-gray-700/50",
  "status-vetoed": "bg-red-950 text-red-400 border border-red-900/50",
};

const STATUS_LABEL: Record<string, string> = {
  "status-enacted": "Enacted",
  "status-passed-house": "Passed House",
  "status-passed-senate": "Passed Senate",
  "status-in-progress": "In Progress",
  "status-introduced": "Introduced",
  "status-vetoed": "Vetoed",
};

const TYPE_LABEL: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
};

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export default function LegislationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlStatus = searchParams.get("status") ?? "all";
  const urlType = searchParams.get("type") ?? "all";
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [input, setInput] = useState(urlQ);
  const [data, setData] = useState<BillsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  const pushUrl = useCallback(
    (overrides: Partial<{ status: string; type: string; q: string; page: number }>) => {
      const next = new URLSearchParams(searchParams.toString());
      if (overrides.status !== undefined) {
        if (overrides.status === "all") next.delete("status");
        else next.set("status", overrides.status);
      }
      if (overrides.type !== undefined) {
        if (overrides.type === "all") next.delete("type");
        else next.set("type", overrides.type);
      }
      if (overrides.q !== undefined) {
        if (overrides.q) next.set("q", overrides.q);
        else next.delete("q");
      }
      if (overrides.page !== undefined) {
        if (overrides.page > 1) next.set("page", String(overrides.page));
        else next.delete("page");
      }
      const qs = next.toString();
      router.replace(qs ? `/legislation?${qs}` : "/legislation");
    },
    [router, searchParams],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const p = new URLSearchParams();
    if (urlQ) p.set("q", urlQ);
    if (urlStatus !== "all") p.set("status", urlStatus);
    if (urlType !== "all") p.set("type", urlType);
    p.set("page", String(urlPage));
    p.set("limit", String(PAGE_SIZE));
    fetch(`/api/legislation?${p.toString()}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return (await r.json()) as BillsResponse;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load bills");
        setLoading(false);
      });
    return () => controller.abort();
  }, [urlQ, urlStatus, urlType, urlPage]);

  function onInputChange(v: string) {
    setInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ q: v.trim(), page: 1 });
    }, 300);
  }

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : (urlPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(total, (urlPage - 1) * PAGE_SIZE + (data?.bills.length ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Congress Tracker</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">119th Congress</h1>
        <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">
          Live bill status — sourced from congress.gov. Filter by status, chamber, or search by title or bill number.
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={e => onInputChange(e.target.value)}
          placeholder="Search by title or bill number…"
          className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Status</span>
          {STATUSES.map(s => {
            const active = urlStatus === s.value;
            return (
              <button
                key={s.value}
                onClick={() => pushUrl({ status: s.value, page: 1 })}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-white text-gray-950 border-white font-medium"
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Type</span>
          <select
            value={urlType}
            onChange={e => pushUrl({ type: e.target.value, page: 1 })}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500 transition-colors"
          >
            {TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && !data && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 animate-pulse"
            >
              <div className="h-3 w-2/3 bg-gray-800 rounded" />
              <div className="mt-2 h-2 w-1/2 bg-gray-800/60 rounded" />
              <div className="mt-3 flex gap-2">
                <div className="h-4 w-16 bg-gray-800 rounded-full" />
                <div className="h-4 w-12 bg-gray-800 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && !error && (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {total === 0
                ? "No matching bills"
                : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
            {loading && <span className="text-gray-600">Refreshing…</span>}
          </div>

          {total === 0 && !urlQ && urlStatus === "all" && urlType === "all" ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-6 py-12 text-center">
              <p className="text-sm text-gray-400">Bills are being indexed. Check back soon.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.bills.map(b => (
                <BillRow key={b.id} bill={b} />
              ))}
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center gap-3 text-xs text-gray-500 pt-2">
              <button
                onClick={() => pushUrl({ page: Math.max(1, urlPage - 1) })}
                disabled={urlPage <= 1}
                className="hover:text-gray-300 disabled:opacity-30 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-gray-700">·</span>
              <span>
                Page {urlPage.toLocaleString()} of {pageCount.toLocaleString()}
              </span>
              <span className="text-gray-700">·</span>
              <button
                onClick={() => pushUrl({ page: urlPage + 1 })}
                disabled={urlPage >= pageCount}
                className="hover:text-gray-300 disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BillRow({ bill }: { bill: BillHit }) {
  const status = bill.status ?? "status-introduced";
  const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE["status-introduced"]!;
  const statusLabel = STATUS_LABEL[status] ?? "Status unknown";
  const typeLabel = bill.billType ? TYPE_LABEL[bill.billType] ?? bill.billType.toUpperCase() : null;
  const billRef = typeLabel && bill.billNumber ? `${typeLabel} ${bill.billNumber}` : null;

  return (
    <div className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${statusStyle}`}>
              {statusLabel}
            </span>
            {billRef && (
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-800 text-gray-400 border border-gray-700/50">
                {billRef}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-200 group-hover:text-white leading-snug line-clamp-2">
            {bill.title}
          </p>
          {bill.body && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-1">
              {truncate(bill.body, 180)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-500 font-mono whitespace-nowrap">
            {formatDate(bill.introducedDate)}
          </div>
          {bill.sourceUrl && (
            <a
              href={bill.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10px] text-gray-500 hover:text-blue-300 transition-colors uppercase tracking-widest"
            >
              congress.gov →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
