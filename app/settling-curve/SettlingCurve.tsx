"use client";
import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import SettlingCurveMini from "../components/SettlingCurveMini";

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
  amber: "#f59e0b",
};

type Axis =
  | "RECORDED"
  | "SETTLED"
  | "CONTESTED"
  | "OPEN"
  | "UNRESOLVABLE"
  | "REVERSED"
  | "ABANDONED";

type Community =
  | "EXPERT_LITERATURE"
  | "INSTITUTIONAL"
  | "JUDICIAL"
  | "PUBLIC"
  | "MARKET";

interface TransitionSource {
  name: string;
  url: string | null;
}

interface Transition {
  fromAxis?: string | null;
  toAxis: Axis;
  community: Community;
  occurredAt: string;
  datePrecision?: string | null;
  reason: string | null;
  source: TransitionSource;
}

interface TrajectoryListItem {
  id: string;
  claim: string;
  domain?: string;
  era?: string;
  communities?: Community[];
  transitionCount?: number;
  hasReversal: boolean;
  hasAbandonment: boolean;
  currentAxis?: Axis | null;
  firstYear?: number | null;
  lastYear?: number | null;
  milestones?: { year: number; axis: string }[];
}

interface TrajectoryDetail {
  id: string;
  claim: string;
  transitions: Transition[];
}

const STATUS: Record<Axis, { c: string; label: string }> = {
  RECORDED: { c: "#94a3b8", label: "Recorded" },
  SETTLED: { c: "#22c55e", label: "Settled" },
  CONTESTED: { c: "#f59e0b", label: "Contested" },
  OPEN: { c: "#38bdf8", label: "Open" },
  UNRESOLVABLE: { c: "#a78bfa", label: "Unresolvable" },
  REVERSED: { c: "#ef4444", label: "Reversed" },
  ABANDONED: { c: "#6b7280", label: "Abandoned" },
};

const COMMUNITY_ORDER: Community[] = ["EXPERT_LITERATURE", "INSTITUTIONAL", "JUDICIAL", "PUBLIC", "MARKET"];
const COMMUNITY_LABEL: Record<Community, string> = {
  EXPERT_LITERATURE: "Expert literature",
  INSTITUTIONAL: "Institutions",
  JUDICIAL: "Courts",
  PUBLIC: "Public",
  MARKET: "Markets",
};

const ERA_ORDER = [
  "Ancient & Classical",
  "Medieval & Islamic Golden Age",
  "Early Modern",
  "Industrial & Colonial",
  "WWI / WWII & Interwar",
  "Cold War & Postwar",
  "Modern",
  "Unknown",
];

const ERA_FILTERS: { key: string; label: string; full: string | null }[] = [
  { key: "ALL", label: "All Eras", full: null },
  { key: "Ancient & Classical", label: "Ancient", full: "Ancient & Classical" },
  { key: "Medieval & Islamic Golden Age", label: "Medieval", full: "Medieval & Islamic Golden Age" },
  { key: "Early Modern", label: "Early Modern", full: "Early Modern" },
  { key: "Industrial & Colonial", label: "Industrial", full: "Industrial & Colonial" },
  { key: "WWI / WWII & Interwar", label: "WWI–WWII", full: "WWI / WWII & Interwar" },
  { key: "Cold War & Postwar", label: "Cold War", full: "Cold War & Postwar" },
  { key: "Modern", label: "Modern", full: "Modern" },
];

type StatusFilter = "ALL" | "SETTLED" | "REVERSED" | "CONTESTED";

const STATUS_FILTERS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "ALL", label: "All", color: C.mut },
  { key: "SETTLED", label: "Settled", color: C.green },
  { key: "REVERSED", label: "Reversed", color: C.red },
  { key: "CONTESTED", label: "Contested", color: C.amber },
];

function axisDotColor(item: TrajectoryListItem): string {
  if (item.hasReversal) return C.red;
  if (item.hasAbandonment) return "#6b7280";
  const a = item.currentAxis;
  if (a === "SETTLED") return C.green;
  if (a === "CONTESTED") return C.amber;
  if (a === "OPEN") return "#38bdf8";
  if (a === "UNRESOLVABLE") return "#a78bfa";
  return "#94a3b8";
}

function matchesStatusFilter(item: TrajectoryListItem, f: StatusFilter): boolean {
  if (f === "ALL") return true;
  if (f === "REVERSED") return item.hasReversal;
  if (f === "SETTLED") return !item.hasReversal && item.currentAxis === "SETTLED";
  if (f === "CONTESTED") return !item.hasReversal && item.currentAxis === "CONTESTED";
  return true;
}

function frac(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number);
  return y + (m ? (m - 1) / 12 : 0);
}
const yr = (d: string) => Number(d.split("-")[0]);

function keyInterval(t: { transitions: Transition[] }) {
  const sorted = [...t.transitions].sort((a, b) => frac(a.occurredAt) - frac(b.occurredAt));
  const rev = sorted.find((x) => x.toAxis === "REVERSED");
  const aban = sorted.find((x) => x.toAxis === "ABANDONED");
  const first = sorted[0];

  if (rev) {
    const held = sorted.find((x) => x.toAxis === "SETTLED") || first;
    return { from: held, to: rev, kind: "reversed", lead: "Treated as settled for", tail: "until it was overturned." };
  }
  if (aban) {
    return { from: first, to: aban, kind: "abandoned", lead: "Argued over for", tail: "then abandoned." };
  }
  const expert = sorted.find((x) => x.community === "EXPERT_LITERATURE");
  const inst = sorted.find((x) => x.community === "INSTITUTIONAL" && x.toAxis === "SETTLED") ||
    sorted.find((x) => x.community === "INSTITUTIONAL");
  if (expert && inst && frac(inst.occurredAt) >= frac(expert.occurredAt)) {
    return { from: expert, to: inst, kind: "lag", lead: "Experts first reported it; institutions took", tail: "to ratify it." };
  }
  return { from: first, to: sorted[sorted.length - 1], kind: "span", lead: "Recorded across", tail: "of transitions." };
}

function durationLabel(fromD: string, toD: string) {
  const months = Math.round((frac(toD) - frac(fromD)) * 12);
  if (months < 18) return { n: months, unit: months === 1 ? "month" : "months" };
  return { n: Math.round(months / 12), unit: "years" };
}

const REDUCED_MOTION_CSS =
  "@media (prefers-reduced-motion: reduce){.sc-anim{transition:none !important}}";

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

function SettlingCurveInner() {
  const searchParams = useSearchParams();
  const [list, setList] = useState<TrajectoryListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [traj, setTraj] = useState<TrajectoryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [eraFilter, setEraFilter] = useState<string>("ALL");
  const [domainFilter, setDomainFilter] = useState<string>("ALL");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trajectories")
      .then((r) => r.json())
      .then((data: TrajectoryListItem[]) => {
        if (cancelled) return;
        setList(data);
        const deep = searchParams.get("t");
        const initial = deep && data.some((d) => d.id === deep) ? deep : data[0]?.id ?? null;
        setActiveId(initial);
        if (initial == null) setLoadingDetail(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingDetail(true);
    setTraj(null);
    setSelected(null);
    fetch(`/api/trajectories/${activeId}`)
      .then((r) => r.json())
      .then((data: TrajectoryDetail) => {
        if (cancelled) return;
        setTraj(data && Array.isArray(data.transitions) ? data : null);
        setLoadingDetail(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const selectItem = (id: string) => {
    setActiveId(id);
    setSelected(null);
    setDrawerOpen(false);
  };

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((item) => {
      if (q && !item.claim.toLowerCase().includes(q)) return false;
      if (!matchesStatusFilter(item, statusFilter)) return false;
      if (eraFilter !== "ALL" && (item.era ?? "Unknown") !== eraFilter) return false;
      if (domainFilter !== "ALL" && (item.domain ?? "history") !== domainFilter) return false;
      return true;
    });
  }, [list, query, statusFilter, eraFilter, domainFilter]);

  const activeItem = list.find((l) => l.id === activeId) || null;
  const title = activeItem?.claim ?? traj?.claim ?? "";

  function renderChart() {
    if (loadingDetail && !traj) {
      return (
        <div className="rounded-lg p-2" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
          <div
            aria-hidden
            style={{ height: 360, borderRadius: 6, background: "linear-gradient(90deg,#10101c,#16162a,#10101c)" }}
          />
        </div>
      );
    }

    if (!traj || traj.transitions.length === 0) {
      return (
        <div className="rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
          <p style={{ color: C.mut, fontSize: 14 }}>No transitions recorded yet for this claim.</p>
        </div>
      );
    }

    const t = traj;
    const interval = keyInterval(t);
    const dur = durationLabel(interval.from.occurredAt, interval.to.occurredAt);

    const lanes = COMMUNITY_ORDER.filter((c) => t.transitions.some((x) => x.community === c));

    const years = t.transitions.map((x) => frac(x.occurredAt));
    const minY = Math.floor(Math.min(...years) - 3);
    const maxY = Math.ceil(Math.max(...years) + 3);
    const W = 920, padL = 132, padR = 36, padTop = 96, laneH = 54, axisH = 46;
    const H = padTop + lanes.length * laneH + axisH;
    const x = (year: number) => padL + ((year - minY) / (maxY - minY)) * (W - padL - padR);
    const laneY = (i: number) => padTop + i * laneH + laneH / 2;

    const decades: number[] = [];
    for (let d = Math.ceil(minY / 10) * 10; d <= maxY; d += 10) decades.push(d);

    const sel = selected != null ? t.transitions[selected] : null;
    const fallback = t.transitions.indexOf(interval.to);
    const detail = sel || t.transitions[fallback] || t.transitions[0];

    return (
      <>
        <div className="rounded-lg p-2 mb-5" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", height: "auto" }} role="img"
            aria-label={`Settling curve for: ${t.claim}`}>

            {[interval.from, interval.to].map((tr, i) => (
              <line key={i} x1={x(frac(tr.occurredAt))} x2={x(frac(tr.occurredAt))}
                y1={padTop - 14} y2={H - axisH}
                stroke={C.brand} strokeOpacity={0.22} strokeDasharray="3 4" />
            ))}

            {(() => {
              const xa = x(frac(interval.from.occurredAt));
              const xb = x(frac(interval.to.occurredAt));
              const by = padTop - 44;
              const mid = (xa + xb) / 2;
              return (
                <g>
                  <line x1={xa} x2={xb} y1={by} y2={by} stroke={C.brand} strokeWidth={1.5} />
                  <line x1={xa} x2={xa} y1={by} y2={by + 8} stroke={C.brand} strokeWidth={1.5} />
                  <line x1={xb} x2={xb} y1={by} y2={by + 8} stroke={C.brand} strokeWidth={1.5} />
                  <text x={mid} y={by - 8} textAnchor="middle" fontFamily="ui-monospace, monospace"
                    fontSize={20} fontWeight="700" fill={C.brand}>
                    {dur.n} {dur.unit}
                  </text>
                </g>
              );
            })()}

            {lanes.map((com, i) => {
              const y = laneY(i);
              const rows = t.transitions
                .filter((r) => r.community === com)
                .sort((a, b) => frac(a.occurredAt) - frac(b.occurredAt));
              return (
                <g key={com}>
                  <line x1={padL} x2={W - padR} y1={y} y2={y} stroke={C.panelEdge} strokeWidth={1} />
                  <text x={14} y={y - 5} fontFamily="ui-monospace, monospace" fontSize={11.5}
                    fill={C.ink} fontWeight="600">{COMMUNITY_LABEL[com]}</text>
                  <text x={14} y={y + 11} fontFamily="ui-monospace, monospace" fontSize={9.5} fill={C.faint}>
                    {rows.length} {rows.length === 1 ? "marker" : "markers"}
                  </text>

                  {rows.map((r, k) => {
                    const xStart = x(frac(r.occurredAt));
                    const xEnd = k < rows.length - 1 ? x(frac(rows[k + 1].occurredAt)) : W - padR;
                    return (
                      <line key={k} x1={xStart} x2={xEnd} y1={y} y2={y}
                        stroke={STATUS[r.toAxis].c} strokeWidth={3} strokeOpacity={0.85} />
                    );
                  })}

                  {rows.map((r, k) => {
                    const gi = t.transitions.indexOf(r);
                    const cx = x(frac(r.occurredAt));
                    const isSel = selected === gi;
                    return (
                      <g key={k} style={{ cursor: "pointer" }} tabIndex={0} role="button"
                        aria-label={`${COMMUNITY_LABEL[r.community]}: ${STATUS[r.toAxis].label} (${yr(r.occurredAt)})`}
                        onClick={() => setSelected(gi)}
                        onKeyDown={(e) => e.key === "Enter" && setSelected(gi)}>
                        {isSel && <circle cx={cx} cy={y} r={11} fill="none" stroke={C.brand} strokeWidth={2} />}
                        <circle cx={cx} cy={y} r={7} fill={STATUS[r.toAxis].c}
                          stroke={C.bg} strokeWidth={2} />
                        <text x={cx} y={y + 26} textAnchor="middle" fontFamily="ui-monospace, monospace"
                          fontSize={10} fill={C.mut}>{yr(r.occurredAt)}</text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {decades.map((d) => (
              <g key={d}>
                <line x1={x(d)} x2={x(d)} y1={H - axisH} y2={H - axisH + 5} stroke={C.faint} />
                <text x={x(d)} y={H - axisH + 20} textAnchor="middle" fontFamily="ui-monospace, monospace"
                  fontSize={11} fill={C.faint}>{d}</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5">
          {[...new Set(t.transitions.map((x) => x.toAxis))].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span style={{ width: 10, height: 10, borderRadius: 9, background: STATUS[s].c, display: "inline-block" }} />
              <span className="font-mono" style={{ fontSize: 11, color: C.mut }}>{STATUS[s].label}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
          <div className="font-mono tracking-widest mb-3" style={{ fontSize: 10, color: C.faint }}>
            {selected != null ? "SELECTED RECEIPT" : "KEY RECEIPT"} · {COMMUNITY_LABEL[detail.community]}
          </div>
          <div className="flex items-start gap-3 mb-2">
            <span className="font-mono shrink-0 px-2 py-1 rounded" style={{ fontSize: 11, color: STATUS[detail.toAxis].c, border: `1px solid ${STATUS[detail.toAxis].c}55` }}>
              {STATUS[detail.toAxis].label}
            </span>
            <span className="font-mono" style={{ fontSize: 13, color: C.ink, paddingTop: 3 }}>
              {detail.occurredAt}
            </span>
          </div>
          <p className="mb-3" style={{ fontSize: 14, color: C.ink }}>{detail.reason}</p>
          {detail.source.url ? (
            <a href={detail.source.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1" style={{ fontSize: 13, color: C.brand }}>
              {detail.source.name} <span aria-hidden>↗</span>
            </a>
          ) : (
            <span style={{ fontSize: 13, color: C.mut }}>{detail.source.name}</span>
          )}
          <p className="mt-4" style={{ fontSize: 12, color: C.faint }}>
            Each point is a dated source — the receipt for when a community changed its mind. Tap any marker.
          </p>
          <a href={`/api/trajectories/${t.id}?format=csv`}
            className="inline-flex items-center gap-1 mt-2" style={{ fontSize: 12, color: C.mut }}>
            Download data (CSV) <span aria-hidden>↓</span>
          </a>
        </div>
      </>
    );
  }

  const erasInList = ERA_ORDER.filter((era) =>
    filteredList.some((x) => (x.era ?? "Unknown") === era)
  );

  function renderSidebar() {
    return (
      <div className="flex flex-col h-full">
        <div
          className="px-4 pt-4 pb-3 border-b"
          style={{ background: C.panel, borderColor: C.panelEdge }}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="font-mono tracking-widest"
              style={{ fontSize: 11, color: C.brand, textTransform: "uppercase" }}
            >
              Historical Receipts
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="md:hidden rounded px-2 py-1"
              style={{ fontSize: 14, color: C.mut, border: `1px solid ${C.panelEdge}` }}
              aria-label="Close trajectory list"
            >
              ✕
            </button>
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trajectories…"
            className="w-full px-3 py-2 mb-3 rounded outline-none"
            style={{
              background: C.bg,
              border: `1px solid ${C.panelEdge}`,
              color: C.ink,
              fontSize: 13,
            }}
          />

          <div className="flex flex-wrap gap-1.5 mb-2">
            {STATUS_FILTERS.map((f) => {
              const on = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className="font-mono rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    background: on ? `${f.color}22` : "transparent",
                    border: `1px solid ${on ? f.color : C.panelEdge}`,
                    color: on ? f.color : C.mut,
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ERA_FILTERS.map((f) => {
              const on = eraFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setEraFilter(f.key)}
                  className="font-mono rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    background: on ? `${C.brand}22` : "transparent",
                    border: `1px solid ${on ? C.brand : C.panelEdge}`,
                    color: on ? C.brand : C.mut,
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              { key: "ALL", label: "All domains", emoji: "" },
              { key: "history", label: "History", emoji: "🌊" },
              { key: "medicine", label: "Medicine", emoji: "💊" },
              { key: "astronomy", label: "Astronomy", emoji: "🔭" },
              { key: "climate", label: "Climate", emoji: "🌍" },
              { key: "nutrition", label: "Nutrition", emoji: "🥗" },
            ].filter((d) => d.key === "ALL" || list.some((x) => (x.domain ?? "history") === d.key)).map((d) => {
              const on = domainFilter === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDomainFilter(d.key)}
                  className="rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.04em",
                    background: on ? "#38bdf822" : "transparent",
                    border: `1px solid ${on ? "#38bdf8" : C.panelEdge}`,
                    color: on ? "#38bdf8" : C.mut,
                  }}
                >
                  {d.emoji ? `${d.emoji} ${d.label}` : d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3" style={{ background: C.bg }}>
          {filteredList.length === 0 ? (
            <div className="px-3 py-6 text-center" style={{ color: C.mut, fontSize: 12 }}>
              No trajectories match these filters.
            </div>
          ) : (
            erasInList.map((era) => {
              const items = filteredList.filter((x) => (x.era ?? "Unknown") === era);
              return (
                <section key={era} className="mb-4">
                  <header
                    className="font-mono px-2 mb-1 flex items-center justify-between"
                    style={{
                      fontSize: 10,
                      color: C.mut,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span>{era}</span>
                    <span style={{ color: C.faint }}>{items.length}</span>
                  </header>
                  <ul className="space-y-1">
                    {items.map((x) => {
                      const on = x.id === activeId;
                      return (
                        <li key={x.id}>
                          <button
                            type="button"
                            onClick={() => selectItem(x.id)}
                            className="sc-anim w-full text-left px-3 py-2 transition-colors flex items-start gap-2.5"
                            style={{
                              background: on ? `${C.brand}14` : "transparent",
                              borderLeft: `3px solid ${on ? C.brand : "transparent"}`,
                              borderRadius: 4,
                            }}
                          >
                            <span
                              aria-hidden
                              className="shrink-0 mt-1"
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 8,
                                background: axisDotColor(x),
                                boxShadow: `0 0 0 2px ${C.bg}`,
                              }}
                            />
                            <span className="flex-1 min-w-0">
                              <span
                                className="block leading-snug"
                                style={{
                                  fontSize: 12.5,
                                  color: on ? C.ink : C.mut,
                                }}
                              >
                                {truncate(x.claim, 110)}
                              </span>
                              <span
                                className="font-mono flex items-center gap-2 mt-1"
                                style={{ fontSize: 10, color: C.faint }}
                              >
                                <span
                                  className="px-1.5 py-px rounded"
                                  style={{
                                    background: `${C.panelEdge}66`,
                                    color: C.mut,
                                  }}
                                >
                                  {x.transitionCount ?? 0} ↻
                                </span>
                                {x.firstYear != null && x.lastYear != null && (
                                  <span>
                                    {x.firstYear}
                                    {x.firstYear !== x.lastYear && `–${x.lastYear}`}
                                  </span>
                                )}
                                {x.hasReversal && (
                                  <span style={{ color: C.red }}>↩ reversed</span>
                                )}
                                {!x.hasReversal && x.hasAbandonment && (
                                  <span style={{ color: STATUS.ABANDONED.c }}>✕ abandoned</span>
                                )}
                              </span>
                              {/* Static preview sparkline. animate={false} +
                                  content-visibility keeps the un-paginated list
                                  cheap — only on-screen rows paint their SVG. */}
                              {x.milestones && x.milestones.length > 0 && (
                                <span
                                  className="block mt-1.5"
                                  style={{
                                    contentVisibility: "auto",
                                    containIntrinsicSize: "220px 58px",
                                  }}
                                >
                                  <SettlingCurveMini
                                    milestones={x.milestones}
                                    animate={false}
                                    ariaLabel={`Settling-curve preview for: ${x.claim}`}
                                  />
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const headerInterval = traj && traj.transitions.length > 0 ? keyInterval(traj) : null;
  const headerDur = headerInterval
    ? durationLabel(headerInterval.from.occurredAt, headerInterval.to.occurredAt)
    : null;

  return (
    <div
      style={{
        background: C.bg,
        color: C.ink,
        marginLeft: "-1.5rem",
        marginRight: "-1.5rem",
        marginTop: "-2rem",
        marginBottom: "-2rem",
      }}
      className="w-auto"
    >
      <style>{REDUCED_MOTION_CSS}</style>

      <div
        className="flex"
        style={{ minHeight: "calc(100vh - 140px)" }}
      >
        {/* Sidebar (desktop sticky, mobile drawer) */}
        <aside
          className="hidden md:flex md:flex-col md:sticky shrink-0 z-30"
          style={{
            width: "min(35%, 380px)",
            minWidth: 280,
            top: 48,
            height: "calc(100vh - 48px)",
            borderRight: `1px solid ${C.panelEdge}`,
            background: C.panel,
          }}
        >
          {renderSidebar()}
        </aside>

        {/* Mobile drawer overlay */}
        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)" }}
            aria-hidden
          />
        )}
        <aside
          className="md:hidden fixed left-0 right-0 bottom-0 z-50 flex flex-col sc-anim"
          style={{
            height: "80vh",
            background: C.panel,
            borderTop: `1px solid ${C.panelEdge}`,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            transform: drawerOpen ? "translateY(0)" : "translateY(100%)",
            transition: "transform 0.25s ease-out",
            visibility: drawerOpen ? "visible" : "hidden",
          }}
          aria-hidden={!drawerOpen}
        >
          {renderSidebar()}
        </aside>

        {/* Right panel */}
        <main className="flex-1 min-w-0">
          <div className="px-5 md:px-8 py-6 max-w-5xl">
            {/* Audit banner */}
            <div
              className="rounded-lg px-4 py-3 mb-6"
              style={{
                background: "rgba(212,168,83,0.05)",
                border: `1px solid ${C.brand}55`,
              }}
            >
              <div className="font-mono tracking-widest mb-2" style={{ fontSize: 10, color: C.brand }}>
                AGENTIC LOOP — HOW THESE TRAJECTORIES ARE GENERATED
              </div>
              <p style={{ fontSize: 12.5, color: C.mut, lineHeight: 1.55, maxWidth: 760 }}>
                Historical receipts are written autonomously by a continuously running AI loop. Each iteration selects one of seven historical eras, researches 3–5 claims meeting strict validity criteria — dateable to a specific day or month, backed by contemporaneous primary sources, representing a clear epistemic transition (OPEN → RECORDED → SETTLED → REVERSED, etc.) — then appends them to the seed script, runs the ingest, commits, and pushes to the repository. To audit, read{" "}
                <a
                  href="https://github.com/contofalskyR/epistemic-receipts/blob/main/scripts/loop-settling-curve.sh"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: C.brand }}
                >
                  loop-settling-curve.sh
                </a>{" "}
                and{" "}
                <a
                  href="https://github.com/contofalskyR/epistemic-receipts/blob/main/scripts/seed-human-history-trajectories.ts"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: C.brand }}
                >
                  seed-human-history-trajectories.ts
                </a>.
              </p>
            </div>

            {/* Chart header */}
            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
              <div className="flex-1 min-w-0" style={{ minWidth: 260 }}>
                <h1
                  className="font-semibold tracking-tight mb-1"
                  style={{ fontSize: 26, lineHeight: 1.15 }}
                >
                  {title || (loadingDetail ? "" : "Select a trajectory")}
                </h1>
                {traj && traj.transitions.length > 0 && (() => {
                  const years = traj.transitions.map((x) => yr(x.occurredAt));
                  const first = Math.min(...years);
                  const last = Math.max(...years);
                  return (
                    <p
                      className="font-mono"
                      style={{ fontSize: 12, color: C.mut, letterSpacing: "0.04em" }}
                    >
                      {traj.transitions.length} TRANSITIONS · {first}
                      {first !== last && ` → ${last}`}
                      {activeItem?.era && ` · ${activeItem.era.toUpperCase()}`}
                    </p>
                  );
                })()}
              </div>
              {headerInterval && headerDur && (
                <div
                  className="rounded-lg px-4 py-3 shrink-0"
                  style={{
                    background: "rgba(212,168,83,0.06)",
                    border: `1px solid ${C.brand}`,
                    minWidth: 180,
                  }}
                >
                  <div
                    className="font-mono tracking-widest mb-1"
                    style={{ fontSize: 9, color: C.brand, textTransform: "uppercase" }}
                  >
                    Key Interval
                  </div>
                  <div
                    className="font-mono font-semibold"
                    style={{ fontSize: 22, color: C.brand, lineHeight: 1.1 }}
                  >
                    {headerDur.n} {headerDur.unit}
                  </div>
                  <div
                    className="font-mono mt-1"
                    style={{ fontSize: 10.5, color: C.faint }}
                  >
                    {yr(headerInterval.from.occurredAt)} → {yr(headerInterval.to.occurredAt)}
                  </div>
                </div>
              )}
            </div>

            {/* Chart + receipt */}
            {renderChart()}
          </div>
        </main>
      </div>

      {/* Mobile floating button */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed left-1/2 z-30 px-5 py-3 rounded-full shadow-lg"
        style={{
          bottom: 20,
          transform: "translateX(-50%)",
          background: C.brand,
          color: C.bg,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.02em",
          boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
        }}
      >
        Browse Trajectories ({filteredList.length})
      </button>
    </div>
  );
}

export default function SettlingCurve() {
  return (
    <Suspense fallback={null}>
      <SettlingCurveInner />
    </Suspense>
  );
}
