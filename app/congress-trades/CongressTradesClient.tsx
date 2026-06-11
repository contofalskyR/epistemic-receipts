"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DestinationNav } from "@/components/destinations/DestinationNav";

type Trade = {
  id: string;
  memberName: string;
  bioguideId: string | null;
  party: string;
  chamber: string;
  ticker: string;
  assetName: string;
  transactionType: string;
  amountRange: string;
  tradeDate: string;
  disclosureDate: string;
  tickerType: string | null;
  excessReturn: number | null;
};

const S = {
  bg: "#080810",
  surface: "#0e0e1c",
  surface2: "#14142a",
  border: "#1e1e38",
  text: "#e2e2ee",
  muted: "#888898",
  accent: "#f0a000",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#60a5fa",
  orange: "#fb923c",
  dem: "#3b82f6",
  rep: "#ef4444",
} as const;

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  return s.slice(0, 10);
}

function TradeCard({ trade }: { trade: Trade }) {
  const [open, setOpen] = useState(false);

  const txNorm = trade.transactionType.toLowerCase();
  const isBuy = txNorm === "purchase";
  const isSell = txNorm === "sale" || txNorm === "sale (partial)";
  const isOption =
    trade.tickerType === "OP" ||
    txNorm.includes("option") ||
    txNorm.includes("call") ||
    txNorm.includes("put");

  const actionLabel = isBuy ? "Buy" : isSell ? "Sell" : trade.transactionType;
  const actionStyle = isOption
    ? { background: "rgba(96,165,250,0.15)", color: S.blue, border: `1px solid rgba(96,165,250,0.25)` }
    : isBuy
    ? { background: "rgba(34,197,94,0.15)", color: S.green, border: `1px solid rgba(34,197,94,0.25)` }
    : { background: "rgba(239,68,68,0.15)", color: S.red, border: `1px solid rgba(239,68,68,0.25)` };

  const partyColor = trade.party === "D" ? S.dem : trade.party === "R" ? S.rep : S.muted;

  const disclosureDays = (() => {
    if (!trade.tradeDate || !trade.disclosureDate) return null;
    const t = new Date(trade.tradeDate);
    const d = new Date(trade.disclosureDate);
    const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
    return isNaN(diff) ? null : diff;
  })();

  return (
    <div
      style={{
        background: S.surface,
        border: `1px solid ${open ? "#2e2e50" : S.border}`,
        borderRadius: "12px",
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
    >
      {/* Card header */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto auto",
          gap: "1rem",
          alignItems: "center",
          padding: "1rem 1.25rem",
          cursor: "pointer",
        }}
      >
        {/* Ticker block */}
        <div
          style={{
            background: S.surface2,
            border: `1px solid ${S.border}`,
            borderRadius: "8px",
            padding: "0.4rem 0.7rem",
            textAlign: "center",
            minWidth: "60px",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              fontFamily: "monospace",
              color: S.accent,
            }}
          >
            {trade.ticker || "—"}
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: S.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "120px",
            }}
          >
            {trade.assetName
              ? trade.assetName.length > 18
                ? trade.assetName.slice(0, 18) + "…"
                : trade.assetName
              : ""}
          </div>
        </div>

        {/* Member info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: S.text }}>
            {trade.bioguideId ? (
              <Link
                href={`/members/${trade.bioguideId}`}
                onClick={(e) => e.stopPropagation()}
                style={{ color: S.text, textDecoration: "none" }}
              >
                {trade.memberName || "Unknown member"}
              </Link>
            ) : (
              trade.memberName || "Unknown member"
            )}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: S.muted,
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: partyColor,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span>{trade.party}</span>
            <span>·</span>
            <span>{trade.chamber}</span>
            {disclosureDays !== null && (
              <>
                <span>·</span>
                <span>{disclosureDays}d to disclose</span>
              </>
            )}
          </div>
        </div>

        {/* Action badge */}
        <div
          style={{
            ...actionStyle,
            padding: "0.3rem 0.7rem",
            borderRadius: "20px",
            fontSize: "0.75rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {actionLabel}
        </div>

        {/* Trade meta */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            alignItems: "flex-end",
          }}
        >
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: S.text }}>
            {trade.amountRange || "—"}
          </div>
          <div style={{ fontSize: "0.72rem", color: S.muted }}>
            {formatDate(trade.tradeDate)}
          </div>
          {trade.excessReturn !== null && (
            <div
              style={{
                fontSize: "0.72rem",
                color: trade.excessReturn >= 0 ? S.green : S.red,
              }}
            >
              {trade.excessReturn >= 0 ? "+" : ""}
              {trade.excessReturn.toFixed(1)}% vs S&P
            </div>
          )}
        </div>

        {/* Expand icon */}
        <div
          style={{
            color: S.muted,
            fontSize: "0.85rem",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div
          style={{
            borderTop: `1px solid ${S.border}`,
            padding: "1.25rem",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: S.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Transaction
              </div>
              <div style={{ fontSize: "0.83rem", color: S.text }}>{trade.transactionType}</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: S.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Disclosed
              </div>
              <div style={{ fontSize: "0.83rem", color: S.text }}>
                {formatDate(trade.disclosureDate)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: S.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Asset
              </div>
              <div style={{ fontSize: "0.83rem", color: S.text }}>
                {trade.assetName || "—"}
                {trade.tickerType === "OP" && (
                  <span style={{ marginLeft: "0.5rem", color: S.muted, fontSize: "0.72rem" }}>
                    (Option)
                  </span>
                )}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: S.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Amount Range
              </div>
              <div style={{ fontSize: "0.83rem", color: S.text }}>{trade.amountRange || "—"}</div>
            </div>
          </div>
          {trade.excessReturn !== null ? (
            <div
              style={{
                background: "rgba(34,197,94,0.05)",
                border: "1px solid rgba(34,197,94,0.18)",
                borderRadius: "8px",
                padding: "0.6rem 0.85rem",
                fontSize: "0.78rem",
                color: trade.excessReturn >= 0 ? S.green : S.red,
              }}
            >
              Excess return vs S&amp;P 500 since trade date:{" "}
              <strong>
                {trade.excessReturn >= 0 ? "+" : ""}
                {trade.excessReturn.toFixed(1)}%
              </strong>
              <span style={{ color: S.muted }}> · computed at ingestion</span>
            </div>
          ) : (
            <div
              style={{
                background: "rgba(240,160,0,0.05)",
                border: "1px solid rgba(240,160,0,0.15)",
                borderRadius: "8px",
                padding: "0.6rem 0.85rem",
                fontSize: "0.78rem",
                color: "#c8a060",
              }}
            >
              No return data computed for this trade yet. Vote-correlation analysis is in development.
            </div>
          )}
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              gap: "1.25rem",
              flexWrap: "wrap",
              fontSize: "0.78rem",
            }}
          >
            <Link
              href={`/claims/${trade.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{ color: S.accent, textDecoration: "none" }}
            >
              View receipt for this disclosure →
            </Link>
            {trade.bioguideId && (
              <Link
                href={`/members/${trade.bioguideId}`}
                onClick={(e) => e.stopPropagation()}
                style={{ color: S.blue, textDecoration: "none" }}
              >
                Member&apos;s voting record →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CongressTradesClient({
  initialStats,
}: {
  initialStats: { total: number; members: number; tickers: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlChamber = searchParams.get("chamber") ?? "all";
  const urlParty = searchParams.get("party") ?? "all";
  const urlCorrelation = searchParams.get("correlation") ?? "all";
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState(urlQ);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUrl = useCallback(
    (overrides: Record<string, string>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (!v || v === "all" || v === "1") p.delete(k);
        else p.set(k, v);
      }
      router.push(`/congress-trades?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (urlChamber !== "all") params.set("chamber", urlChamber);
    if (urlParty !== "all") params.set("party", urlParty);
    if (urlQ) params.set("q", urlQ);
    if (urlPage > 1) params.set("page", String(urlPage));

    if (urlCorrelation !== "all") params.set("correlation", urlCorrelation);

    fetch(`/api/congress-trades?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setTrades(d.trades ?? []);
        setTotal(d.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [urlChamber, urlParty, urlCorrelation, urlQ, urlPage]);

  const handleQChange = (v: string) => {
    setQInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ q: v, page: "1" });
    }, 300);
  };

  const Chip = ({
    label,
    value,
    current,
    onSelect,
  }: {
    label: string;
    value: string;
    current: string;
    onSelect: (v: string) => void;
  }) => {
    const active = current === value;
    return (
      <button
        onClick={() => onSelect(value)}
        style={{
          background: active ? S.accent : S.surface,
          border: `1px solid ${active ? S.accent : S.border}`,
          borderRadius: "20px",
          padding: "0.35rem 0.85rem",
          fontSize: "0.8rem",
          cursor: "pointer",
          color: active ? "#000" : S.muted,
          fontWeight: active ? 600 : 400,
          transition: "all 0.15s",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <DestinationNav />

      {/* Header */}
      <div style={{ padding: "2.5rem 2rem 0", maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.4rem", color: S.text }}>
          Congress <span style={{ color: S.accent }}>Trades</span>
        </h1>
        <p style={{ color: S.muted, fontSize: "0.9rem", maxWidth: "600px", lineHeight: 1.5 }}>
          STOCK Act disclosures from House and Senate members. Every trade is sourced from mandatory
          Periodic Transaction Reports.
        </p>
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.6rem 0.9rem",
            background: "rgba(240,160,0,0.08)",
            border: "1px solid rgba(240,160,0,0.2)",
            borderRadius: "8px",
            fontSize: "0.78rem",
            color: "#c8a060",
          }}
        >
          ⚠ All figures are self-reported ranges as required by the STOCK Act. Correlation with votes is in development.
        </div>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          padding: "1.5rem 2rem",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {[
          { val: initialStats.total.toLocaleString(), label: "Disclosures tracked" },
          { val: initialStats.members.toLocaleString(), label: "Members with trades" },
          { val: initialStats.tickers.toLocaleString(), label: "Unique tickers" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: "10px",
              padding: "0.9rem 1.2rem",
              minWidth: "140px",
            }}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: S.accent }}>{s.val}</div>
            <div style={{ fontSize: "0.75rem", color: S.muted, marginTop: "0.2rem" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          padding: "0 2rem 1.5rem",
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: "200px",
            maxWidth: "340px",
          }}
        >
          <input
            value={qInput}
            onChange={(e) => handleQChange(e.target.value)}
            placeholder="Search member, ticker, asset…"
            style={{
              width: "100%",
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: "8px",
              padding: "0.45rem 0.85rem",
              color: S.text,
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
        </div>

        <span style={{ fontSize: "0.75rem", color: S.muted }}>Chamber</span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {["all", "House", "Senate"].map((v) => (
            <Chip
              key={v}
              label={v === "all" ? "All" : v}
              value={v}
              current={urlChamber}
              onSelect={(val) => pushUrl({ chamber: val, page: "1" })}
            />
          ))}
        </div>

        <span style={{ fontSize: "0.75rem", color: S.muted }}>Party</span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {["all", "D", "R"].map((v) => (
            <Chip
              key={v}
              label={v === "all" ? "All" : v === "D" ? "Dem" : "Rep"}
              value={v}
              current={urlParty}
              onSelect={(val) => pushUrl({ party: val, page: "1" })}
            />
          ))}
        </div>

        <span style={{ fontSize: "0.75rem", color: S.muted }}>Voting record</span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {[
            { v: "all", label: "All" },
            { v: "with-votes", label: "Has voting history" },
          ].map((opt) => (
            <Chip
              key={opt.v}
              label={opt.label}
              value={opt.v}
              current={urlCorrelation}
              onSelect={(val) => pushUrl({ correlation: val, page: "1" })}
            />
          ))}
        </div>
      </div>

      {/* Results meta */}
      <div
        style={{
          padding: "0 2rem 0.75rem",
          maxWidth: "1200px",
          margin: "0 auto",
          fontSize: "0.8rem",
          color: S.muted,
        }}
      >
        {loading ? "Loading…" : `${total.toLocaleString()} trades`}
      </div>

      {/* Trades list */}
      <div
        style={{
          padding: "0 2rem 3rem",
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: S.muted }}>
            Loading trades…
          </div>
        ) : trades.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: S.muted }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📭</div>
            No trades found matching your filters.
          </div>
        ) : (
          trades.map((t) => <TradeCard key={t.id} trade={t} />)
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 25 && (
        <div
          style={{
            padding: "0 2rem 2rem",
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <button
            disabled={urlPage <= 1}
            onClick={() => pushUrl({ page: String(urlPage - 1) })}
            style={{
              padding: "0.45rem 1rem",
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: "8px",
              color: urlPage <= 1 ? S.muted : S.text,
              cursor: urlPage <= 1 ? "not-allowed" : "pointer",
              opacity: urlPage <= 1 ? 0.4 : 1,
              fontSize: "0.82rem",
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: "0.8rem", color: S.muted }}>
            Page {urlPage} · {total.toLocaleString()} total
          </span>
          <button
            disabled={urlPage * 25 >= total}
            onClick={() => pushUrl({ page: String(urlPage + 1) })}
            style={{
              padding: "0.45rem 1rem",
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: "8px",
              color: urlPage * 25 >= total ? S.muted : S.text,
              cursor: urlPage * 25 >= total ? "not-allowed" : "pointer",
              opacity: urlPage * 25 >= total ? 0.4 : 1,
              fontSize: "0.82rem",
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
