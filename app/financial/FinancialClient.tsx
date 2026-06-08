"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Tab = "insider" | "earnings" | "congress" | "macro";
type Filter = "all" | "purchase" | "sale";

const TABS: { value: Tab; label: string; description: string }[] = [
  { value: "insider", label: "Insider Activity", description: "SEC Form 4 filings — corporate insider stock trades" },
  { value: "earnings", label: "Earnings", description: "SEC 10-K/10-Q filings from major companies" },
  { value: "congress", label: "Congress Trades", description: "STOCK Act disclosures from members of Congress" },
  { value: "macro", label: "Macro", description: "FRED economic indicators — unemployment, GDP, CPI, Fed Funds" },
];

const PAGE_SIZE = 25;

interface InsiderHit {
  id: string;
  filerName: string;
  issuerName: string;
  transactionType: "purchase" | "sale" | "grant" | "other";
  shares: number;
  pricePerShare: number | null;
  transactionDate: string;
  filedDate: string;
  sourceUrl: string;
}

interface EarningsHit {
  id: string;
  companyName: string;
  formType: string;
  filingDate: string;
  accessionNumber: string;
  sourceUrl: string;
  claimText: string;
}

interface CongressHit {
  id: string;
  memberName: string;
  party: "D" | "R" | "I";
  chamber: "House" | "Senate";
  state: string;
  ticker: string;
  companyName: string;
  transactionType: "purchase" | "sale";
  amountMin: number;
  amountMax: number;
  tradeDate: string;
  disclosureDate: string;
  sourceUrl: string;
}

interface MacroHit {
  id: string;
  seriesId: string;
  seriesName: string;
  value: number;
  date: string;
  units: string;
}

type AnyHit = InsiderHit | EarningsHit | CongressHit | MacroHit;

interface FinancialResponse {
  tab: Tab;
  items: AnyHit[];
  total: number;
  page: number;
  limit: number;
}

const TX_STYLE: Record<string, string> = {
  purchase: "bg-green-950 text-green-400 border border-green-900/50",
  sale: "bg-red-950 text-red-400 border border-red-900/50",
  grant: "bg-blue-950 text-blue-300 border border-blue-900/50",
  other: "bg-gray-800 text-gray-400 border border-gray-700/50",
};

const PARTY_STYLE: Record<string, string> = {
  D: "bg-blue-950 text-blue-300 border border-blue-900/50",
  R: "bg-red-950 text-red-300 border border-red-900/50",
  I: "bg-gray-800 text-gray-400 border border-gray-700/50",
};

const SERIES_INFO: Record<string, { name: string; units: string; color: string }> = {
  UNRATE: { name: "Unemployment Rate", units: "%", color: "text-red-400" },
  GDP: { name: "Gross Domestic Product", units: "Billions $", color: "text-green-400" },
  CPIAUCSL: { name: "Consumer Price Index", units: "Index", color: "text-yellow-400" },
  FEDFUNDS: { name: "Fed Funds Rate", units: "%", color: "text-blue-400" },
  M2SL: { name: "M2 Money Supply", units: "Billions $", color: "text-purple-400" },
  CSUSHPINSA: { name: "Case-Shiller Home Price", units: "Index", color: "text-orange-400" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatAmount(min: number, max: number): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };
  return `${fmt(min)}–${fmt(max)}`;
}

function parseTab(raw: string | null): Tab {
  if (raw === "insider" || raw === "earnings" || raw === "congress" || raw === "macro") return raw;
  return "congress";
}

function parseFilter(raw: string | null): Filter {
  if (raw === "purchase" || raw === "sale") return raw;
  return "all";
}

export default function FinancialClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlTab = parseTab(searchParams.get("tab"));
  const urlFilter = parseFilter(searchParams.get("filter"));
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [input, setInput] = useState(urlQ);
  const [data, setData] = useState<FinancialResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  const pushUrl = useCallback(
    (overrides: Partial<{ tab: Tab; filter: Filter; q: string; page: number }>) => {
      const next = new URLSearchParams(searchParams.toString());

      if (overrides.tab !== undefined) {
        if (overrides.tab === "insider") next.delete("tab");
        else next.set("tab", overrides.tab);
        next.delete("filter");
        next.delete("page");
      }

      if (overrides.filter !== undefined) {
        if (overrides.filter === "all") next.delete("filter");
        else next.set("filter", overrides.filter);
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
      router.replace(qs ? `/financial?${qs}` : "/financial");
    },
    [router, searchParams],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();

    const p = new URLSearchParams();
    p.set("tab", urlTab);
    if (urlFilter !== "all") p.set("filter", urlFilter);
    if (urlQ) p.set("q", urlQ);
    p.set("page", String(urlPage));
    p.set("limit", String(PAGE_SIZE));

    fetch(`/api/financial?${p.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return (await r.json()) as FinancialResponse;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load data");
        setLoading(false);
      });

    return () => controller.abort();
  }, [urlTab, urlFilter, urlQ, urlPage]);

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
  const showingTo = Math.min(total, (urlPage - 1) * PAGE_SIZE + (data?.items.length ?? 0));

  const tabInfo = TABS.find((t) => t.value === urlTab) ?? TABS[0]!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Financial Disclosures</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Markets & Accountability</h1>
        <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">
          Verified financial disclosures: SEC insider trading (Form 4), Congressional stock trades (STOCK Act),
          corporate earnings filings (10-K/10-Q), and macroeconomic indicators (FRED).
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-gray-800 overflow-x-auto">
        {TABS.map((t) => {
          const active = urlTab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => pushUrl({ tab: t.value, page: 1 })}
              title={t.description}
              className={`text-sm px-4 py-2 border-b-2 transition-colors -mb-px whitespace-nowrap ${
                active
                  ? "border-white text-white font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab description */}
      <p className="text-xs text-gray-500">{tabInfo.description}</p>

      {/* Filters */}
      <div className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={
            urlTab === "insider"
              ? "Search by filer or company…"
              : urlTab === "earnings"
                ? "Search by company name…"
                : urlTab === "congress"
                  ? "Search by member or ticker…"
                  : "Search by series ID…"
          }
          className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />

        {/* Transaction type filter for insider and congress tabs */}
        {(urlTab === "insider" || urlTab === "congress") && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Type</span>
            {(["all", "purchase", "sale"] as const).map((f) => {
              const active = urlFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => pushUrl({ filter: f, page: 1 })}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-white text-gray-950 border-white font-medium"
                      : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {f === "all" ? "All" : f === "purchase" ? "Purchases" : "Sales"}
                </button>
              );
            })}
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

          {total === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-6 py-12 text-center">
              <p className="text-sm text-gray-400">
                {urlQ
                  ? "No results match your search."
                  : urlTab === "insider"
                    ? "No insider trading disclosures yet. Run the Form 4 ingester to populate."
                    : urlTab === "earnings"
                      ? "No earnings filings yet. Run the SEC EDGAR ingester to populate."
                      : urlTab === "congress"
                        ? "No STOCK Act disclosures yet. Run the Congress STOCK Act ingester to populate."
                        : "No macro indicators yet. Run the FRED ingester to populate."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {urlTab === "insider" &&
                (data.items as InsiderHit[]).map((hit) => <InsiderRow key={hit.id} hit={hit} />)}
              {urlTab === "earnings" &&
                (data.items as EarningsHit[]).map((hit) => <EarningsRow key={hit.id} hit={hit} />)}
              {urlTab === "congress" &&
                (data.items as CongressHit[]).map((hit) => <CongressRow key={hit.id} hit={hit} />)}
              {urlTab === "macro" &&
                (data.items as MacroHit[]).map((hit) => <MacroRow key={hit.id} hit={hit} />)}
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

function InsiderRow({ hit }: { hit: InsiderHit }) {
  const txStyle = TX_STYLE[hit.transactionType] ?? TX_STYLE.other!;
  const priceStr = hit.pricePerShare ? `$${hit.pricePerShare.toFixed(2)}` : "—";

  return (
    <div className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${txStyle}`}>
              {hit.transactionType}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-800 text-gray-400 border border-gray-700/50">
              {formatNumber(hit.shares)} shares
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-800 text-gray-400 border border-gray-700/50">
              @ {priceStr}
            </span>
          </div>
          <p className="text-sm text-gray-200 group-hover:text-white leading-snug">
            <span className="font-medium">{hit.filerName}</span>
            <span className="text-gray-500"> → </span>
            <span>{hit.issuerName}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Traded</div>
          <div className="text-xs text-gray-400 font-mono whitespace-nowrap">{formatDate(hit.transactionDate)}</div>
          {hit.sourceUrl && (
            <a
              href={hit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10px] text-gray-500 hover:text-blue-300 transition-colors uppercase tracking-widest"
            >
              SEC →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EarningsRow({ hit }: { hit: EarningsHit }) {
  return (
    <div className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-800 text-gray-400 border border-gray-700/50">
              {hit.formType}
            </span>
          </div>
          <p className="text-sm text-gray-200 group-hover:text-white leading-snug font-medium">
            {hit.companyName}
          </p>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{hit.claimText}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-400 font-mono whitespace-nowrap">{formatDate(hit.filingDate)}</div>
          {hit.sourceUrl && (
            <a
              href={hit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10px] text-gray-500 hover:text-blue-300 transition-colors uppercase tracking-widest"
            >
              Filing →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function CongressRow({ hit }: { hit: CongressHit }) {
  const txStyle = TX_STYLE[hit.transactionType] ?? TX_STYLE.other!;
  const partyStyle = PARTY_STYLE[hit.party] ?? PARTY_STYLE.I!;

  return (
    <div className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${txStyle}`}>
              {hit.transactionType}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${partyStyle}`}>
              {hit.party}-{hit.state}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-800 text-gray-400 border border-gray-700/50">
              {hit.ticker}
            </span>
            <span className="text-[10px] text-gray-500">{formatAmount(hit.amountMin, hit.amountMax)}</span>
          </div>
          <p className="text-sm text-gray-200 group-hover:text-white leading-snug">
            <span className="font-medium">{hit.memberName}</span>
            <span className="text-gray-500"> ({hit.chamber}) </span>
            <span className="text-gray-400">→ {hit.companyName}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Traded</div>
          <div className="text-xs text-gray-400 font-mono whitespace-nowrap">{formatDate(hit.tradeDate)}</div>
          {hit.sourceUrl && (
            <a
              href={hit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10px] text-gray-500 hover:text-blue-300 transition-colors uppercase tracking-widest"
            >
              Disclosure →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function MacroRow({ hit }: { hit: MacroHit }) {
  const info = SERIES_INFO[hit.seriesId] ?? { name: hit.seriesName || hit.seriesId, units: "", color: "text-gray-400" };

  return (
    <div className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-800 text-gray-400 border border-gray-700/50">
              {hit.seriesId}
            </span>
          </div>
          <p className="text-sm text-gray-200 group-hover:text-white leading-snug">{info.name}</p>
          <p className="mt-1 text-xs text-gray-500">
            {info.units ? `${info.units}: ` : ""}
            <span className={`font-mono font-medium ${info.color}`}>
              {hit.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-400 font-mono whitespace-nowrap">{formatDate(hit.date)}</div>
          <a
            href={`https://fred.stlouisfed.org/series/${hit.seriesId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[10px] text-gray-500 hover:text-blue-300 transition-colors uppercase tracking-widest"
          >
            FRED →
          </a>
        </div>
      </div>
    </div>
  );
}
