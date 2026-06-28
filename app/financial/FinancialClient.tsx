"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Tab = "insider" | "earnings" | "congress" | "macro";
type Filter = "all" | "purchase" | "sale";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#60a5fa",
};

const TX_INLINE: Record<string, React.CSSProperties> = {
  purchase: { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" },
  sale:     { background: "rgba(239,68,68,0.12)",  color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" },
  grant:    { background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" },
  other:    { background: "rgba(139,139,163,0.12)", color: C.mut,   border: `1px solid ${C.panelEdge}` },
};

const PARTY_INLINE: Record<string, React.CSSProperties> = {
  D: { background: "rgba(96,165,250,0.12)",  color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" },
  R: { background: "rgba(239,68,68,0.12)",   color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" },
  I: { background: "rgba(139,139,163,0.12)", color: C.mut,     border: `1px solid ${C.panelEdge}` },
};

const SERIES_INFO: Record<string, { name: string; units: string; color: string }> = {
  UNRATE:    { name: "Unemployment Rate",       units: "%",          color: "#f87171" },
  GDP:       { name: "Gross Domestic Product",  units: "Billions $", color: "#4ade80" },
  CPIAUCSL:  { name: "Consumer Price Index",    units: "Index",      color: "#facc15" },
  FEDFUNDS:  { name: "Fed Funds Rate",          units: "%",          color: "#60a5fa" },
  M2SL:     { name: "M2 Money Supply",         units: "Billions $", color: "#c084fc" },
  CSUSHPINSA:{ name: "Case-Shiller Home Price", units: "Index",      color: "#fb923c" },
};

const TABS: { value: Tab; label: string; description: string }[] = [
  { value: "insider",  label: "Insider Activity",  description: "SEC Form 4 filings — corporate insider stock trades" },
  { value: "earnings", label: "Earnings",           description: "SEC 10-K/10-Q filings from major companies" },
  { value: "congress", label: "Congress Trades",   description: "STOCK Act disclosures from members of Congress" },
  { value: "macro",    label: "Macro",              description: "FRED economic indicators — unemployment, GDP, CPI, Fed Funds" },
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
  if (!max && min) return `> ${fmt(min)}`;
  if (!min && max) return `< ${fmt(max)}`;
  if (!min && !max) return "—";
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
        if (overrides.tab === "congress") next.delete("tab");
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
    <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem", padding: "0 0 4rem" }}>
      {/* Sticky sub-nav */}
      <nav style={{ background: C.panel, borderBottom: `1px solid ${C.panelEdge}`, padding: "0 2rem", display: "flex", alignItems: "center", gap: "2rem", height: 56, position: "sticky", top: 48, zIndex: 40 }}>
        <Link href="/" style={{ color: C.brand, fontWeight: 700, fontSize: "1rem", textDecoration: "none" }}>⬡ Epistemic Receipts</Link>
        <span style={{ color: C.mut, fontSize: "0.85rem" }}>Financial Disclosures</span>
      </nav>

      {/* Content area */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 2rem 0" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.7rem", color: C.faint, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.25rem" }}>
            Financial Disclosures
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: C.ink, margin: "0 0 0.5rem" }}>
            Markets &amp; Accountability
          </h1>
          <p style={{ color: C.mut, fontSize: "0.875rem", lineHeight: 1.6, maxWidth: "42rem", margin: 0 }}>
            Verified financial disclosures: SEC insider trading (Form 4), Congressional stock trades (STOCK Act),
            corporate earnings filings (10-K/10-Q), and macroeconomic indicators (FRED).
          </p>
        </div>

        {/* Tab navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: `1px solid ${C.panelEdge}`, overflowX: "auto", marginBottom: "0.75rem" }}>
          {TABS.map((t) => {
            const active = urlTab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => pushUrl({ tab: t.value, page: 1 })}
                title={t.description}
                style={{
                  fontSize: "0.875rem",
                  padding: "0.5rem 1rem",
                  border: "none",
                  borderBottom: active ? `2px solid ${C.brand}` : "2px solid transparent",
                  background: "transparent",
                  color: active ? C.brand : C.mut,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  marginBottom: -1,
                  transition: "color 0.15s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab description */}
        <p style={{ fontSize: "0.75rem", color: C.faint, marginBottom: "1rem" }}>{tabInfo.description}</p>

        {/* Filters */}
        <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
            style={{
              width: "100%",
              background: C.panel,
              border: `1px solid ${C.panelEdge}`,
              borderRadius: 8,
              color: C.ink,
              fontSize: "0.875rem",
              padding: "0.5rem 0.75rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Transaction type filter for insider and congress tabs */}
          {(urlTab === "insider" || urlTab === "congress") && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.7rem", color: C.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginRight: 4 }}>
                Type
              </span>
              {(["all", "purchase", "sale"] as const).map((f) => {
                const active = urlFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => pushUrl({ filter: f, page: 1 })}
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.2rem 0.75rem",
                      borderRadius: 9999,
                      border: active ? `1px solid ${C.brand}` : `1px solid ${C.panelEdge}`,
                      background: active ? "rgba(212,168,83,0.15)" : "transparent",
                      color: active ? C.brand : C.mut,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {f === "all" ? "All" : f === "purchase" ? "Purchases" : "Sales"}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && <p style={{ fontSize: "0.875rem", color: C.red, marginBottom: "1rem" }}>{error}</p>}

        {loading && !data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.panelEdge}`,
                  borderRadius: 10,
                  padding: "0.75rem 1rem",
                }}
              >
                <div style={{ height: 12, width: "66%", background: C.panelEdge, borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 8, width: "50%", background: C.panelEdge, borderRadius: 4, opacity: 0.6 }} />
              </div>
            ))}
          </div>
        )}

        {data && !error && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: C.mut, marginBottom: "0.75rem" }}>
              <span>
                {total === 0
                  ? "No matching results"
                  : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${total.toLocaleString()}`}
              </span>
              {loading && <span style={{ color: C.faint }}>Refreshing…</span>}
            </div>

            {total === 0 ? (
              <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: "3rem 1.5rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.875rem", color: C.mut }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.75rem", color: C.mut, paddingTop: "0.5rem" }}>
                <button
                  onClick={() => pushUrl({ page: Math.max(1, urlPage - 1) })}
                  disabled={urlPage <= 1}
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, opacity: urlPage <= 1 ? 0.3 : 1 }}
                  onMouseEnter={(e) => { if (urlPage > 1) (e.currentTarget as HTMLButtonElement).style.color = C.ink; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.mut; }}
                >
                  ← Previous
                </button>
                <span style={{ color: C.faint }}>·</span>
                <span>
                  Page {urlPage.toLocaleString()} of {pageCount.toLocaleString()}
                </span>
                <span style={{ color: C.faint }}>·</span>
                <button
                  onClick={() => pushUrl({ page: urlPage + 1 })}
                  disabled={urlPage >= pageCount}
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, opacity: urlPage >= pageCount ? 0.3 : 1 }}
                  onMouseEnter={(e) => { if (urlPage < pageCount) (e.currentTarget as HTMLButtonElement).style.color = C.ink; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.mut; }}
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

function InsiderRow({ hit }: { hit: InsiderHit }) {
  const txStyle = TX_INLINE[hit.transactionType] ?? TX_INLINE.other!;
  const priceStr = hit.pricePerShare ? `$${hit.pricePerShare.toFixed(2)}` : "—";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.panel,
        border: `1px solid ${hovered ? C.mut : C.panelEdge}`,
        borderRadius: 10,
        padding: "0.75rem 1rem",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: 9999, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", ...txStyle }}>
              {hit.transactionType}
            </span>
            <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: 4, fontFamily: "monospace", background: "rgba(139,139,163,0.1)", color: C.mut, border: `1px solid ${C.panelEdge}` }}>
              {formatNumber(hit.shares)} shares
            </span>
            <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: 4, fontFamily: "monospace", background: "rgba(139,139,163,0.1)", color: C.mut, border: `1px solid ${C.panelEdge}` }}>
              @ {priceStr}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: hovered ? C.ink : "#d1d1e0", lineHeight: 1.4, margin: 0 }}>
            <span style={{ fontWeight: 500 }}>{hit.filerName}</span>
            <span style={{ color: C.faint }}> → </span>
            <span>{hit.issuerName}</span>
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: "0.625rem", color: C.faint, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Traded</div>
          <div style={{ fontSize: "0.75rem", color: C.mut, fontFamily: "monospace", whiteSpace: "nowrap" }}>{formatDate(hit.transactionDate)}</div>
          {hit.sourceUrl && (
            <a
              href={hit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 4, display: "inline-block", fontSize: "0.625rem", color: C.faint, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.1em" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.blue; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.faint; }}
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
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.panel,
        border: `1px solid ${hovered ? C.mut : C.panelEdge}`,
        borderRadius: 10,
        padding: "0.75rem 1rem",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: 4, fontFamily: "monospace", background: "rgba(139,139,163,0.1)", color: C.mut, border: `1px solid ${C.panelEdge}` }}>
              {hit.formType}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: hovered ? C.ink : "#d1d1e0", lineHeight: 1.4, fontWeight: 500, margin: "0 0 0.25rem" }}>
            {hit.companyName}
          </p>
          <p style={{ fontSize: "0.75rem", color: C.faint, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {hit.claimText}
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: "0.75rem", color: C.mut, fontFamily: "monospace", whiteSpace: "nowrap" }}>{formatDate(hit.filingDate)}</div>
          {hit.sourceUrl && (
            <a
              href={hit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 4, display: "inline-block", fontSize: "0.625rem", color: C.faint, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.1em" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.blue; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.faint; }}
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
  const txStyle = TX_INLINE[hit.transactionType] ?? TX_INLINE.other!;
  const partyStyle = PARTY_INLINE[hit.party] ?? PARTY_INLINE.I!;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.panel,
        border: `1px solid ${hovered ? C.mut : C.panelEdge}`,
        borderRadius: 10,
        padding: "0.75rem 1rem",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: 9999, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", ...txStyle }}>
              {hit.transactionType}
            </span>
            <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: 9999, fontWeight: 600, ...partyStyle }}>
              {hit.party}-{hit.state}
            </span>
            <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: 4, fontFamily: "monospace", background: "rgba(139,139,163,0.1)", color: C.mut, border: `1px solid ${C.panelEdge}` }}>
              {hit.ticker}
            </span>
            <span style={{ fontSize: "0.625rem", color: C.faint }}>{formatAmount(hit.amountMin, hit.amountMax)}</span>
          </div>
          <p style={{ fontSize: "0.875rem", color: hovered ? C.ink : "#d1d1e0", lineHeight: 1.4, margin: 0 }}>
            <span style={{ fontWeight: 500 }}>{hit.memberName}</span>
            <span style={{ color: C.faint }}> ({hit.chamber}) </span>
            <span style={{ color: C.mut }}>→ {hit.companyName}</span>
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: "0.625rem", color: C.faint, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Traded</div>
          <div style={{ fontSize: "0.75rem", color: C.mut, fontFamily: "monospace", whiteSpace: "nowrap" }}>{formatDate(hit.tradeDate)}</div>
          {hit.sourceUrl && (
            <a
              href={hit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 4, display: "inline-block", fontSize: "0.625rem", color: C.faint, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.1em" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.blue; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.faint; }}
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
  const info = SERIES_INFO[hit.seriesId] ?? { name: hit.seriesName || hit.seriesId, units: "", color: C.mut };
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.panel,
        border: `1px solid ${hovered ? C.mut : C.panelEdge}`,
        borderRadius: 10,
        padding: "0.75rem 1rem",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: 4, fontFamily: "monospace", background: "rgba(139,139,163,0.1)", color: C.mut, border: `1px solid ${C.panelEdge}` }}>
              {hit.seriesId}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: hovered ? C.ink : "#d1d1e0", lineHeight: 1.4, margin: "0 0 0.25rem" }}>
            {info.name}
          </p>
          <p style={{ fontSize: "0.75rem", color: C.faint, margin: 0 }}>
            {info.units ? `${info.units}: ` : ""}
            <span style={{ fontFamily: "monospace", fontWeight: 500, color: info.color }}>
              {hit.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: "0.75rem", color: C.mut, fontFamily: "monospace", whiteSpace: "nowrap" }}>{formatDate(hit.date)}</div>
          <a
            href={`https://fred.stlouisfed.org/series/${hit.seriesId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 4, display: "inline-block", fontSize: "0.625rem", color: C.faint, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.1em" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.blue; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.faint; }}
          >
            FRED →
          </a>
        </div>
      </div>
    </div>
  );
}
