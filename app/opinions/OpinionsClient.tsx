"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

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

const COURT_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  SCOTUS:  { bg: "rgba(217,119,6,0.12)",  text: "#fbbf24", border: "rgba(217,119,6,0.35)" },
  Circuit: { bg: "rgba(59,130,246,0.12)", text: "#93c5fd", border: "rgba(59,130,246,0.35)" },
  State:   { bg: "rgba(139,92,246,0.12)", text: "#c4b5fd", border: "rgba(139,92,246,0.35)" },
  BIA:     { bg: "rgba(20,184,166,0.12)", text: "#5eead4", border: "rgba(20,184,166,0.35)" },
  Tax:     { bg: "rgba(34,197,94,0.12)",  text: "#86efac", border: "rgba(34,197,94,0.35)" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function CourtBadge({ court }: { court: string }) {
  const c = COURT_COLOR[court] ?? { bg: "rgba(107,114,128,0.12)", text: C.mut, border: "rgba(107,114,128,0.3)" };
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 600,
        padding: "0.15rem 0.55rem",
        borderRadius: 9999,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
    >
      {court}
    </span>
  );
}

function OpinionCard({ op }: { op: OpinionHit }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.panel,
        border: `1px solid ${hovered ? C.brand : C.panelEdge}`,
        borderRadius: 10,
        padding: "0.9rem 1.1rem",
        transition: "border-color 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <Link
          href={`/claims/${op.id}`}
          style={{
            color: C.ink,
            fontWeight: 500,
            fontSize: "0.88rem",
            lineHeight: 1.45,
            textDecoration: "none",
            flex: 1,
          }}
        >
          {op.caseName}
        </Link>
        {op.sourceUrl && (
          <a
            href={op.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              padding: "0.2rem 0.6rem",
              borderRadius: 9999,
              border: "1px solid rgba(217,119,6,0.5)",
              background: "rgba(217,119,6,0.08)",
              color: "#fbbf24",
              textDecoration: "none",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3.5 1H1v10h10V8.5M7 1h4m0 0v4m0-4L5 7"/>
            </svg>
            CourtListener
          </a>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <CourtBadge court={op.court} />
        <span style={{ fontSize: "0.75rem", color: C.faint, fontFamily: "monospace" }}>
          {formatDate(op.date)}
        </span>
        {op.linkedLegislation > 0 && (
          <span
            style={{
              fontSize: "0.7rem",
              padding: "0.1rem 0.5rem",
              borderRadius: 9999,
              background: "rgba(16,185,129,0.1)",
              color: "#6ee7b7",
              border: "1px solid rgba(16,185,129,0.3)",
            }}
          >
            {op.linkedLegislation} bill{op.linkedLegislation !== 1 ? "s" : ""} linked
          </span>
        )}
        {op.epistemicAxis && (
          <span
            style={{
              fontSize: "0.68rem",
              padding: "0.1rem 0.5rem",
              borderRadius: 9999,
              background: "rgba(107,114,128,0.12)",
              color: C.mut,
              border: "1px solid rgba(107,114,128,0.25)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {op.epistemicAxis}
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.3rem 0.85rem",
        borderRadius: 9999,
        fontSize: "0.78rem",
        fontWeight: 500,
        border: `1px solid ${active ? C.brand : hov ? "rgba(212,168,83,0.4)" : C.panelEdge}`,
        background: active ? "rgba(212,168,83,0.15)" : "transparent",
        color: active ? C.brand : hov ? "rgba(212,168,83,0.7)" : C.mut,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
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
      .then((r) => r.json())
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
    <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem" }}>
      {/* Sub-nav */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.panelEdge}`,
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          height: "2.75rem",
        }}
      >
        <Link
          href="/"
          style={{ color: C.faint, fontSize: "0.78rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}
        >
          <span style={{ fontSize: "1rem" }}>⬡</span> Epistemic Receipts
        </Link>
        <span style={{ color: C.panelEdge, fontSize: "0.75rem" }}>/</span>
        <span style={{ color: C.mut, fontSize: "0.78rem" }}>Court Opinions</span>
      </div>

      {/* Hero */}
      <div
        style={{
          background: `linear-gradient(160deg, #0f0f1e 0%, ${C.bg} 60%)`,
          borderBottom: `1px solid ${C.panelEdge}`,
          padding: "3.5rem 1.5rem 3rem",
        }}
      >
        <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(212,168,83,0.12)",
                border: "1px solid rgba(212,168,83,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
                flexShrink: 0,
              }}
            >
              ⚖
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: C.brand, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                CourtListener · PACER
              </div>
              <h1 style={{ color: C.ink, fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                Court Opinions
              </h1>
            </div>
          </div>
          <p style={{ color: C.mut, fontSize: "0.95rem", lineHeight: 1.6, maxWidth: "52rem", margin: "0 0 1.5rem" }}>
            {total > 0 ? total.toLocaleString() : "2,711"} U.S. court opinions — SCOTUS, federal circuits, state supreme courts, and more — each linked to related legislation and indexed as searchable epistemic claims.
          </p>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {(["SCOTUS", "Circuit", "State"] as const).map((label) => {
              const c = COURT_COLOR[label];
              return (
                <span
                  key={label}
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    padding: "0.25rem 0.7rem",
                    borderRadius: 9999,
                    background: c.bg,
                    color: c.text,
                    border: `1px solid ${c.border}`,
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "1.5rem 1.5rem 0" }}>
        <div
          style={{
            background: C.panel,
            border: `1px solid ${C.panelEdge}`,
            borderRadius: 12,
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", flex: 1 }}>
            {COURTS.map((c) => (
              <Chip key={c.value} active={court === c.value} onClick={() => handleCourtChange(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              style={{
                background: C.bg,
                border: `1px solid ${C.panelEdge}`,
                color: C.mut,
                borderRadius: 6,
                padding: "0.3rem 0.6rem",
                fontSize: "0.78rem",
                outline: "none",
              }}
            />
            <span style={{ color: C.faint, fontSize: "0.78rem" }}>–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              style={{
                background: C.bg,
                border: `1px solid ${C.panelEdge}`,
                color: C.mut,
                borderRadius: 6,
                padding: "0.3rem 0.6rem",
                fontSize: "0.78rem",
                outline: "none",
              }}
            />
          </div>
        </div>

        {!loading && data && (
          <div style={{ padding: "0.75rem 0.25rem", fontSize: "0.78rem", color: C.faint }}>
            {total.toLocaleString()} opinion{total !== 1 ? "s" : ""}
            {court !== "all" ? ` · ${COURTS.find((c) => c.value === court)?.label}` : ""}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "0.5rem 1.5rem 4rem" }}>
        {loading ? (
          <div style={{ padding: "3rem 0", textAlign: "center", color: C.faint, fontSize: "0.88rem" }}>
            Loading…
          </div>
        ) : !data || data.results.length === 0 ? (
          <div style={{ padding: "3rem 0", textAlign: "center", color: C.mut, fontSize: "0.88rem" }}>
            No opinions found.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {data.results.map((op) => (
                <OpinionCard key={op.id} op={op} />
              ))}
            </div>

            {pages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  marginTop: "2rem",
                }}
              >
                <button
                  onClick={() => handlePage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 8,
                    background: C.panel,
                    border: `1px solid ${C.panelEdge}`,
                    color: page <= 1 ? C.faint : C.mut,
                    fontSize: "0.82rem",
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                    opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  ← Prev
                </button>
                <span style={{ color: C.mut, fontSize: "0.82rem" }}>
                  Page {page} of {pages}
                </span>
                <button
                  onClick={() => handlePage(Math.min(pages, page + 1))}
                  disabled={page >= pages}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 8,
                    background: C.panel,
                    border: `1px solid ${C.panelEdge}`,
                    color: page >= pages ? C.faint : C.mut,
                    fontSize: "0.82rem",
                    cursor: page >= pages ? "not-allowed" : "pointer",
                    opacity: page >= pages ? 0.5 : 1,
                  }}
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
