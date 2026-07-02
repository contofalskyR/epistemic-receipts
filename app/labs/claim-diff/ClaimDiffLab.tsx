"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  cyan: "#38bdf8",
};

type ListItem = {
  id: string;
  claimId: string;
  claim: string;
  snapshotCount: number;
  transitionCount: number;
  firstYear: number | null;
  lastYear: number | null;
  isCurated: boolean;
};

type Extracted = { category: string; claim: string };
type Diff = {
  kept: { category: string; prev: string; next: string }[];
  changed: { category: string; prev: string; next: string }[];
  dropped: { category: string; claim: string }[];
  added: { category: string; claim: string }[];
};

type Transition = {
  id: string;
  fromAxis: string | null;
  toAxis: string;
  community: string;
  occurredAt: string;
  datePrecision: string | null;
  reason: string | null;
  source: { name: string; url: string | null } | null;
  snapshot: Extracted[] | null;
  diff: Diff | null;
};

type Detail = {
  id: string;
  claimId: string;
  claim: string;
  transitions: Transition[];
};

const COMMUNITY_LABEL: Record<string, string> = {
  EXPERT_LITERATURE: "Expert literature",
  INSTITUTIONAL: "Institutions",
  JUDICIAL: "Courts",
  PUBLIC: "Public",
  MARKET: "Markets",
};

const AXIS_COLOR: Record<string, string> = {
  RECORDED: "#94a3b8",
  SETTLED: C.green,
  CONTESTED: C.amber,
  OPEN: C.cyan,
  UNRESOLVABLE: "#a78bfa",
  REVERSED: C.red,
  ABANDONED: "#6b7280",
};

function ClaimDiffLabInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("t");

  const [list, setList] = useState<ListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/labs/claim-diff/list")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { trajectories: ListItem[] }) => {
        if (!cancelled) setList(j.trajectories);
      })
      .catch((e) => {
        if (!cancelled) setListError(e instanceof Error ? e.message : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/labs/claim-diff/${encodeURIComponent(activeId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Detail) => {
        if (!cancelled) {
          setDetail(j);
          setDetailLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDetailError(e instanceof Error ? e.message : "failed");
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const filteredList = useMemo(() => {
    if (!list) return [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((it) => it.claim.toLowerCase().includes(q));
  }, [list, query]);

  const selectTrajectory = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("t", id);
    router.replace(`/labs/claim-diff?${params.toString()}`, { scroll: false });
  };

  return (
    <div
      style={{
        background: C.bg,
        color: C.ink,
        minHeight: "100vh",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${C.panelEdge}`,
          padding: "20px 24px",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: C.brand,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Labs · experimental
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              margin: 0,
              marginBottom: 8,
            }}
          >
            Claim Inheritance
          </h1>
          <p
            style={{
              fontSize: 13,
              color: C.mut,
              margin: 0,
              maxWidth: 720,
              lineHeight: 1.55,
            }}
          >
            Every trajectory on the Settling Curve is a chain of sources. This
            view pries them apart: for each adjacent pair, it shows which
            factual claims the next source carried forward, which it changed,
            which it dropped, and which it added. Snapshots are AI-extracted
            from the transition&apos;s reason text.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/settling-curve"
              style={{
                fontSize: 12,
                color: C.mut,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              ← Back to Settling Curve
            </Link>
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(280px, 360px) 1fr",
          gap: 24,
          padding: "24px",
          alignItems: "start",
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            background: C.panel,
            border: `1px solid ${C.panelEdge}`,
            borderRadius: 10,
            padding: 14,
            position: "sticky",
            top: 24,
            maxHeight: "calc(100vh - 48px)",
            overflowY: "auto",
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              color: C.faint,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Trajectories with snapshots
          </div>
          <input
            type="search"
            placeholder="Search claim text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              background: C.bg,
              border: `1px solid ${C.panelEdge}`,
              borderRadius: 6,
              color: C.ink,
              fontSize: 12,
              outline: "none",
              marginBottom: 10,
            }}
          />
          {listError && (
            <div style={{ fontSize: 12, color: C.red, padding: 8 }}>
              Failed to load: {listError}
            </div>
          )}
          {!list && !listError && (
            <div style={{ fontSize: 12, color: C.mut, padding: 8 }}>
              Loading trajectories…
            </div>
          )}
          {list && filteredList.length === 0 && (
            <div style={{ fontSize: 12, color: C.mut, padding: 8, lineHeight: 1.5 }}>
              {list.length === 0
                ? "No snapshots generated yet. Run scripts/enrich-transition-claims.ts to populate."
                : "No matches."}
            </div>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {filteredList.map((it) => {
              const isActive = activeId === it.id;
              return (
                <li key={it.id} style={{ marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => selectTrajectory(it.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      background: isActive ? "rgba(212,168,83,0.08)" : "transparent",
                      border: "1px solid transparent",
                      borderLeft: isActive
                        ? `2px solid ${C.brand}`
                        : "2px solid transparent",
                      borderRadius: 4,
                      color: C.ink,
                      cursor: "pointer",
                      fontSize: 12.5,
                      lineHeight: 1.45,
                    }}
                  >
                    <div style={{ fontWeight: isActive ? 600 : 500 }}>
                      {it.claim}
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        color: C.faint,
                        marginTop: 4,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {it.snapshotCount}/{it.transitionCount} snapshots
                      {it.firstYear && it.lastYear
                        ? ` · ${it.firstYear}–${it.lastYear}`
                        : ""}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Right panel */}
        <main style={{ minWidth: 0 }}>
          {!activeId && (
            <div
              style={{
                background: C.panel,
                border: `1px solid ${C.panelEdge}`,
                borderRadius: 10,
                padding: 32,
                color: C.mut,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: C.brand,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Pick a trajectory
              </div>
              Select a trajectory from the left to see the transition log with
              per-source claim snapshots and the inheritance diff between each
              adjacent pair.
            </div>
          )}

          {activeId && detailLoading && (
            <div style={{ padding: 24, color: C.mut, fontSize: 13 }}>
              Loading transitions…
            </div>
          )}

          {activeId && detailError && (
            <div
              style={{
                padding: 20,
                borderRadius: 10,
                background: "#1a0a0a",
                border: `1px solid ${C.red}`,
                color: C.red,
                fontSize: 13,
              }}
            >
              Failed to load: {detailError}
            </div>
          )}

          {activeId && detail && <TransitionLog detail={detail} />}

          {activeId && detail && detail.transitions.every((t) => !t.snapshot) && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 8,
                background: C.panel,
                border: `1px solid ${C.panelEdge}`,
                color: C.mut,
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              Snapshots not yet generated for this trajectory. Run{" "}
              <code style={{ color: C.brand }}>
                scripts/enrich-transition-claims.ts
              </code>{" "}
              to populate.
            </div>
          )}

          <p
            className="font-mono"
            style={{
              marginTop: 28,
              fontSize: 10,
              color: C.faint,
              letterSpacing: "0.04em",
              lineHeight: 1.6,
            }}
          >
            Snapshots generated from transition reason text via AI extraction.
            Source documents may contain additional detail not captured here.
          </p>
        </main>
      </div>
    </div>
  );
}

function TransitionLog({ detail }: { detail: Detail }) {
  return (
    <div>
      <div
        style={{
          background: C.panel,
          border: `1px solid ${C.panelEdge}`,
          borderRadius: 10,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            color: C.brand,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Claim
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: C.ink }}>
          {detail.claim}
        </div>
      </div>

      {detail.transitions.map((t, i) => (
        <React.Fragment key={t.id}>
          {t.diff && i > 0 && <DiffPanel diff={t.diff} />}
          <TransitionCard transition={t} index={i} />
        </React.Fragment>
      ))}
    </div>
  );
}

function TransitionCard({
  transition: t,
  index,
}: {
  transition: Transition;
  index: number;
}) {
  const axisColor = AXIS_COLOR[t.toAxis] ?? C.mut;
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.panelEdge}`,
        borderRadius: 10,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: C.faint,
            letterSpacing: "0.08em",
          }}
        >
          #{index + 1}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            padding: "2px 8px",
            border: `1px solid ${axisColor}`,
            color: axisColor,
            borderRadius: 3,
            letterSpacing: "0.08em",
          }}
        >
          {t.fromAxis ? `${t.fromAxis} → ${t.toAxis}` : t.toAxis}
        </span>
        <span style={{ fontSize: 12, color: C.mut }}>
          {COMMUNITY_LABEL[t.community] ?? t.community}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 11, color: C.faint, marginLeft: "auto" }}
        >
          {t.occurredAt}
        </span>
      </div>

      {t.source && (
        <div style={{ fontSize: 12.5, marginBottom: 8 }}>
          {t.source.url ? (
            <a
              href={t.source.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: C.brand, textDecoration: "underline" }}
            >
              {t.source.name}
            </a>
          ) : (
            <span style={{ color: C.mut }}>{t.source.name}</span>
          )}
        </div>
      )}

      {t.reason && (
        <div
          style={{
            fontSize: 13,
            color: C.ink,
            lineHeight: 1.55,
            marginTop: 6,
          }}
        >
          {t.reason}
        </div>
      )}

      {t.snapshot && t.snapshot.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary
            className="font-mono"
            style={{
              fontSize: 10,
              color: C.faint,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Extracted claims ({t.snapshot.length})
          </summary>
          <ul
            style={{
              listStyle: "none",
              margin: "8px 0 0",
              padding: 0,
              display: "grid",
              gap: 6,
            }}
          >
            {t.snapshot.map((c, j) => (
              <li
                key={j}
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: C.ink,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    color: C.brand,
                    letterSpacing: "0.06em",
                    minWidth: 90,
                    textTransform: "uppercase",
                  }}
                >
                  {c.category}
                </span>
                <span>{c.claim}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function DiffPanel({ diff }: { diff: Diff }) {
  const sections = [
    { key: "kept", label: "Carried forward", color: C.green, items: diff.kept },
    { key: "changed", label: "Changed", color: C.amber, items: diff.changed },
    { key: "dropped", label: "Dropped", color: C.red, items: diff.dropped },
    { key: "added", label: "Added", color: C.cyan, items: diff.added },
  ] as const;

  const total =
    diff.kept.length + diff.changed.length + diff.dropped.length + diff.added.length;

  if (total === 0) {
    return (
      <div
        style={{
          margin: "6px 0 12px",
          padding: "10px 14px",
          borderRadius: 6,
          background: "transparent",
          border: `1px dashed ${C.panelEdge}`,
          color: C.faint,
          fontSize: 11.5,
        }}
      >
        No overlap in extracted categories — treat both sources as covering
        different ground.
      </div>
    );
  }

  return (
    <div
      style={{
        margin: "6px 0 12px",
        padding: 14,
        borderRadius: 6,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${C.panelEdge}`,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 9.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.faint,
          marginBottom: 10,
        }}
      >
        Inheritance diff
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {sections.map((sec) =>
          sec.items.length === 0 ? null : (
            <div key={sec.key}>
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: sec.color,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                {sec.label} ({sec.items.length})
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                {sec.items.map((it, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 12.5,
                      color: C.ink,
                      lineHeight: 1.5,
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        color: sec.color,
                        minWidth: 90,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {it.category}
                    </span>
                    <DiffItem item={it} />
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function DiffItem({
  item,
}: {
  item:
    | { category: string; prev: string; next: string }
    | { category: string; claim: string };
}) {
  if ("claim" in item) {
    return <span>{item.claim}</span>;
  }
  return (
    <span>
      <span style={{ color: C.mut, textDecoration: "line-through" }}>
        {item.prev}
      </span>
      <span style={{ color: C.faint, margin: "0 6px" }}>→</span>
      <span>{item.next}</span>
    </span>
  );
}

export default function ClaimDiffLab() {
  return (
    <Suspense fallback={null}>
      <ClaimDiffLabInner />
    </Suspense>
  );
}
