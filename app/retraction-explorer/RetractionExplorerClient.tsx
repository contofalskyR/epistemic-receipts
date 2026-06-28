"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Paper = {
  id: string;
  title: string;
  firstAuthor: string | null;
  journal: string | null;
  publisher: string | null;
  doi: string | null;
  updateType: string;
  retractionDate: string | null;
  year: number | null;
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
  purple: "#a78bfa",
} as const;

const FIELD_OPTIONS = ["all", "Medicine", "Psychology", "Biology", "Physics", "Chemistry"];
const REASON_OPTIONS = ["all", "Retraction", "Withdrawal", "Correction", "Reinstatement"];

function journalShort(journal: string | null): string {
  if (!journal) return "—";
  const words = journal.split(/\s+/);
  if (words.length <= 2) return journal.slice(0, 10);
  return words
    .filter((w) => w.length > 3)
    .slice(0, 2)
    .map((w) => w.slice(0, 4))
    .join(" ");
}

function PaperCard({ paper }: { paper: Paper }) {
  const [open, setOpen] = useState(false);

  const isRetraction =
    !paper.updateType || paper.updateType.toLowerCase().includes("retract");
  const isWithdrawal = paper.updateType?.toLowerCase().includes("with");

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
          gridTemplateColumns: "auto 1fr auto",
          gap: "1rem",
          alignItems: "start",
          padding: "1rem 1.25rem",
          cursor: "pointer",
        }}
      >
        {/* Year + journal block */}
        <div
          style={{
            background: S.surface2,
            border: `1px solid ${S.border}`,
            borderRadius: "8px",
            padding: "0.4rem 0.65rem",
            textAlign: "center",
            minWidth: "52px",
          }}
        >
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: S.accent,
            }}
          >
            {paper.year ?? "—"}
          </div>
          <div style={{ fontSize: "0.62rem", color: S.muted }}>
            {journalShort(paper.journal)}
          </div>
        </div>

        {/* Paper info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.88rem",
              lineHeight: 1.4,
              color: S.text,
            }}
          >
            {paper.title}
          </div>
          {paper.firstAuthor && (
            <div style={{ fontSize: "0.75rem", color: S.muted }}>{paper.firstAuthor} et al.</div>
          )}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
            {paper.journal && (
              <span
                style={{
                  padding: "0.15rem 0.5rem",
                  borderRadius: "6px",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  background: "rgba(34,197,94,0.08)",
                  color: "#4ade80",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                {paper.journal.length > 30 ? paper.journal.slice(0, 30) + "…" : paper.journal}
              </span>
            )}
            <span
              style={{
                padding: "0.15rem 0.5rem",
                borderRadius: "6px",
                fontSize: "0.68rem",
                fontWeight: 600,
                background: isRetraction
                  ? "rgba(239,68,68,0.1)"
                  : isWithdrawal
                  ? "rgba(251,146,60,0.1)"
                  : "rgba(96,165,250,0.1)",
                color: isRetraction ? S.red : isWithdrawal ? S.orange : S.blue,
                border: `1px solid ${
                  isRetraction
                    ? "rgba(239,68,68,0.2)"
                    : isWithdrawal
                    ? "rgba(251,146,60,0.2)"
                    : "rgba(96,165,250,0.2)"
                }`,
              }}
            >
              {paper.updateType}
            </span>
          </div>
        </div>

        {/* Right: date + expand */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "0.3rem",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: S.muted }}>
            {paper.retractionDate ?? "—"}
          </div>
          <div
            style={{
              color: S.muted,
              fontSize: "0.85rem",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              marginTop: "0.2rem",
            }}
          >
            ▾
          </div>
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
                Publisher
              </div>
              <div style={{ fontSize: "0.83rem", color: S.text }}>{paper.publisher ?? "—"}</div>
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
                Update Type
              </div>
              <div style={{ fontSize: "0.83rem", color: S.text }}>{paper.updateType}</div>
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
                Journal
              </div>
              <div style={{ fontSize: "0.83rem", color: S.text }}>{paper.journal ?? "—"}</div>
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
                Retraction Date
              </div>
              <div style={{ fontSize: "0.83rem", color: S.text }}>{paper.retractionDate ?? "—"}</div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "8px",
              padding: "0.7rem 1rem",
              fontSize: "0.82rem",
              color: "#fca5a5",
              lineHeight: 1.5,
              marginBottom: "0.8rem",
            }}
          >
            This paper was {paper.updateType?.toLowerCase() ?? "retracted"} via Crossref
            {paper.retractionDate ? ` on ${paper.retractionDate}` : ""}. The retraction is
            recorded in the Crossref metadata registry.
          </div>

          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
            {paper.doi && (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.78rem",
                  color: S.accent,
                  textDecoration: "none",
                  fontFamily: "monospace",
                }}
              >
                doi:{paper.doi} ↗
              </a>
            )}
            <Link
              href={`/claims/${paper.id}`}
              style={{ fontSize: "0.78rem", color: S.blue, textDecoration: "none" }}
            >
              View receipt for this retraction →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RetractionExplorerClient({
  initialStats,
}: {
  initialStats: { total: number; journals: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlField = searchParams.get("field") ?? "all";
  const urlReason = searchParams.get("reason") ?? "all";
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [papers, setPapers] = useState<Paper[]>([]);
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
      router.push(`/retraction-explorer?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (urlField !== "all") params.set("field", urlField);
    if (urlReason !== "all") params.set("reason", urlReason);
    if (urlQ) params.set("q", urlQ);
    if (urlPage > 1) params.set("page", String(urlPage));

    fetch(`/api/retractions?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setPapers(d.papers ?? []);
        setTotal(d.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [urlField, urlReason, urlQ, urlPage]);

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
      {/* Retraction-specific sub-nav */}
      <nav
        style={{
          background: S.surface,
          borderBottom: `1px solid ${S.border}`,
          padding: "0 2rem",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          height: "48px",
          position: "sticky",
          top: "48px",
          zIndex: 40,
        }}
      >
        <Link href="/" style={{ color: S.accent, fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", whiteSpace: "nowrap" }}>
          ⬡ Epistemic Receipts
        </Link>
        <ul style={{ listStyle: "none", display: "flex", gap: 0, margin: 0, padding: 0 }}>
          {[
            { label: "All", field: "all", reason: "all" },
            { label: "Medicine", field: "Medicine", reason: "all" },
            { label: "Psychology", field: "Psychology", reason: "all" },
            { label: "Biology", field: "Biology", reason: "all" },
            { label: "Retractions only", field: "all", reason: "Retraction" },
            { label: "Corrections only", field: "all", reason: "Correction" },
          ].map((item) => {
            const active = urlField === item.field && urlReason === item.reason;
            return (
              <li key={item.label}>
                <button
                  onClick={() => pushUrl({ field: item.field, reason: item.reason, page: "1" })}
                  style={{
                    background: "none",
                    border: "none",
                    color: active ? S.accent : S.muted,
                    fontSize: "0.83rem",
                    padding: "0.4rem 0.9rem",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: active ? 600 : 400,
                    transition: "color 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Header */}
      <div style={{ padding: "2.5rem 2rem 0", maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.4rem", color: S.text }}>
          Retraction <span style={{ color: S.accent }}>Explorer</span>
        </h1>
        <p style={{ color: S.muted, fontSize: "0.9rem", maxWidth: "600px", lineHeight: 1.5 }}>
          {initialStats.total.toLocaleString()} retracted papers indexed via Crossref. Retractions happen for many reasons — fraud, errors, data problems, or honest mistakes. This index helps you understand when and why published findings were withdrawn or corrected.
        </p>
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
          { val: initialStats.total.toLocaleString(), label: "Papers retracted" },
          { val: initialStats.journals.toLocaleString(), label: "Journals" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: "10px",
              padding: "0.9rem 1.2rem",
              minWidth: "130px",
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
        <div style={{ flex: 1, minWidth: "240px", maxWidth: "420px" }}>
          <input
            value={qInput}
            onChange={(e) => handleQChange(e.target.value)}
            placeholder="Search title, author, journal…"
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

        <span style={{ fontSize: "0.75rem", color: S.muted }}>Field</span>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {FIELD_OPTIONS.map((v) => (
            <Chip
              key={v}
              label={v === "all" ? "All" : v}
              value={v}
              current={urlField}
              onSelect={(val) => pushUrl({ field: val, page: "1" })}
            />
          ))}
        </div>

        <span style={{ fontSize: "0.75rem", color: S.muted }}>Type</span>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {REASON_OPTIONS.map((v) => (
            <Chip
              key={v}
              label={v === "all" ? "All" : v}
              value={v}
              current={urlReason}
              onSelect={(val) => pushUrl({ reason: val, page: "1" })}
            />
          ))}
        </div>
      </div>

      {/* Notable banner */}
      <div
        style={{
          margin: "0 2rem 1rem",
          maxWidth: "1200px",
          marginLeft: "auto",
          marginRight: "auto",
          background: "rgba(167,139,250,0.08)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: "10px",
          padding: "0.75rem 1rem",
          fontSize: "0.8rem",
          color: "#c4b5fd",
        }}
      >
        Click any card for full retraction details, DOI, and its receipt. Data sourced from the
        Crossref metadata registry via the <span style={{ fontFamily: "monospace" }}>crossref_retractions_v1</span>{" "}
        pipeline — refreshed when the pipeline reruns, not live.
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
        {loading ? "Loading…" : `${total.toLocaleString()} papers`}
      </div>

      {/* Papers list */}
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
            Loading papers…
          </div>
        ) : papers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: S.muted }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔬</div>
            No papers found matching your filters.
          </div>
        ) : (
          papers.map((p) => <PaperCard key={p.id} paper={p} />)
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
