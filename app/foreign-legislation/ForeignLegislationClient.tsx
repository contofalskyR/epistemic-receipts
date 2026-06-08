"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DestinationNav } from "@/components/destinations/DestinationNav";
import { COUNTRY_REGISTRY } from "@/lib/legislation-countries";
import type { Region } from "@/lib/legislation-countries";

const FOREIGN_COUNTRIES = COUNTRY_REGISTRY.filter((c) => c.code !== "us");
const REGIONS: Region[] = ["Europe", "Asia-Pacific", "Americas", "Africa"];

const S = {
  bg: "#080810",
  surface: "#0e0e1c",
  surface2: "#14142a",
  border: "#1e1e38",
  text: "#e2e2ee",
  muted: "#888898",
  accent: "#f0a000",
} as const;

const AXIS_INFO: Record<string, { label: string; color: string; bg: string }> =
  {
    SETTLED: {
      label: "Settled",
      color: "#6ee7b7",
      bg: "rgba(16,185,129,0.12)",
    },
    CONTESTED: {
      label: "Contested",
      color: "#fcd34d",
      bg: "rgba(245,158,11,0.12)",
    },
    RECORDED: {
      label: "Recorded",
      color: "#94a3b8",
      bg: "rgba(100,116,139,0.15)",
    },
    OPEN: { label: "Open Q.", color: "#93c5fd", bg: "rgba(59,130,246,0.12)" },
    UNRESOLVABLE: {
      label: "Unresolvable",
      color: "#c4b5fd",
      bg: "rgba(139,92,246,0.12)",
    },
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
  return (
    <div
      style={{
        background: S.surface,
        border: `1px solid ${S.border}`,
        borderRadius: "10px",
        padding: "0.85rem 1.1rem",
        display: "flex",
        gap: "1rem",
        alignItems: "flex-start",
        transition: "border-color 0.15s",
      }}
    >
      {/* Flag block */}
      <div
        style={{
          background: S.surface2,
          border: `1px solid ${S.border}`,
          borderRadius: "8px",
          padding: "0.35rem 0.55rem",
          textAlign: "center",
          minWidth: "48px",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>{claim.flag}</div>
        <div
          style={{
            fontSize: "0.6rem",
            color: S.muted,
            marginTop: "0.2rem",
            lineHeight: 1.2,
            fontFamily: "monospace",
          }}
        >
          {claim.countryCode.toUpperCase()}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "0.9rem",
            color: S.text,
            lineHeight: 1.45,
            margin: 0,
            marginBottom: "0.4rem",
          }}
        >
          {truncate(claim.title, 180)}
        </p>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: S.muted }}>
            {claim.country}
          </span>
          {claim.date && (
            <>
              <span style={{ color: S.border }}>·</span>
              <span
                style={{
                  fontSize: "0.72rem",
                  color: S.muted,
                  fontFamily: "monospace",
                }}
              >
                {claim.date}
              </span>
            </>
          )}
          <AxisBadge axis={claim.epistemicAxis} />
          {claim.sourceUrl && (
            <a
              href={claim.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.7rem",
                color: S.accent,
                textDecoration: "none",
              }}
            >
              → {claim.sourceLabel || "source"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: string;
  current: string;
  onSelect: (v: string) => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onSelect(value)}
      style={{
        background: active ? S.accent : S.surface,
        border: `1px solid ${active ? S.accent : S.border}`,
        borderRadius: "20px",
        padding: "0.3rem 0.75rem",
        fontSize: "0.78rem",
        cursor: "pointer",
        color: active ? "#000" : S.muted,
        fontWeight: active ? 600 : 400,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export default function ForeignLegislationClient({
  initialStats,
}: {
  initialStats: { total: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlRegion = (searchParams.get("region") ?? "all") as Region | "all";
  const urlCountry = searchParams.get("country") ?? "all";
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10) || 1
  );

  const [claims, setClaims] = useState<LegClaim[]>([]);
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
      const qs = p.toString();
      router.push(`/foreign-legislation${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  useEffect(() => {
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
  }, [urlRegion, urlCountry, urlQ, urlPage]);

  const handleQChange = (v: string) => {
    setQInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ q: v, page: "1" });
    }, 300);
  };

  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const regionCountries =
    urlRegion === "all"
      ? []
      : FOREIGN_COUNTRIES.filter((c) => c.region === urlRegion);

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <DestinationNav />

      {/* Header */}
      <div
        style={{
          padding: "2.5rem 2rem 0",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <p
          style={{
            fontSize: "0.75rem",
            color: S.muted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: 0,
            marginBottom: "0.4rem",
          }}
        >
          Destination · Global Legislation
        </p>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            margin: 0,
            marginBottom: "0.4rem",
            color: S.text,
          }}
        >
          Global <span style={{ color: S.accent }}>Legislation</span>
        </h1>
        <p
          style={{
            color: S.muted,
            fontSize: "0.9rem",
            maxWidth: "580px",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Laws and legislative acts from around the world.{" "}
          {initialStats.total.toLocaleString()}+ records across Europe,
          Asia-Pacific, Americas, and Africa.
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: "1.5rem 2rem 0",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* Region chips */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              color: S.muted,
              marginRight: "0.25rem",
            }}
          >
            Region
          </span>
          <Chip
            label="All"
            value="all"
            current={urlRegion}
            onSelect={(v) =>
              pushUrl({ region: v, country: "all", page: "1" })
            }
          />
          {REGIONS.map((r) => (
            <Chip
              key={r}
              label={r}
              value={r}
              current={urlRegion}
              onSelect={(v) =>
                pushUrl({ region: v, country: "all", page: "1" })
              }
            />
          ))}
        </div>

        {/* Country chips — only when a region is selected */}
        {urlRegion !== "all" && regionCountries.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "0.4rem",
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: S.muted,
                marginRight: "0.25rem",
              }}
            >
              Country
            </span>
            <Chip
              label="All"
              value="all"
              current={urlCountry}
              onSelect={(v) => pushUrl({ country: v, page: "1" })}
            />
            {regionCountries.map((c) => (
              <Chip
                key={c.code}
                label={`${c.flag} ${c.label}`}
                value={c.code}
                current={urlCountry}
                onSelect={(v) => pushUrl({ country: v, page: "1" })}
              />
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: "1rem" }}>
          <input
            value={qInput}
            onChange={(e) => handleQChange(e.target.value)}
            placeholder="Search legislation…"
            style={{
              width: "100%",
              maxWidth: "400px",
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: "8px",
              padding: "0.45rem 0.85rem",
              color: S.text,
              fontSize: "0.85rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Results */}
      <div
        style={{ padding: "0 2rem 3rem", maxWidth: "1200px", margin: "0 auto" }}
      >
        <div
          style={{
            marginBottom: "0.75rem",
            fontSize: "0.78rem",
            color: S.muted,
          }}
        >
          {loading
            ? "Loading…"
            : `${total.toLocaleString()} results — page ${urlPage} of ${pageCount}`}
        </div>

        {loading && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: "68px",
                  background: S.surface,
                  borderRadius: "10px",
                  border: `1px solid ${S.border}`,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        )}

        {!loading && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
          >
            {claims.map((c) => (
              <LegCard key={c.id} claim={c} />
            ))}
          </div>
        )}

        {!loading && claims.length === 0 && (
          <div
            style={{ textAlign: "center", padding: "3rem", color: S.muted }}
          >
            No legislation found for this filter.
          </div>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              alignItems: "center",
              marginTop: "1.5rem",
              fontSize: "0.82rem",
              color: S.muted,
            }}
          >
            <button
              onClick={() =>
                pushUrl({ page: String(Math.max(1, urlPage - 1)) })
              }
              disabled={urlPage <= 1}
              style={{
                background: "none",
                border: "none",
                cursor: urlPage <= 1 ? "not-allowed" : "pointer",
                color: urlPage <= 1 ? S.border : S.muted,
              }}
            >
              ← Prev
            </button>
            <span>
              Page {urlPage} of {pageCount}
            </span>
            <button
              onClick={() =>
                pushUrl({ page: String(Math.min(pageCount, urlPage + 1)) })
              }
              disabled={urlPage >= pageCount}
              style={{
                background: "none",
                border: "none",
                cursor: urlPage >= pageCount ? "not-allowed" : "pointer",
                color: urlPage >= pageCount ? S.border : S.muted,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
