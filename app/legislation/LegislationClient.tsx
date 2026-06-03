"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Country = "us" | "ca" | "nz";
type Outcome = "enacted" | "passed" | "vetoed" | "failed" | "active";
type View = "status" | "outcomes" | "full";

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
  latestActionDate: string | null;
  latestActionText: string | null;
  outcome: Outcome;
};

type BillsResponse = {
  bills: BillHit[];
  total: number;
  page: number;
  limit: number;
  lastRefresh: string | null;
  outcomeCounts?: Record<Outcome, number>;
  countries?: Record<string, { label: string }>;
};

const PAGE_SIZE = 25;
const FULL_PAGE_SIZE = 50;

const COUNTRY_TABS: {
  value: Country;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}[] = [
  {
    value: "us",
    label: "🇺🇸 US Congress",
    eyebrow: "Congress Tracker",
    title: "119th Congress",
    description:
      "Live bill status — sourced from congress.gov. Filter by status, chamber, or search by title or bill number.",
  },
  {
    value: "ca",
    label: "🇨🇦 Canada",
    eyebrow: "Canadian Parliament",
    title: "Royal Assent Bills",
    description:
      "Acts of the Parliament of Canada that received Royal Assent, 35th Parliament (1994) to present. Sourced from LEGISinfo.",
  },
  {
    value: "nz",
    label: "🇳🇿 New Zealand",
    eyebrow: "New Zealand Parliament",
    title: "Acts and Bills",
    description:
      "New Zealand public acts in force and bills, sourced from the Parliamentary Counsel Office legislation API.",
  },
];

const COUNTRY_LINK_LABEL: Record<Country, string> = {
  us: "congress.gov",
  ca: "parl.ca",
  nz: "legislation.govt.nz",
};

const VIEWS: { value: View; label: string; description: string }[] = [
  { value: "status", label: "By Status", description: "Filter by current bill status" },
  { value: "outcomes", label: "Terminal Outcomes", description: "Bills that reached enacted, vetoed, or failed" },
  { value: "full", label: "Full 119th Record", description: "Every tracked bill, grouped by outcome" },
];

const STATUSES = [
  { value: "all", label: "All" },
  { value: "status-introduced", label: "Introduced" },
  { value: "status-in-progress", label: "In Progress" },
  { value: "status-passed-house", label: "Passed House" },
  { value: "status-passed-senate", label: "Passed Senate" },
  { value: "status-enacted", label: "Enacted" },
  { value: "status-vetoed", label: "Vetoed" },
  { value: "status-failed", label: "Failed" },
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
  "status-failed": "bg-gray-800 text-gray-500 border border-gray-700/50",
};

const STATUS_LABEL: Record<string, string> = {
  "status-enacted": "Enacted",
  "status-passed-house": "Passed House",
  "status-passed-senate": "Passed Senate",
  "status-in-progress": "In Progress",
  "status-introduced": "Introduced",
  "status-vetoed": "Vetoed",
  "status-failed": "Failed",
};

const FOREIGN_STATUS_STYLE = "bg-gray-800 text-gray-400 border border-gray-700/50";

const OUTCOME_LABEL: Record<Outcome, string> = {
  enacted: "Enacted",
  passed: "Passed",
  vetoed: "Vetoed",
  failed: "Failed",
  active: "Still Active",
};

const OUTCOME_BADGE_STYLE: Record<Outcome, string> = {
  enacted: "bg-green-950/60 text-green-300 border border-green-800/60",
  passed: "bg-blue-950/60 text-blue-300 border border-blue-800/60",
  vetoed: "bg-red-950/60 text-red-300 border border-red-800/60",
  failed: "bg-gray-900 text-gray-400 border border-gray-700",
  active: "bg-yellow-950/40 text-yellow-300 border border-yellow-900/40",
};

const OUTCOME_OUTCOME_PROMINENT: Record<Outcome, string> = {
  enacted: "text-green-400",
  passed: "text-blue-300",
  vetoed: "text-red-400",
  failed: "text-gray-400",
  active: "text-yellow-300",
};

const OUTCOME_ORDER: Outcome[] = ["enacted", "passed", "vetoed", "failed", "active"];

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

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseCountry(raw: string | null): Country {
  if (raw === "ca" || raw === "nz") return raw;
  return "us";
}

function parseView(raw: string | null): View {
  if (raw === "outcomes" || raw === "full") return raw;
  return "status";
}

export default function LegislationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlCountry = parseCountry(searchParams.get("country"));
  const urlView = urlCountry === "us" ? parseView(searchParams.get("view")) : "status";
  const urlStatus = urlCountry === "us" ? (searchParams.get("status") ?? "all") : "all";
  const urlType = urlCountry === "us" ? (searchParams.get("type") ?? "all") : "all";
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const pageSize = urlView === "full" ? FULL_PAGE_SIZE : PAGE_SIZE;

  const [input, setInput] = useState(urlQ);
  const [data, setData] = useState<BillsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  const pushUrl = useCallback(
    (overrides: Partial<{ country: Country; view: View; status: string; type: string; q: string; page: number }>) => {
      const next = new URLSearchParams(searchParams.toString());

      if (overrides.country !== undefined) {
        if (overrides.country === "us") next.delete("country");
        else next.set("country", overrides.country);
        // Reset country-specific params on country switch
        next.delete("view");
        next.delete("status");
        next.delete("type");
        next.delete("page");
      }

      if (overrides.view !== undefined) {
        if (overrides.view === "status") next.delete("view");
        else next.set("view", overrides.view);
      }
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
    if (urlCountry !== "us") p.set("country", urlCountry);
    if (urlQ) p.set("q", urlQ);
    if (urlCountry === "us") {
      if (urlView === "outcomes") {
        p.set("status", "terminal");
      } else if (urlView === "full") {
        p.set("view", "full");
      } else if (urlStatus !== "all") {
        p.set("status", urlStatus);
      }
      if (urlType !== "all") p.set("type", urlType);
    }
    p.set("page", String(urlPage));
    p.set("limit", String(pageSize));
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
  }, [urlCountry, urlView, urlQ, urlStatus, urlType, urlPage, pageSize]);

  function onInputChange(v: string) {
    setInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ q: v.trim(), page: 1 });
    }, 300);
  }

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (urlPage - 1) * pageSize + 1;
  const showingTo = Math.min(total, (urlPage - 1) * pageSize + (data?.bills.length ?? 0));

  const countryInfo = COUNTRY_TABS.find(t => t.value === urlCountry)!;

  return (
    <div className="space-y-6">
      {/* Country switcher */}
      <div className="flex items-center gap-1 border-b border-gray-800">
        {COUNTRY_TABS.map(ct => {
          const active = urlCountry === ct.value;
          return (
            <button
              key={ct.value}
              onClick={() => pushUrl({ country: ct.value, page: 1 })}
              className={`text-sm px-3 py-2 border-b-2 transition-colors -mb-px ${
                active
                  ? "border-white text-white font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {ct.label}
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">{countryInfo.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{countryInfo.title}</h1>
        <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">{countryInfo.description}</p>
      </div>

      {/* AutoUpdateBanner — US only (live tracker) */}
      {urlCountry === "us" && <AutoUpdateBanner lastRefresh={data?.lastRefresh ?? null} />}

      {/* View tabs — US only */}
      {urlCountry === "us" && (
        <div className="flex items-center gap-1 border-b border-gray-800">
          {VIEWS.map(v => {
            const active = urlView === v.value;
            return (
              <button
                key={v.value}
                onClick={() => pushUrl({ view: v.value, page: 1 })}
                title={v.description}
                className={`text-xs px-3 py-2 border-b-2 transition-colors -mb-px ${
                  active
                    ? "border-white text-white font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {urlCountry === "us" && urlView === "outcomes" && (
        <p className="text-xs text-gray-500 leading-relaxed">
          Bills that have reached a terminal state — signed into law, vetoed, or formally failed. Sorted by the date they
          were introduced (most recent first); the final-action date is shown alongside the outcome.
        </p>
      )}

      {urlCountry === "us" && urlView === "full" && data?.outcomeCounts && (() => {
        const counts = data.outcomeCounts;
        return (
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span className="text-gray-600 uppercase tracking-widest">Outcome counts</span>
            {OUTCOME_ORDER.map(o => (
              <span key={o} className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  o === "enacted" ? "bg-green-500" :
                  o === "passed" ? "bg-blue-400" :
                  o === "vetoed" ? "bg-red-500" :
                  o === "failed" ? "bg-gray-400" :
                  "bg-yellow-400"
                }`} />
                <span className="text-gray-400">{OUTCOME_LABEL[o]}</span>
                <span className="font-mono text-gray-500">{counts[o].toLocaleString()}</span>
              </span>
            ))}
          </div>
        );
      })()}

      {/* Filters */}
      <div className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={e => onInputChange(e.target.value)}
          placeholder={
            urlCountry === "us"
              ? "Search by title or bill number…"
              : urlCountry === "ca"
              ? "Search by title or bill number…"
              : "Search by title…"
          }
          className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />

        {/* Status filter chips — US only, status view only */}
        {urlCountry === "us" && urlView === "status" && (
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
        )}

        {/* Type filter — US only */}
        {urlCountry === "us" && (
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
        )}
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
                ? "No matching results"
                : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
            {loading && <span className="text-gray-600">Refreshing…</span>}
          </div>

          {total === 0 && !urlQ && urlStatus === "all" && urlType === "all" && urlView === "status" ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-6 py-12 text-center">
              <p className="text-sm text-gray-400">
                {urlCountry === "us"
                  ? "Bills are being indexed. Check back soon."
                  : "No records available yet. Check back soon."}
              </p>
            </div>
          ) : urlCountry === "us" && urlView === "full" ? (
            <FullRecordList bills={data.bills} country={urlCountry} />
          ) : (
            <div className="space-y-2">
              {data.bills.map(b => (
                <BillRow
                  key={b.id}
                  bill={b}
                  prominentOutcome={urlCountry === "us" && urlView === "outcomes"}
                  country={urlCountry}
                />
              ))}
            </div>
          )}

          {total > pageSize && (
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

function AutoUpdateBanner({ lastRefresh }: { lastRefresh: string | null }) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2 flex items-center gap-3 text-xs">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span className="text-gray-300">
        <span className="text-gray-100 font-medium">Live tracker</span>
        <span className="text-gray-500"> — auto-refreshes every 12 hours from the </span>
        <a
          href="https://api.congress.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
        >
          Congress.gov API
        </a>
        <span className="text-gray-500">.</span>
      </span>
      <span className="ml-auto font-mono text-gray-500 shrink-0">
        Last pull: {formatRelative(lastRefresh)}
      </span>
    </div>
  );
}

function FullRecordList({ bills, country }: { bills: BillHit[]; country: Country }) {
  const grouped = OUTCOME_ORDER.map(outcome => ({
    outcome,
    bills: bills.filter(b => b.outcome === outcome),
  })).filter(g => g.bills.length > 0);

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-6 py-12 text-center">
        <p className="text-sm text-gray-400">No bills on this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(g => (
        <div key={g.outcome} className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <span className={`font-semibold ${OUTCOME_OUTCOME_PROMINENT[g.outcome]}`}>
              {OUTCOME_LABEL[g.outcome]}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500 font-mono">{g.bills.length}</span>
          </div>
          <div className="space-y-2">
            {g.bills.map(b => (
              <BillRow key={b.id} bill={b} prominentOutcome country={country} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BillRow({
  bill,
  prominentOutcome,
  country,
}: {
  bill: BillHit;
  prominentOutcome?: boolean;
  country: Country;
}) {
  const status = bill.status ?? "status-introduced";
  const isUsStatus = status.startsWith("status-");
  const statusStyle = isUsStatus
    ? (STATUS_STYLE[status] ?? STATUS_STYLE["status-introduced"]!)
    : FOREIGN_STATUS_STYLE;
  const statusLabel = STATUS_LABEL[status] ?? status ?? "Unknown";

  // Bill reference chip
  let billRef: string | null = null;
  if (country === "us") {
    const typeLabel = bill.billType ? TYPE_LABEL[bill.billType] ?? bill.billType.toUpperCase() : null;
    billRef = typeLabel && bill.billNumber ? `${typeLabel} ${bill.billNumber}` : null;
  } else {
    billRef = bill.billNumber ?? null;
  }

  const outcome = bill.outcome;
  const showOutcomeBadge = prominentOutcome && outcome !== "active";
  const linkLabel = COUNTRY_LINK_LABEL[country];

  return (
    <div className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {showOutcomeBadge ? (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${OUTCOME_BADGE_STYLE[outcome]}`}>
                {OUTCOME_LABEL[outcome]}
              </span>
            ) : (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${statusStyle}`}>
                {statusLabel}
              </span>
            )}
            {billRef && (
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-800 text-gray-400 border border-gray-700/50">
                {billRef}
              </span>
            )}
            {showOutcomeBadge && isUsStatus && status !== "status-enacted" && status !== "status-vetoed" && status !== "status-failed" && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${statusStyle}`}>
                {statusLabel}
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
          {prominentOutcome ? (
            <>
              <div className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Last action</div>
              <div className="text-xs text-gray-400 font-mono whitespace-nowrap">
                {formatDate(bill.latestActionDate ?? bill.introducedDate)}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500 font-mono whitespace-nowrap">
              {formatDate(bill.introducedDate)}
            </div>
          )}
          {bill.sourceUrl && (
            <a
              href={bill.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10px] text-gray-500 hover:text-blue-300 transition-colors uppercase tracking-widest"
            >
              {linkLabel} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
