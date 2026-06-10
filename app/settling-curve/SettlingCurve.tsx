"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const C = {
  bg: "#08080f",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#f0a000",
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
  communities?: Community[];
  transitionCount?: number;
  hasReversal: boolean;
  hasAbandonment: boolean;
}

interface TrajectoryDetail {
  id: string;
  claim: string;
  transitions: Transition[];
}

const STATUS: Record<Axis, { c: string; label: string }> = {
  RECORDED: { c: "#94a3b8", label: "Recorded" },
  SETTLED: { c: "#10b981", label: "Settled" },
  CONTESTED: { c: "#f59e0b", label: "Contested" },
  OPEN: { c: "#38bdf8", label: "Open" },
  UNRESOLVABLE: { c: "#a78bfa", label: "Unresolvable" },
  REVERSED: { c: "#f43f5e", label: "Reversed" },
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

function SettlingCurveInner() {
  const searchParams = useSearchParams();
  const [list, setList] = useState<TrajectoryListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [traj, setTraj] = useState<TrajectoryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  // Load the trajectory list once on mount; honor ?t=<id> deep-link.
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

  // Load the detail whenever the active trajectory changes.
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

  const reset = (id: string) => { setActiveId(id); setSelected(null); };

  const activeItem = list.find((l) => l.id === activeId) || null;
  const title = activeItem?.claim ?? traj?.claim ?? "";

  function renderBody() {
    if (loadingDetail && !traj) {
      return (
        <div className="rounded-lg p-2 mb-5" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
          <div
            aria-hidden
            style={{ height: 360, borderRadius: 6, background: "linear-gradient(90deg,#10101c,#16162a,#10101c)" }}
          />
        </div>
      );
    }

    if (!traj || traj.transitions.length === 0) {
      return (
        <div className="rounded-lg p-5 mb-5" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
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
        <p className="mb-7" style={{ color: C.mut, fontSize: 15, maxWidth: 640 }}>
          {interval.lead}{" "}
          <span className="font-mono font-semibold" style={{ color: C.brand }}>
            {dur.n} {dur.unit}
          </span>{" "}
          {interval.tail}{" "}
          <span style={{ color: C.faint }}>
            {yr(interval.from.occurredAt)} → {yr(interval.to.occurredAt)}.
          </span>
        </p>

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

        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-7">
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
          <a href={detail.source.url ?? undefined} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1" style={{ fontSize: 13, color: C.brand }}>
            {detail.source.name} <span aria-hidden>↗</span>
          </a>
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

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100%" }} className="w-full">
      <style>{REDUCED_MOTION_CSS}</style>
      <div className="mx-auto px-5 py-8" style={{ maxWidth: 1040 }}>

        <div className="flex items-center justify-between mb-7">
          <div className="font-mono text-xs tracking-widest" style={{ color: C.brand }}>
            EPISTEMIC RECEIPTS
          </div>
          <div className="font-mono text-xs tracking-widest" style={{ color: C.faint }}>
            SETTLING CURVE
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-6" style={{ scrollbarWidth: "thin" }}>
          {list.map((x) => {
            const on = x.id === activeId;
            const tag = x.hasReversal ? "↩ reversed" : x.hasAbandonment ? "✕ abandoned" : null;
            return (
              <button
                key={x.id}
                onClick={() => reset(x.id)}
                onKeyDown={(e) => e.key === "Enter" && reset(x.id)}
                tabIndex={0}
                role="button"
                className="sc-anim shrink-0 px-3 py-2 rounded text-left transition-colors"
                style={{
                  background: on ? "#1a1a2b" : "transparent",
                  border: `1px solid ${on ? C.brand : C.panelEdge}`,
                  minWidth: 150,
                }}
              >
                <div className="text-xs leading-snug" style={{ color: on ? C.ink : C.mut }}>
                  {x.claim}
                </div>
                {tag && (
                  <div className="font-mono mt-1" style={{ fontSize: 10, color: x.hasReversal ? STATUS.REVERSED.c : STATUS.ABANDONED.c }}>
                    {tag}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <h1 className="font-semibold tracking-tight mb-2" style={{ fontSize: 30, lineHeight: 1.1 }}>
          {title}
        </h1>

        {renderBody()}

      </div>
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
