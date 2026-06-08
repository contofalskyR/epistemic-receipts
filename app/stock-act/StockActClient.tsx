"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Trade = {
  id: string;
  memberName: string;
  bioguideId: string | null;
  party: string;
  chamber: string;
  ticker: string;
  transactionType: string;
  amountRange: string;
  tradeDate: string;
  disclosureDate: string;
  tickerType: string | null;
  excessReturn: number | null;
  claimText: string;
};

type LeaderboardEntry = {
  name: string;
  party: string;
  chamber: string;
  trades: number;
  purchases: number;
  sales: number;
};

type TradesResponse = {
  total: number;
  trades: Trade[];
  offset: number;
  pageSize: number;
};

type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[];
};

const PAGE_SIZE = 50;

const PARTY_STYLE: Record<string, string> = {
  D: "bg-blue-950 text-blue-300 border border-blue-900/50",
  R: "bg-red-950 text-red-300 border border-red-900/50",
  I: "bg-gray-800 text-gray-400 border border-gray-700/50",
};

const TX_STYLE: Record<string, string> = {
  purchase: "bg-green-950 text-green-300 border border-green-900/50",
  sale: "bg-red-950 text-red-300 border border-red-900/50",
  exchange: "bg-yellow-950 text-yellow-300 border border-yellow-900/50",
};

const CHAMBER_STYLE: Record<string, string> = {
  House: "bg-blue-950 text-blue-400 border border-blue-900/40",
  Senate: "bg-purple-950 text-purple-400 border border-purple-900/40",
};

function Badge({ text, style }: { text: string; style: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${style}`}>
      {text}
    </span>
  );
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  return s.slice(0, 10);
}

export default function StockActClient({
  initialStats,
}: {
  initialStats: { total: number; members: number; tickers: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlChamber = (searchParams.get("chamber") ?? "all") as
    | "all"
    | "house"
    | "senate";
  const urlParty = (searchParams.get("party") ?? "all") as "all" | "D" | "R" | "I";
  const urlTicker = searchParams.get("ticker") ?? "";
  const urlType = (searchParams.get("type") ?? "all") as
    | "all"
    | "purchase"
    | "sale";
  const urlOffset = Math.max(
    0,
    parseInt(searchParams.get("offset") ?? "0", 10) || 0
  );
  const urlTab = (searchParams.get("tab") ?? "trades") as "trades" | "leaderboard";

  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickerInput, setTickerInput] = useState(urlTicker);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUrl = useCallback(
    (overrides: Record<string, string>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v === "" || v === "all" || v === "0") p.delete(k);
        else p.set(k, v);
      }
      router.push(`/stock-act?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    setLoading(true);
    if (urlTab === "leaderboard") {
      fetch("/api/stock-act?mode=leaderboard")
        .then((r) => r.json())
        .then((d: LeaderboardResponse) => {
          setLeaderboard(d.leaderboard ?? []);
          setLoading(false);
        });
    } else {
      const params = new URLSearchParams();
      if (urlChamber !== "all") params.set("chamber", urlChamber);
      if (urlParty !== "all") params.set("party", urlParty);
      if (urlTicker) params.set("ticker", urlTicker);
      if (urlType !== "all") params.set("type", urlType);
      if (urlOffset > 0) params.set("offset", String(urlOffset));

      fetch(`/api/stock-act?${params.toString()}`)
        .then((r) => r.json())
        .then((d: TradesResponse) => {
          setTrades(d.trades ?? []);
          setTotal(d.total ?? 0);
          setLoading(false);
        });
    }
  }, [urlTab, urlChamber, urlParty, urlTicker, urlType, urlOffset]);

  const handleTickerChange = (v: string) => {
    setTickerInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ ticker: v.toUpperCase(), offset: "0" });
    }, 300);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">
          Congressional Stock Trades
        </h1>
        <p className="text-sm text-gray-400">
          Periodic Transaction Reports filed under the{" "}
          <span className="text-gray-200">STOCK Act of 2012</span> — mandatory
          disclosure within 45 days of any trade over $1,000.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {initialStats.total.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Disclosed Trades</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {initialStats.members.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Members of Congress</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {initialStats.tickers.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Unique Tickers</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {(["trades", "leaderboard"] as const).map((t) => (
          <button
            key={t}
            onClick={() => pushUrl({ tab: t, offset: "0" })}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              urlTab === t
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "trades" ? "Recent Trades" : "Most Active Traders"}
          </button>
        ))}
      </div>

      {urlTab === "trades" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Chamber */}
            <div className="flex gap-1">
              {(["all", "house", "senate"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => pushUrl({ chamber: v, offset: "0" })}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    urlChamber === v
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {v === "all" ? "All Chambers" : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Party */}
            <div className="flex gap-1">
              {(["all", "D", "R", "I"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => pushUrl({ party: v, offset: "0" })}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    urlParty === v
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {v === "all" ? "All Parties" : v}
                </button>
              ))}
            </div>

            {/* Transaction type */}
            <div className="flex gap-1">
              {(["all", "purchase", "sale"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => pushUrl({ type: v, offset: "0" })}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    urlType === v
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {v === "all" ? "Buy & Sell" : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Ticker search */}
            <input
              value={tickerInput}
              onChange={(e) => handleTickerChange(e.target.value)}
              placeholder="Filter by ticker…"
              className="px-3 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 w-36"
            />

            {(urlChamber !== "all" ||
              urlParty !== "all" ||
              urlTicker ||
              urlType !== "all") && (
              <button
                onClick={() =>
                  pushUrl({ chamber: "all", party: "all", ticker: "", type: "all", offset: "0" })
                }
                className="px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-500 hover:text-white transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Trades table */}
          {loading ? (
            <div className="text-sm text-gray-500 py-8 text-center">Loading trades…</div>
          ) : trades.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">No trades found.</div>
          ) : (
            <>
              <div className="text-xs text-gray-500 mb-2">
                {total.toLocaleString()} trades
                {urlChamber !== "all" || urlParty !== "all" || urlTicker || urlType !== "all"
                  ? " matching filters"
                  : ""}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-4 font-medium">Member</th>
                      <th className="py-2 pr-4 font-medium">Ticker</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Trade Date</th>
                      <th className="py-2 pr-4 font-medium">Disclosed</th>
                      <th className="py-2 font-medium">Excess Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors"
                      >
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            {t.bioguideId ? (
                              <Link
                                href={`/members/${t.bioguideId}`}
                                className="text-white hover:text-blue-300 transition-colors font-medium"
                              >
                                {t.memberName}
                              </Link>
                            ) : (
                              <span className="text-white font-medium">{t.memberName}</span>
                            )}
                            <Badge
                              text={t.party}
                              style={PARTY_STYLE[t.party] ?? PARTY_STYLE.I}
                            />
                            <Badge
                              text={t.chamber}
                              style={CHAMBER_STYLE[t.chamber] ?? "bg-gray-800 text-gray-400 border border-gray-700"}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          <button
                            onClick={() =>
                              pushUrl({ ticker: t.ticker, offset: "0" })
                            }
                            className="font-mono font-bold text-amber-300 hover:text-amber-200 transition-colors"
                          >
                            {t.ticker}
                          </button>
                          {t.tickerType === "OP" && (
                            <span className="ml-1 text-xs text-gray-600">(opt)</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            text={t.transactionType}
                            style={TX_STYLE[t.transactionType] ?? "bg-gray-800 text-gray-400 border border-gray-700"}
                          />
                        </td>
                        <td className="py-2.5 pr-4 text-gray-300 text-xs whitespace-nowrap">
                          {t.amountRange}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-400 text-xs">
                          {formatDate(t.tradeDate)}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-400 text-xs">
                          {formatDate(t.disclosureDate)}
                        </td>
                        <td className="py-2.5 text-xs">
                          {t.excessReturn !== null ? (
                            <span
                              className={
                                t.excessReturn >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {t.excessReturn >= 0 ? "+" : ""}
                              {t.excessReturn.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center gap-3 mt-4">
                  <button
                    disabled={urlOffset === 0}
                    onClick={() =>
                      pushUrl({ offset: String(Math.max(0, urlOffset - PAGE_SIZE)) })
                    }
                    className="px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-400 disabled:opacity-30 hover:text-white transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-gray-500">
                    {urlOffset + 1}–{Math.min(urlOffset + PAGE_SIZE, total)} of{" "}
                    {total.toLocaleString()}
                  </span>
                  <button
                    disabled={urlOffset + PAGE_SIZE >= total}
                    onClick={() => pushUrl({ offset: String(urlOffset + PAGE_SIZE) })}
                    className="px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-400 disabled:opacity-30 hover:text-white transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {urlTab === "leaderboard" && (
        <>
          <p className="text-xs text-gray-500">
            Members ranked by number of STOCK Act disclosures in the dataset.
          </p>
          {loading ? (
            <div className="text-sm text-gray-500 py-8 text-center">
              Loading leaderboard…
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.name}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center gap-4"
                >
                  <span className="text-lg font-bold text-gray-600 w-8 text-right">
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-white font-medium">{entry.name}</span>
                    <Badge
                      text={entry.party}
                      style={PARTY_STYLE[entry.party] ?? PARTY_STYLE.I}
                    />
                    <Badge
                      text={entry.chamber}
                      style={
                        CHAMBER_STYLE[entry.chamber] ??
                        "bg-gray-800 text-gray-400 border border-gray-700"
                      }
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-400">{entry.purchases} buys</span>
                    <span className="text-red-400">{entry.sales} sells</span>
                    <span className="text-white font-bold">{entry.trades} total</span>
                  </div>
                  <button
                    onClick={() => {
                      // Filter trades by this member
                      const sp = new URLSearchParams();
                      sp.set("tab", "trades");
                      // We filter by ticker search isn't quite right but it's a workaround
                      // In practice, member filter would need a different query param
                      window.location.href = `/stock-act?tab=trades&chamber=${entry.chamber.toLowerCase()}`;
                    }}
                    className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    view →
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer note */}
      <p className="text-xs text-gray-600 border-t border-gray-900 pt-4">
        Data source: Quiver Quantitative / House &amp; Senate eFD filings. Shows{" "}
        ~1,000 most recent Periodic Transaction Reports. All figures are
        self-reported ranges as required by STOCK Act.
      </p>
    </div>
  );
}
