"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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

const PIPELINE_LABEL: Record<string, string> = {
  openalex_v1: "OpenAlex",
  nih_reporter_v1: "NIH",
  clinicaltrials_v1: "ClinicalTrials",
  courtlistener_scotus_v1: "SCOTUS",
  courtlistener_circuits_v1: "Circuits",
  nasa_exoplanet_v1: "NASA",
  congress_v1: "Congress",
  riksdag_v1: "Riksdag",
  eu_legislation_v1: "EU",
  echr_v1: "ECHR",
  un_sc_resolutions_v1: "UN SC",
  chebi_v1: "ChEBI",
  rxnorm_v1: "RxNorm",
  openfda_labels_v1: "FDA Labels",
};

const DOMAIN_OPTS = [
  { value: "all", label: "All" },
  { value: "science", label: "Science" },
  { value: "medicine", label: "Medicine" },
  { value: "law", label: "Law" },
  { value: "legislation", label: "Legislation" },
];

type ClaimRow = {
  id: string;
  title: string;
  ingestedBy: string;
  epistemicAxis: string | null;
  date: string | null;
  links: number;
};

type RelatedClaim = {
  id: string;
  title: string;
  year: number | null;
  sourceUrl: string | null;
};

type RelationsData = {
  cites: RelatedClaim[];
  cited_by: RelatedClaim[];
  related: RelatedClaim[];
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
        padding: "0.2rem 0.55rem",
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

function ClaimCard({
  claim,
  expanded,
  onToggle,
}: {
  claim: ClaimRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [relations, setRelations] = useState<RelationsData | null>(null);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!expanded || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingRelations(true);
    fetch(`/api/claims/${claim.id}/relations`)
      .then((r) => r.json())
      .then((d: RelationsData) => {
        setRelations(d);
        setLoadingRelations(false);
      })
      .catch(() => setLoadingRelations(false));
  }, [expanded, claim.id]);

  const pipelineLabel =
    PIPELINE_LABEL[claim.ingestedBy] ?? claim.ingestedBy.replace(/_v\d+$/, "");

  return (
    <div
      style={{
        background: S.surface,
        border: `1px solid ${expanded ? "#2e2e50" : S.border}`,
        borderRadius: "12px",
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
    >
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "1rem",
          padding: "1rem 1.25rem",
          cursor: "pointer",
        }}
      >
        {/* Links count block */}
        <div
          style={{
            background: S.surface2,
            border: `1px solid ${S.border}`,
            borderRadius: "8px",
            padding: "0.4rem 0.7rem",
            textAlign: "center",
            minWidth: "52px",
            flexShrink: 0,
          }}
        >
          <div
            style={{ fontSize: "1.1rem", fontWeight: 700, color: S.accent }}
          >
            {claim.links}
          </div>
          <div
            style={{ fontSize: "0.62rem", color: S.muted, lineHeight: 1.2 }}
          >
            links
          </div>
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "0.92rem",
              color: S.text,
              lineHeight: 1.45,
              margin: 0,
              marginBottom: "0.5rem",
            }}
          >
            {truncate(claim.title, 160)}
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.15rem 0.45rem",
                borderRadius: "4px",
                background: S.surface2,
                color: S.muted,
                border: `1px solid ${S.border}`,
              }}
            >
              {pipelineLabel}
            </span>
            {claim.date && (
              <span
                style={{
                  fontSize: "0.72rem",
                  color: S.muted,
                  fontFamily: "monospace",
                }}
              >
                {claim.date.slice(0, 4)}
              </span>
            )}
            <AxisBadge axis={claim.epistemicAxis} />
          </div>
        </div>

        {/* Expand arrow */}
        <div
          style={{
            color: S.muted,
            fontSize: "0.85rem",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
            marginTop: "0.2rem",
          }}
        >
          ▾
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${S.border}`,
            padding: "1.25rem",
          }}
        >
          {loadingRelations && (
            <p style={{ color: S.muted, fontSize: "0.85rem" }}>
              Loading downstream claims…
            </p>
          )}
          {!loadingRelations && relations && (
            <>
              <div
                style={{
                  marginBottom: "0.75rem",
                  fontSize: "0.72rem",
                  color: S.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Downstream citations ({relations.cites.length})
              </div>
              {relations.cites.length === 0 ? (
                <p style={{ color: S.muted, fontSize: "0.82rem" }}>
                  No downstream cites indexed yet.
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {relations.cites.slice(0, 10).map((rc) => (
                    <Link
                      key={rc.id}
                      href={`/claims/${rc.id}`}
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "flex-start",
                        padding: "0.6rem 0.85rem",
                        background: S.surface2,
                        border: `1px solid ${S.border}`,
                        borderRadius: "8px",
                        textDecoration: "none",
                      }}
                    >
                      {rc.year && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: S.accent,
                            fontFamily: "monospace",
                            minWidth: "34px",
                            marginTop: "0.1rem",
                            flexShrink: 0,
                          }}
                        >
                          {rc.year}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.82rem",
                          color: S.text,
                          lineHeight: 1.4,
                        }}
                      >
                        {truncate(rc.title, 110)}
                      </span>
                    </Link>
                  ))}
                  {relations.cites.length > 10 && (
                    <p style={{ fontSize: "0.75rem", color: S.muted }}>
                      +{relations.cites.length - 10} more —{" "}
                      <Link
                        href={`/claims/${claim.id}`}
                        style={{
                          color: S.accent,
                          textDecoration: "none",
                          marginLeft: "0.2rem",
                        }}
                      >
                        view full claim
                      </Link>
                    </p>
                  )}
                </div>
              )}
              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "0.75rem",
                  borderTop: `1px solid ${S.border}`,
                }}
              >
                <Link
                  href={`/claims/${claim.id}`}
                  style={{
                    fontSize: "0.78rem",
                    color: S.accent,
                    textDecoration: "none",
                  }}
                >
                  View claim detail →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
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
}

export default function PrereqGraphClient({
  initialStats,
}: {
  initialStats: { claimsWithLinks: number; totalRelations: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlDomain = searchParams.get("domain") ?? "all";
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10) || 1
  );

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      router.push(`/prereq-graph${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    setLoading(true);
    setExpandedId(null);
    const p = new URLSearchParams();
    if (urlDomain !== "all") p.set("domain", urlDomain);
    if (urlQ) p.set("q", urlQ);
    if (urlPage > 1) p.set("page", String(urlPage));
    fetch(`/api/prereq-graph?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setClaims(d.claims ?? []);
        setTotal(d.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [urlDomain, urlQ, urlPage]);

  const PAGE_SIZE = 25;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ background: S.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem", padding: "0 0 4rem" }}>
      {/* Sub-nav */}
      <nav style={{
        background: S.surface,
        borderBottom: `1px solid ${S.border}`,
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        gap: "2rem",
        height: 56,
        position: "sticky",
        top: 48,
        zIndex: 40,
      }}>
        <Link href="/" style={{ color: S.accent, fontWeight: 700, fontSize: "1rem", textDecoration: "none", whiteSpace: "nowrap" }}>
          ⬡ Epistemic Receipts
        </Link>
        <span style={{ color: S.muted, fontSize: "0.85rem" }}>Evidence Chains</span>
      </nav>

      {/* Header */}
      <div
        style={{
          padding: "2.5rem 2rem 0",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            margin: 0,
            marginBottom: "0.4rem",
            color: S.text,
          }}
        >
          Evidence <span style={{ color: S.accent }}>Chains</span>
        </h1>
        <p
          style={{
            color: S.muted,
            fontSize: "0.9rem",
            maxWidth: "560px",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          How claims connect: trials → approvals → outcomes. Citation graph of {initialStats.claimsWithLinks.toLocaleString()}+ linked claims, ranked by most-cited first.
        </p>
      </div>

      {/* Stats */}
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
          {
            val: initialStats.claimsWithLinks.toLocaleString(),
            label: "Claims with links",
          },
          {
            val: initialStats.totalRelations.toLocaleString(),
            label: "Total relations",
          },
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
            <div
              style={{ fontSize: "1.5rem", fontWeight: 700, color: S.accent }}
            >
              {s.val}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: S.muted,
                marginTop: "0.2rem",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Search + domain filter */}
      <div style={{ padding: "1.25rem 2rem 1rem", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <input
          type="search"
          value={qInput}
          placeholder="Search claim title or text…"
          onChange={(e) => {
            setQInput(e.target.value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => pushUrl({ q: e.target.value, page: "1" }), 350);
          }}
          style={{
            width: "100%",
            maxWidth: 520,
            background: S.surface,
            border: `1px solid ${S.border}`,
            borderRadius: 8,
            padding: "0.45rem 0.85rem",
            color: S.text,
            fontSize: "0.85rem",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: S.muted }}>Domain</span>
          {DOMAIN_OPTS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              value={opt.value}
              current={urlDomain}
              onSelect={(v) => pushUrl({ domain: v, page: "1" })}
            />
          ))}
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
            : `${total.toLocaleString()} claims — page ${urlPage} of ${pageCount}`}
        </div>

        {loading && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: "82px",
                  background: S.surface,
                  borderRadius: "12px",
                  border: `1px solid ${S.border}`,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        )}

        {!loading && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {claims.map((c) => (
              <ClaimCard
                key={c.id}
                claim={c}
                expanded={expandedId === c.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === c.id ? null : c.id))
                }
              />
            ))}
          </div>
        )}

        {!loading && claims.length === 0 && (
          <div
            style={{ textAlign: "center", padding: "3rem", color: S.muted }}
          >
            No claims found for this filter.
          </div>
        )}

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
                pushUrl({ domain: urlDomain, page: String(Math.max(1, urlPage - 1)) })
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
                pushUrl({
                  domain: urlDomain,
                  page: String(Math.min(pageCount, urlPage + 1)),
                })
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
