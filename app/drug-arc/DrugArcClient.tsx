"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const C = {
  bg: "#0a0a0a", panel: "#10101c", panelEdge: "#23233a",
  ink: "#e9e9f2", mut: "#8b8ba3", faint: "#55556e", brand: "#d4a853",
} as const;

type SearchResult = {
  id: string;
  text: string;
  pipeline: string;
  pipelineLabel: string;
  color: string;
  year: number | null;
  totalReports: number | null;
  epistemicStatus: string | null;
};

const PIPELINE_COLORS: Record<string, { dot: string; badge: string; border: string; badgeBg: string; badgeText: string }> = {
  blue: {
    dot: "rgba(59,130,246,1)",
    badge: "",
    border: "rgba(59,130,246,0.2)",
    badgeBg: "rgba(59,130,246,0.15)",
    badgeText: "#93c5fd",
  },
  emerald: {
    dot: "rgba(16,185,129,1)",
    badge: "",
    border: "rgba(16,185,129,0.2)",
    badgeBg: "rgba(16,185,129,0.15)",
    badgeText: "#6ee7b7",
  },
  orange: {
    dot: "rgba(249,115,22,1)",
    badge: "",
    border: "rgba(249,115,22,0.2)",
    badgeBg: "rgba(249,115,22,0.15)",
    badgeText: "#fdba74",
  },
  gray: {
    dot: "rgba(107,114,128,1)",
    badge: "",
    border: "rgba(107,114,128,0.2)",
    badgeBg: "rgba(107,114,128,0.15)",
    badgeText: "#d1d5db",
  },
};

function formatReports(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M reports`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k reports`;
  return `${n} reports`;
}

function ResultCard({ r }: { r: SearchResult }) {
  const [hovered, setHovered] = useState(false);
  const pc = PIPELINE_COLORS[r.color] ?? PIPELINE_COLORS.gray;
  return (
    <div
      key={r.id}
      style={{ position: "relative", paddingLeft: "2.5rem", paddingBottom: "1.5rem" }}
    >
      {/* Timeline dot */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "0.375rem",
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: pc.dot,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 0 4px ${C.bg}`,
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.56rem", lineHeight: 1 }}>
          {r.year ? String(r.year).slice(2) : "—"}
        </span>
      </div>

      {/* Card */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: C.panel,
          border: `1px solid ${hovered ? C.brand : pc.border}`,
          borderRadius: 10,
          padding: "0.9rem 1.1rem",
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <p style={{ color: C.faint, fontSize: "0.75rem", fontFamily: "monospace", margin: 0 }}>{r.year ?? "—"}</p>
          <span
            style={{
              fontSize: "0.72rem",
              padding: "0.15rem 0.6rem",
              borderRadius: 9999,
              border: `1px solid ${pc.badgeText}55`,
              background: pc.badgeBg,
              color: pc.badgeText,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {r.pipelineLabel}
          </span>
        </div>
        <Link
          href={`/claims/${r.id}`}
          style={{
            display: "block",
            color: C.ink,
            fontSize: "0.88rem",
            lineHeight: 1.5,
            textDecoration: "none",
            marginBottom: "0.6rem",
          }}
        >
          {r.text}
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link
            href={`/claims/${r.id}`}
            style={{ color: C.brand, fontWeight: 600, fontSize: "0.78rem", textDecoration: "none" }}
          >
            View claim →
          </Link>
          {r.totalReports !== null && (
            <span style={{ fontSize: "0.75rem", color: "rgba(249,115,22,0.7)" }}>
              {formatReports(r.totalReports)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DrugArcClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setResults(null);
      setSearched("");
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/drug-arc/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setSearched(data.query ?? val.trim());
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  const hasTrial = results?.some((r) => r.pipeline === "clinicaltrials_v1");
  const hasApproval = results?.some((r) => r.pipeline === "drugsatfda_v1");
  const hasAE = results?.some((r) => r.pipeline === "faers_normalized_drugs_v1");
  const arcComplete = hasTrial && hasApproval && hasAE;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Search input */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Search by drug name or compound — e.g. semaglutide, atorvastatin, ibuprofen"
          style={{
            background: C.panel,
            border: `1px solid ${C.panelEdge}`,
            color: C.ink,
            borderRadius: 8,
            padding: "0.55rem 1rem",
            width: "100%",
            fontSize: "0.88rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {loading && (
          <div
            style={{
              position: "absolute",
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.75rem",
              color: C.faint,
            }}
          >
            searching…
          </div>
        )}
      </div>

      {/* Arc completeness banner */}
      {results && results.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            borderRadius: 8,
            border: `1px solid ${arcComplete ? "rgba(16,185,129,0.4)" : C.panelEdge}`,
            background: arcComplete ? "rgba(16,185,129,0.08)" : C.panel,
            padding: "0.6rem 1rem",
            fontSize: "0.78rem",
            color: arcComplete ? "#6ee7b7" : C.mut,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              flexShrink: 0,
              background: arcComplete ? "rgba(16,185,129,1)" : "rgba(107,114,128,0.6)",
            }}
          />
          {arcComplete
            ? `Full arc found for "${searched}" — trial registration, FDA approval, and post-market surveillance all present.`
            : `Partial arc for "${searched}" — ${[hasTrial && "trials", hasApproval && "approvals", hasAE && "adverse events"].filter(Boolean).join(", ")} found.`}
        </div>
      )}

      {/* Results timeline */}
      {results && results.length > 0 && (
        <div style={{ position: "relative" }}>
          {/* Vertical timeline line */}
          <div
            style={{
              position: "absolute",
              left: "0.75rem",
              top: 8,
              bottom: 8,
              width: 1,
              background: C.panelEdge,
            }}
          />
          <div>
            {results.map((r) => (
              <ResultCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      )}

      {results && results.length === 0 && searched && (
        <p style={{ fontSize: "0.88rem", color: C.mut, padding: "0.5rem 0" }}>
          No records found for &ldquo;{searched}&rdquo; across clinical trials, FDA approvals, or adverse event data.
        </p>
      )}

      {!results && !loading && (
        <p style={{ fontSize: "0.78rem", color: C.faint, padding: "0.25rem 0" }}>
          Results will appear as you type. Searches clinical trials, FDA approval records, and FAERS drug aggregates.
        </p>
      )}
    </div>
  );
}
