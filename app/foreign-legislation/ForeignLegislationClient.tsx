"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { COUNTRY_REGISTRY } from "@/lib/legislation-countries";
import type { Region } from "@/lib/legislation-countries";

const FOREIGN_COUNTRIES = COUNTRY_REGISTRY.filter((c) => c.code !== "us");
const REGIONS: Region[] = ["Europe", "Asia-Pacific", "Americas", "Africa"];

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

const AXIS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  SETTLED: { label: "Settled", color: "#6ee7b7", bg: "rgba(16,185,129,0.12)" },
  CONTESTED: { label: "Contested", color: "#fcd34d", bg: "rgba(245,158,11,0.12)" },
  RECORDED: { label: "Recorded", color: "#94a3b8", bg: "rgba(100,116,139,0.15)" },
  OPEN: { label: "Open Q.", color: "#93c5fd", bg: "rgba(59,130,246,0.12)" },
  UNRESOLVABLE: { label: "Unresolvable", color: "#c4b5fd", bg: "rgba(139,92,246,0.12)" },
};

type LegClaim = {
  id: string;
  title: string;
  ingestedBy: string;
  epistemicAxis: string | null;
  date: string | null;
  country: string;
  countryCode: string;
  flag: string;
  region: string;
  sourceLabel: string;
  sourceUrl: string | null;
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

function AxisBadge({ axis }: { axis: string | null }) {
  if (!axis) return null;
  const info = AXIS_INFO[axis];
  if (!info) return null;
  return (
    <span
      style={{
        fontSize: "0.68rem",
        padding: "0.18rem 0.5rem",
        borderRadius: "10px",
        fontWeight: 500,
        color: info.color,
        background: info.bg,
      }}
    >
      {info.label}
    </span>
  );
}

function LegCard({ claim }: { claim: LegClaim }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.panel,
        border: `1px solid ${hovered ? C.brand + "55" : C.panelEdge}`,
        borderRadius: "10px",
        padding: "0.85rem 1.1rem",
        display: "flex",
        gap: "1rem",
        alignItems: "flex-start",
        transition: "border-color 0.15s",
      }}
    >
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.panelEdge}`,
          borderRadius: "8px",
          padding: "0.35rem 0.55rem",
          textAlign: "center",
          minWidth: "48px",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>{claim.flag}</div>
        <div style={{ fontSize: "0.6rem", color: C.mut, marginTop: "0.2rem", lineHeight: 1.2, fontFamily: "monospace" }}>
          {claim.countryCode.toUpperCase()}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "0.9rem", color: C.ink, lineHeight: 1.45, margin: 0, marginBottom: "0.4rem" }}>
          {truncate(claim.title, 180)}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: C.mut }}>{claim.country}</span>
          <span style={{ color: C.faint }}>·</span>
          <span style={{ fontSize: "0.72rem", color: C.mut, fontFamily: "monospace" }}>
            {claim.date && claim.date !== "2999" ? claim.date : "—"}
          </span>
          <AxisBadge axis={claim.epistemicAxis} />
          {claim.sourceUrl && (
            <a href={claim.sourceUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "0.7rem", color: C.brand, textDecoration: "none" }}>
              → {claim.sourceLabel || "source"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({
  label, value, current, onSelect,
}: {
  label: string; value: string; current: string; onSelect: (v: string) => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onSelect(value)}
      style={{
        background: active ? C.brand : C.panel,
        border: `1px solid ${active ? C.brand : C.panelEdge}`,
        borderRadius: "20px",
        padding: "0.3rem 0.75rem",
        fontSize: "0.78rem",
        cursor: "pointer",
        color: active ? "#000" : C.mut,
        fontWeight: active ? 600 : 400,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function CountryCard({
  entry,
  count,
  onClick,
}: {
  entry: typeof FOREIGN_COUNTRIES[0];
  count: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#15152a" : C.panel,
        border: `1px solid ${hovered ? C.brand + "66" : C.panelEdge}`,
        borderRadius: "12px",
        padding: "1rem 1.1rem",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
        display: "flex",
        gap: "0.85rem",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: "1.8rem", lineHeight: 1, flexShrink: 0 }}>{entry.flag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: C.ink, marginBottom: "0.15rem" }}>
          {entry.label}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.72rem", color: C.brand, fontWeight: 500 }}>
            {count.toLocaleString()} laws
          </span>
          <span style={{ fontSize: "0.68rem", color: C.faint }}>
            {entry.region}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function ForeignLegislationClient({
  initialStats,
}: {
  initialStats: { total: number; countryCounts: Record<string, number> };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlRegion = (searchParams.get("region") ?? "all") as Region | "all";
  const urlCountry = searchParams.get("country") ?? "all";
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [claims, setClaims] = useState<LegClaim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [qInput, setQInput] = useState(urlQ);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show list view when a country is selected or search is active
  const isListView = urlCountry !== "all" || urlQ.trim().length > 0;

  const pushUrl = useCallback(
    (overrides: Record<string, string>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (!v || v === "all" || v === "1") p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      router.push(`/foreign-legislation${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!isListView) return;
    setLoading(true);
    const p = new URLSearchParams();
    if (urlRegion !== "all") p.set("region", urlRegion);
    if (urlCountry !== "all") p.set("country", urlCountry);
    if (urlQ) p.set("q", urlQ);
    if (urlPage > 1) p.set("page", String(urlPage));
    fetch(`/api/foreign-legislation?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setClaims(d.claims ?? []);
        setTotal(d.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [urlRegion, urlCountry, urlQ, urlPage, isListView]);

  const handleQChange = (v: string) => {
    setQInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ q: v, page: "1" });
    }, 300);
  };

  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Filter countries for directory view
  const directoryCountries = FOREIGN_COUNTRIES.filter((c) =>
    urlRegion === "all" ? true : c.region === urlRegion
  );

  // Find selected country entry
  const selectedCountryEntry = urlCountry !== "all"
    ? FOREIGN_COUNTRIES.find((c) => c.code === urlCountry)
    : null;

  return (
    <div style={{
      background: C.bg,
      minHeight: "100vh",
      marginTop: "-2rem",
      marginLeft: "-1.5rem",
      marginRight: "-1.5rem",
    }}>
      {/* Sub-nav */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: C.bg,
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        height: "48px",
        fontSize: "0.82rem",
      }}>
        <Link href="/" style={{ color: C.brand, textDecoration: "none", fontWeight: 500, whiteSpace: "nowrap" }}>
          ⬡ Epistemic Receipts
        </Link>
        <span style={{ color: C.faint }}>/</span>
        <span style={{ color: C.ink, fontWeight: 600, whiteSpace: "nowrap" }}>Global Legislation</span>
      </div>

      {/* Header */}
      <div style={{ padding: "2rem 2rem 0", maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, marginBottom: "0.4rem", color: C.ink }}>
          Global <span style={{ color: C.brand }}>Legislation</span>
        </h1>
        <p style={{ color: C.mut, fontSize: "0.9rem", maxWidth: "580px", lineHeight: 1.5, margin: 0 }}>
          {initialStats.total.toLocaleString()}+ laws and legislative acts across{" "}
          {FOREIGN_COUNTRIES.length} countries — Europe, Asia-Pacific, Americas, and Africa.
        </p>
      </div>

      {/* Filters */}
      <div style={{ padding: "1.25rem 2rem 0", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Region chips */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", color: C.mut, marginRight: "0.25rem" }}>Region</span>
          <Chip label="All" value="all" current={urlRegion}
            onSelect={(v) => pushUrl({ region: v, country: "all", page: "1" })} />
          {REGIONS.map((r) => (
            <Chip key={r} label={r} value={r} current={urlRegion}
              onSelect={(v) => pushUrl({ region: v, country: "all", page: "1" })} />
          ))}
        </div>

        {/* Search — always visible */}
        <div style={{ marginBottom: "1rem" }}>
          <input
            value={qInput}
            onChange={(e) => handleQChange(e.target.value)}
            placeholder="Search legislation by keyword…"
            style={{
              width: "100%",
              maxWidth: "420px",
              background: C.panel,
              border: `1px solid ${C.panelEdge}`,
              borderRadius: "8px",
              padding: "0.45rem 0.85rem",
              color: C.ink,
              fontSize: "0.85rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 2rem 3rem", maxWidth: "1200px", margin: "0 auto" }}>

        {/* ── DIRECTORY VIEW (default) ── */}
        {!isListView && (
          <>
            <div style={{ marginBottom: "0.75rem", fontSize: "0.78rem", color: C.mut }}>
              {directoryCountries.length} countries
              {urlRegion !== "all" ? ` in ${urlRegion}` : ""}
              {" "}— click a country to browse its laws
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "0.6rem",
            }}>
              {directoryCountries
                .sort((a, b) => {
                  const ca = initialStats.countryCounts[a.ingestedBy] ?? 0;
                  const cb = initialStats.countryCounts[b.ingestedBy] ?? 0;
                  return cb - ca;
                })
                .map((entry) => (
                  <CountryCard
                    key={entry.code}
                    entry={entry}
                    count={initialStats.countryCounts[entry.ingestedBy] ?? 0}
                    onClick={() => pushUrl({ country: entry.code, region: entry.region, page: "1" })}
                  />
                ))}
            </div>
          </>
        )}

        {/* ── LIST VIEW (country selected or search active) ── */}
        {isListView && (
          <>
            {/* Back + country header */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <button
                onClick={() => pushUrl({ country: "all", q: "", page: "1" })}
                style={{
                  background: "none", border: `1px solid ${C.panelEdge}`,
                  borderRadius: "6px", padding: "0.3rem 0.7rem",
                  fontSize: "0.78rem", color: C.mut, cursor: "pointer",
                }}
              >
                ← All countries
              </button>
              {selectedCountryEntry && (
                <span style={{ fontSize: "1rem", color: C.ink, fontWeight: 600 }}>
                  {selectedCountryEntry.flag} {selectedCountryEntry.label}
                </span>
              )}
              {urlQ && (
                <span style={{ fontSize: "0.82rem", color: C.mut }}>
                  searching &quot;{urlQ}&quot;
                </span>
              )}
            </div>

            <div style={{ marginBottom: "0.75rem", fontSize: "0.78rem", color: C.mut }}>
              {loading
                ? "Loading…"
                : `${total.toLocaleString()} results — page ${urlPage} of ${pageCount}`}
            </div>

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} style={{ height: "68px", background: C.panel, borderRadius: "10px", border: `1px solid ${C.panelEdge}`, opacity: 0.5 }} />
                ))}
              </div>
            )}

            {!loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {claims.map((c) => (
                  <LegCard key={c.id} claim={c} />
                ))}
              </div>
            )}

            {!loading && claims.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem", color: C.mut }}>
                No legislation found for this filter.
              </div>
            )}

            {/* Pagination */}
            {pageCount > 1 && (
              <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1.5rem", fontSize: "0.82rem", color: C.mut }}>
                <button
                  onClick={() => pushUrl({ page: String(Math.max(1, urlPage - 1)) })}
                  disabled={urlPage <= 1}
                  style={{ background: "none", border: "none", cursor: urlPage <= 1 ? "not-allowed" : "pointer", color: urlPage <= 1 ? C.faint : C.mut }}
                >
                  ← Prev
                </button>
                <span>Page {urlPage} of {pageCount}</span>
                <button
                  onClick={() => pushUrl({ page: String(Math.min(pageCount, urlPage + 1)) })}
                  disabled={urlPage >= pageCount}
                  style={{ background: "none", border: "none", cursor: urlPage >= pageCount ? "not-allowed" : "pointer", color: urlPage >= pageCount ? C.faint : C.mut }}
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
