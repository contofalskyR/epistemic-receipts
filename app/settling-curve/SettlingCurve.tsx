"use client";
import React, { useState, useEffect, Suspense, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SettlingCurveMini from "../components/SettlingCurveMini";
import { ShareButtons } from "@/components/ShareButtons";
import SettlingCurveNav from "./SettlingCurveNav";

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
  ingestedBy?: string | null;
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

function pipelineLabel(ingestedBy?: string | null): string {
  if (!ingestedBy) return "";
  const s = ingestedBy.toLowerCase();
  if (s.includes("nara")) {
    if (s.includes("rg59") || s.includes("rg-59")) return "NARA RG-59 State Dept";
    if (s.includes("rg65") || s.includes("rg-65")) return "NARA RG-65 FBI";
    if (s.includes("rg226") || s.includes("rg-226")) return "NARA RG-226 OSS";
    if (s.includes("rg330") || s.includes("rg-330")) return "NARA RG-330 OSD";
    if (s.includes("rg218") || s.includes("rg-218")) return "NARA RG-218 Joint Chiefs";
    if (s.includes("rg84") || s.includes("rg-84")) return "NARA RG-84 Foreign Service";
    return "NARA Archive";
  }
  if (s.includes("who_gho") || s.includes("who-gho")) return "WHO Global Health";
  if (s.includes("voteview")) return "Voteview Congress";
  if (s.includes("congress")) return "Congress.gov";
  if (s.includes("bundestag")) return "Bundestag";
  if (s.includes("riksdag")) return "Riksdag";
  if (s.includes("openalex")) return "OpenAlex Literature";
  if (s.includes("crossref") || s.includes("retract")) return "CrossRef/Retraction Watch";
  if (s.includes("worldbank") || s.includes("world_bank")) return "World Bank";
  if (s.includes("vdem") || s.includes("v-dem")) return "V-Dem";
  if (s.includes("sipri")) return "SIPRI";
  if (s.includes("ucdp")) return "UCDP Conflict";
  if (s.includes("ofac")) return "OFAC Sanctions";
  if (s.includes("icsid")) return "ICSID Arbitration";
  if (s.includes("fec")) return "FEC Finance";
  if (s.includes("chebi")) return "ChEBI";
  if (s.includes("openfda") || s.includes("drugsatfda")) return "FDA Drug Approvals";
  if (s.includes("faers")) return "FDA Adverse Events";
  if (s.includes("clinicaltrials")) return "ClinicalTrials.gov";
  if (s.includes("omim")) return "OMIM";
  if (s.includes("nasa")) return "NASA";
  if (s.includes("courtlistener")) return "CourtListener";
  return ingestedBy;
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
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [traj, setTraj] = useState<TrajectoryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [eraFilter, setEraFilter] = useState<string>("ALL");
  const [domainFilter, setDomainFilter] = useState<string>("ALL");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [browseMode, setBrowseMode] = useState(false);
  const [filterOpen, setFilterOpen] = useState({ status: true, era: false, domain: false });
  const [receiptOpen, setReceiptOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(30);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [feedVisibleCount, setFeedVisibleCount] = useState(12);
  const feedSentinelRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(false);
    fetch("/api/trajectories", { signal: AbortSignal.timeout(30000) })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: TrajectoryListItem[] = await r.json();
        if (!Array.isArray(data)) throw new Error("bad payload");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setList(data);
        setListLoading(false);
        const deep = searchParams.get("t");
        const initial = deep && data.some((d) => d.id === deep) ? deep : data[0]?.id ?? null;
        setActiveId(initial);
        if (initial == null) setLoadingDetail(false);
      })
      .catch(() => {
        if (!cancelled) { setListLoading(false); setListError(true); setLoadingDetail(false); }
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams, retryKey]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingDetail(true);
    setTraj(null);
    setSelected(null);
    fetch(`/api/trajectories/${activeId}`, { signal: AbortSignal.timeout(20000) })
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
    setBrowseMode(false);
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

  // Reset visible counts whenever filters change
  useEffect(() => {
    setVisibleCount(30);
    setFeedVisibleCount(12);
  }, [query, statusFilter, eraFilter, domainFilter]);

  // Sidebar sentinel
  const loadMore = useCallback(() => {
    setVisibleCount((n) => n + 20);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // Feed sentinel
  const loadMoreFeed = useCallback(() => {
    setFeedVisibleCount((n) => n + 12);
  }, []);

  useEffect(() => {
    const el = feedSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreFeed(); },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMoreFeed, browseMode]);

  const activeItem = list.find((l) => l.id === activeId) || null;
  const title = activeItem?.claim ?? traj?.claim ?? "";

  function renderChart() {
    if ((loadingDetail || listLoading) && !traj) {
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

    // Single-step corpus claim (one ClaimStatusHistory row, typically null → RECORDED).
    // Render a receipt card instead of a degenerate one-dot chart.
    if (t.transitions.length === 1) {
      const only = t.transitions[0];
      const pl = pipelineLabel(traj.ingestedBy);
      return (
        <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: C.panelEdge }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono shrink-0 px-2 py-0.5 rounded" style={{ fontSize: 10, color: STATUS[only.toAxis].c, border: `1px solid ${STATUS[only.toAxis].c}55` }}>
                {STATUS[only.toAxis].label}
              </span>
              <span className="font-mono" style={{ fontSize: 11, color: C.mut }}>{COMMUNITY_LABEL[only.community]}</span>
              <span className="font-mono" style={{ fontSize: 11, color: C.faint }}>{only.occurredAt}</span>
              {pl && (
                <span className="font-mono" style={{ fontSize: 10, color: C.brand, letterSpacing: "0.04em" }}>{pl}</span>
              )}
            </div>
          </div>
          <div className="px-5 pb-5">
            {only.reason && (
              <p className="mt-3 mb-3" style={{ fontSize: 14, color: C.ink, lineHeight: 1.55 }}>{only.reason}</p>
            )}
            {only.source.url ? (
              <a href={only.source.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1" style={{ fontSize: 13, color: C.brand }}>
                {only.source.name}
              </a>
            ) : (
              <span style={{ fontSize: 13, color: C.mut }}>{only.source.name}</span>
            )}
            <p className="mt-4" style={{ fontSize: 12, color: C.faint, lineHeight: 1.55 }}>
              This claim was recorded at a single point in time. The agentic loop builds multi-step trajectories from records like this.
            </p>
          </div>
        </div>
      );
    }

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

        <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
          <button
            type="button"
            onClick={() => setReceiptOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono tracking-widest" style={{ fontSize: 10, color: C.faint }}>
                {selected != null ? "SELECTED RECEIPT" : "KEY RECEIPT"} · {COMMUNITY_LABEL[detail.community]}
              </span>
              <span className="font-mono shrink-0 px-2 py-0.5 rounded" style={{ fontSize: 10, color: STATUS[detail.toAxis].c, border: `1px solid ${STATUS[detail.toAxis].c}55` }}>
                {STATUS[detail.toAxis].label}
              </span>
              <span className="font-mono" style={{ fontSize: 11, color: C.mut }}>{detail.occurredAt}</span>
            </div>
            <span className="font-mono ml-3 shrink-0" style={{ fontSize: 10, color: C.faint }}>
              {receiptOpen ? "▲" : "▼"}
            </span>
          </button>
          {receiptOpen && (
            <div className="px-5 pb-5 border-t" style={{ borderColor: C.panelEdge }}>
              <p className="mt-3 mb-3" style={{ fontSize: 14, color: C.ink }}>{detail.reason}</p>
              {detail.source.url ? (
                <a href={detail.source.url}
                  className="inline-flex items-center gap-1" style={{ fontSize: 13, color: C.brand }}>
                  {detail.source.name}
                </a>
              ) : (
                <span style={{ fontSize: 13, color: C.mut }}>{detail.source.name}</span>
              )}
              <p className="mt-4" style={{ fontSize: 12, color: C.faint }}>
                Each point is a dated source — the receipt for when a community changed its mind. Tap any marker.
              </p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span style={{ fontSize: 11, color: C.faint, fontFamily: "monospace", letterSpacing: "0.06em" }}>EXPORT</span>
                {(["csv", "bibtex", "ris"] as const).map((fmt) => (
                  <a
                    key={fmt}
                    href={`/api/trajectories/${t.id}?format=${fmt}`}
                    className="inline-flex items-center gap-1"
                    style={{ fontSize: 11, color: C.mut, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em", border: `1px solid ${C.panelEdge}`, borderRadius: 4, padding: "2px 7px", textDecoration: "none" }}
                  >
                    {fmt === "csv" ? "CSV" : fmt === "bibtex" ? "BibTeX" : "RIS (Zotero)"}
                    <span aria-hidden style={{ fontSize: 10 }}>↓</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  function renderTransitionLog() {
    if (!traj || traj.transitions.length === 0) return null;
    const sorted = [...traj.transitions].sort((a, b) => frac(a.occurredAt) - frac(b.occurredAt));

    function inheritanceBetween(a: Transition, b: Transition): { label: string; color: string } {
      if (b.toAxis === "REVERSED" || b.toAxis === "ABANDONED") return { label: "OVERTURNED", color: C.red };
      if (b.toAxis === "CONTESTED") return { label: "CONTESTED", color: C.amber };
      if (b.toAxis === "SETTLED") return { label: "RATIFIED", color: C.green };
      if (b.toAxis === a.toAxis) return { label: "CONFIRMED", color: C.green };
      return { label: "CONTINUED", color: C.mut };
    }

    return (
      <div className="mt-5 rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
        <button
          type="button"
          onClick={() => setLogOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3"
        >
          <span className="font-mono tracking-widest" style={{ fontSize: 10, color: C.faint, letterSpacing: "0.08em" }}>
            TRANSITION LOG · {sorted.length} EVENTS
          </span>
          <span className="font-mono" style={{ fontSize: 10, color: C.faint }}>{logOpen ? "▲" : "▼"}</span>
        </button>

        {logOpen && (
          <div className="border-t" style={{ borderColor: C.panelEdge }}>
            {sorted.map((tr, i) => {
              const next = sorted[i + 1];
              const isLast = i === sorted.length - 1;
              const monthsToNext = next
                ? Math.round(Math.abs(frac(next.occurredAt) - frac(tr.occurredAt)) * 12)
                : 0;
              const inherit = next ? inheritanceBetween(tr, next) : null;

              return (
                <div key={i}>
                  <div
                    className="px-5 py-4 flex gap-4"
                    style={{ borderBottom: isLast ? "none" : `1px solid ${C.panelEdge}33` }}
                  >
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center" style={{ width: 24, flexShrink: 0, paddingTop: 2 }}>
                      <div
                        style={{
                          width: 9, height: 9, borderRadius: 9,
                          background: STATUS[tr.toAxis].c,
                          border: `2px solid ${C.bg}`,
                          flexShrink: 0,
                        }}
                      />
                      {!isLast && (
                        <div style={{ width: 1, flex: 1, background: C.panelEdge, marginTop: 4, minHeight: 28 }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span
                          className="font-mono px-1.5 py-0.5 rounded"
                          style={{ fontSize: 9, color: STATUS[tr.toAxis].c, border: `1px solid ${STATUS[tr.toAxis].c}55`, letterSpacing: "0.05em" }}
                        >
                          {tr.fromAxis ? `${tr.fromAxis} → ${tr.toAxis}` : tr.toAxis}
                        </span>
                        <span className="font-mono" style={{ fontSize: 10, color: C.mut }}>{COMMUNITY_LABEL[tr.community]}</span>
                        <span className="font-mono" style={{ fontSize: 10, color: C.faint }}>{tr.occurredAt}</span>
                      </div>

                      {tr.reason && (
                        <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.55, marginBottom: 6 }}>{tr.reason}</p>
                      )}

                      {tr.source.url ? (
                        <a href={tr.source.url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: C.brand, textDecoration: "underline" }}>
                          {tr.source.name}
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: C.mut }}>{tr.source.name}</span>
                      )}
                    </div>
                  </div>

                  {/* Inheritance connector */}
                  {!isLast && inherit && (
                    <div
                      className="flex items-center gap-3 px-5 py-1.5"
                      style={{ background: `${C.panelEdge}18` }}
                    >
                      <div style={{ width: 24, flexShrink: 0 }} />
                      <span
                        className="font-mono"
                        style={{ fontSize: 9, color: inherit.color, letterSpacing: "0.08em" }}
                      >
                        ↓ {inherit.label}
                      </span>
                      {monthsToNext > 0 && (
                        <span className="font-mono" style={{ fontSize: 9, color: C.faint }}>
                          {monthsToNext < 18
                            ? `${monthsToNext} month${monthsToNext === 1 ? "" : "s"} later`
                            : `${Math.round(monthsToNext / 12)} year${Math.round(monthsToNext / 12) === 1 ? "" : "s"} later`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const visibleList = filteredList.slice(0, visibleCount);
  const hasMore = visibleCount < filteredList.length;

  const erasInList = ERA_ORDER.filter((era) =>
    visibleList.some((x) => (x.era ?? "Unknown") === era)
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
            className="w-full px-3 py-2 mb-2 rounded outline-none"
            style={{
              background: C.bg,
              border: `1px solid ${C.panelEdge}`,
              color: C.ink,
              fontSize: 13,
            }}
          />

          <div className="flex items-center justify-between mb-3">
            <span className="font-mono" style={{ fontSize: 9.5, color: C.faint, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Showing curated trajectories
            </span>
          </div>

          {/* Collapsible: Status */}
          <div className="border-t" style={{ borderColor: C.panelEdge, marginTop: 2 }}>
            <button
              type="button"
              onClick={() => setFilterOpen((s) => ({ ...s, status: !s.status }))}
              className="w-full flex items-center justify-between px-0 py-2 font-mono"
              style={{ fontSize: 10, color: statusFilter !== "ALL" ? C.brand : C.faint, letterSpacing: "0.07em", textTransform: "uppercase" }}
            >
              <span>Status{statusFilter !== "ALL" && <span style={{ color: C.brand }}> · {statusFilter}</span>}</span>
              <span style={{ fontSize: 11, color: C.faint }}>{filterOpen.status ? "▲" : "▼"}</span>
            </button>
            {filterOpen.status && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {STATUS_FILTERS.map((f) => {
                  const on = statusFilter === f.key;
                  return (
                    <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)}
                      className="font-mono rounded-full px-2.5 py-1"
                      style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase",
                        background: on ? `${f.color}22` : "transparent",
                        border: `1px solid ${on ? f.color : C.panelEdge}`,
                        color: on ? f.color : C.mut }}>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collapsible: Era */}
          <div className="border-t" style={{ borderColor: C.panelEdge }}>
            <button
              type="button"
              onClick={() => setFilterOpen((s) => ({ ...s, era: !s.era }))}
              className="w-full flex items-center justify-between px-0 py-2 font-mono"
              style={{ fontSize: 10, color: eraFilter !== "ALL" ? C.brand : C.faint, letterSpacing: "0.07em", textTransform: "uppercase" }}
            >
              <span>Era{eraFilter !== "ALL" && <span style={{ color: C.brand }}> · {ERA_FILTERS.find(f => f.key === eraFilter)?.label ?? eraFilter}</span>}</span>
              <span style={{ fontSize: 11, color: C.faint }}>{filterOpen.era ? "▲" : "▼"}</span>
            </button>
            {filterOpen.era && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {ERA_FILTERS.map((f) => {
                  const on = eraFilter === f.key;
                  return (
                    <button key={f.key} type="button" onClick={() => setEraFilter(f.key)}
                      className="font-mono rounded-full px-2.5 py-1"
                      style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase",
                        background: on ? `${C.brand}22` : "transparent",
                        border: `1px solid ${on ? C.brand : C.panelEdge}`,
                        color: on ? C.brand : C.mut }}>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collapsible: Domain */}
          <div className="border-t" style={{ borderColor: C.panelEdge }}>
            <button
              type="button"
              onClick={() => setFilterOpen((s) => ({ ...s, domain: !s.domain }))}
              className="w-full flex items-center justify-between px-0 py-2 font-mono"
              style={{ fontSize: 10, color: domainFilter !== "ALL" ? "#38bdf8" : C.faint, letterSpacing: "0.07em", textTransform: "uppercase" }}
            >
              <span>Domain{domainFilter !== "ALL" && <span style={{ color: "#38bdf8" }}> · {domainFilter}</span>}</span>
              <span style={{ fontSize: 11, color: C.faint }}>{filterOpen.domain ? "▲" : "▼"}</span>
            </button>
            {filterOpen.domain && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {[
                  { key: "ALL", label: "All", emoji: "" },
                  { key: "history", label: "History", emoji: "🌊" },
                  { key: "medicine", label: "Medicine", emoji: "💊" },
                  { key: "astronomy", label: "Astronomy", emoji: "🔭" },
                  { key: "climate", label: "Climate", emoji: "🌍" },
                  { key: "nutrition", label: "Nutrition", emoji: "🥗" },
                ].filter((d) => d.key === "ALL" || list.some((x) => (x.domain ?? "history") === d.key)).map((d) => {
                  const on = domainFilter === d.key;
                  return (
                    <button key={d.key} type="button"
                      onClick={() => { setDomainFilter(d.key); if (d.key !== "ALL") setBrowseMode(true); else setBrowseMode(false); }}
                      className="rounded-full px-2.5 py-1"
                      style={{ fontSize: 10, letterSpacing: "0.04em",
                        background: on ? "#38bdf822" : "transparent",
                        border: `1px solid ${on ? "#38bdf8" : C.panelEdge}`,
                        color: on ? "#38bdf8" : C.mut }}>
                      {d.emoji ? `${d.emoji} ${d.label}` : d.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3" style={{ background: C.bg, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
          {filteredList.length === 0 ? (
            <div className="px-3 py-6 text-center" style={{ color: C.mut, fontSize: 12 }}>
              No trajectories match these filters.
            </div>
          ) : (
            erasInList.map((era) => {
              const items = visibleList.filter((x) => (x.era ?? "Unknown") === era);
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
          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
          )}
          {!hasMore && filteredList.length > 0 && (
            <div className="px-3 py-4 text-center font-mono" style={{ color: C.faint, fontSize: 10, letterSpacing: "0.06em" }}>
              {filteredList.length} RECEIPTS
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderFeed() {
    const feedItems = filteredList.slice(0, feedVisibleCount);
    const feedHasMore = feedVisibleCount < filteredList.length;
    const domainLabel = domainFilter === "ALL" ? "All" : domainFilter.charAt(0).toUpperCase() + domainFilter.slice(1);

    return (
      <div>
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="font-semibold tracking-tight" style={{ fontSize: 26, lineHeight: 1.15 }}>
              {domainLabel} receipts
            </h1>
            <p className="font-mono mt-1" style={{ fontSize: 11, color: C.mut, letterSpacing: "0.05em" }}>
              {filteredList.length} TRAJECTORIES · CLICK ANY TO AUDIT
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setBrowseMode(false); }}
            className="font-mono rounded px-3 py-1.5"
            style={{ fontSize: 11, color: C.mut, border: `1px solid ${C.panelEdge}`, letterSpacing: "0.05em" }}
          >
            ← DETAIL VIEW
          </button>
        </div>

        <div className="space-y-4">
          {feedItems.map((item) => {
            const dot = axisDotColor(item);
            const axisLabel = item.currentAxis ? (STATUS[item.currentAxis]?.label ?? item.currentAxis) : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectItem(item.id)}
                className="w-full text-left rounded-lg sc-anim"
                style={{
                  background: C.panel,
                  border: `1px solid ${C.panelEdge}`,
                  padding: "16px 20px",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.brand + "66"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.panelEdge; }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className="shrink-0 mt-1.5"
                    style={{ width: 9, height: 9, borderRadius: 9, background: dot, boxShadow: `0 0 0 2px ${C.bg}`, display: "inline-block" }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="leading-snug" style={{ fontSize: 15, color: C.ink, fontWeight: 500 }}>
                      {truncate(item.claim, 180)}
                    </p>
                    <div className="font-mono flex flex-wrap items-center gap-x-3 gap-y-1 mt-2" style={{ fontSize: 10.5, color: C.faint }}>
                      {item.era && <span style={{ color: C.mut }}>{item.era}</span>}
                      <span>{item.transitionCount ?? 0} transitions</span>
                      {item.firstYear != null && item.lastYear != null && (
                        <span>{item.firstYear}{item.firstYear !== item.lastYear && `–${item.lastYear}`}</span>
                      )}
                      {axisLabel && (
                        <span
                          className="px-1.5 py-px rounded"
                          style={{
                            color: item.currentAxis ? STATUS[item.currentAxis].c : C.mut,
                            border: `1px solid ${item.currentAxis ? STATUS[item.currentAxis].c + "55" : C.panelEdge}`,
                          }}
                        >
                          {axisLabel}
                        </span>
                      )}
                      {item.hasReversal && <span style={{ color: C.red }}>↩ reversed</span>}
                    </div>
                  </div>
                </div>
                {item.milestones && item.milestones.length > 0 && (
                  <div style={{ marginLeft: 20 }}>
                    <SettlingCurveMini
                      milestones={item.milestones}
                      animate={false}
                      ariaLabel={`Preview for: ${item.claim}`}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {feedHasMore && <div ref={feedSentinelRef} style={{ height: 1 }} aria-hidden />}
        {!feedHasMore && filteredList.length > 0 && (
          <div className="py-8 text-center font-mono" style={{ color: C.faint, fontSize: 10, letterSpacing: "0.06em" }}>
            {filteredList.length} RECEIPTS · END OF RESULTS
          </div>
        )}
      </div>
    );
  }

  function renderStorySummary() {
    if (!traj || traj.transitions.length < 2) return null;
    const sorted = [...traj.transitions].sort((a, b) => frac(a.occurredAt) - frac(b.occurredAt));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const interval = keyInterval(traj);
    const dur = durationLabel(interval.from.occurredAt, interval.to.occurredAt);
    const communities = [...new Set(sorted.map((t) => t.community))];
    const statuses = [...new Set(sorted.map((t) => t.toAxis))];
    const hasReversal = sorted.some((t) => t.toAxis === "REVERSED");
    const hasContested = sorted.some((t) => t.toAxis === "CONTESTED");

    const storyParts: string[] = [];
    storyParts.push(
      `This trajectory spans ${dur.n} ${dur.unit} (${yr(first.occurredAt)}–${yr(last.occurredAt)}), with ${sorted.length} documented transitions across ${communities.length} ${communities.length === 1 ? "community" : "communities"}: ${communities.map((c) => COMMUNITY_LABEL[c]).join(", ")}.`
    );

    if (first.reason) {
      storyParts.push(`It begins when ${first.reason.charAt(0).toLowerCase()}${first.reason.slice(1)}${first.reason.endsWith(".") ? "" : "."}`);
    }

    if (hasReversal) {
      const rev = sorted.find((t) => t.toAxis === "REVERSED")!;
      storyParts.push(`A reversal occurred in ${yr(rev.occurredAt)}${rev.reason ? `: ${rev.reason}` : "."}`);
    } else if (hasContested) {
      const cont = sorted.find((t) => t.toAxis === "CONTESTED")!;
      storyParts.push(`The claim became contested in ${yr(cont.occurredAt)}${cont.reason ? `: ${cont.reason}` : "."}`);
    }

    if (last.toAxis === "SETTLED" && last.reason) {
      storyParts.push(`It ultimately settled: ${last.reason}`);
    }

    const keyTransitions = sorted.filter((t) => t.reason && t.reason.length > 40).slice(0, 6);

    return (
      <div className="rounded-lg overflow-hidden mb-5 mt-5" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: C.panelEdge }}>
          <span className="font-mono tracking-widest" style={{ fontSize: 10, color: C.brand, letterSpacing: "0.08em" }}>
            STORY SUMMARY
          </span>
        </div>
        {/* Reading mode uses the collapsed sidebar's width: story prose left,
            dated key-moment receipts as a timeline rail right (stacks on
            small screens). */}
        <div
          className="px-5 py-4 lg:grid lg:gap-8"
          style={{ gridTemplateColumns: keyTransitions.length > 0 ? "minmax(0, 1fr) 340px" : undefined }}
        >
          <div>
            {storyParts.map((p, i) => (
              <p key={i} className="mb-2" style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>{p}</p>
            ))}
            <div className="mt-4 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: C.panelEdge }}>
              {statuses.map((s) => (
                <span key={s} className="font-mono px-2 py-0.5 rounded" style={{ fontSize: 9, color: STATUS[s].c, border: `1px solid ${STATUS[s].c}44`, letterSpacing: "0.04em" }}>
                  {STATUS[s].label}
                </span>
              ))}
            </div>
          </div>

          {keyTransitions.length > 0 && (
            <div className="mt-4 pt-4 border-t lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-6" style={{ borderColor: C.panelEdge }}>
              <span className="font-mono tracking-widest block mb-3" style={{ fontSize: 9, color: C.faint, letterSpacing: "0.08em" }}>
                KEY MOMENTS
              </span>
              <div className="space-y-3">
                {keyTransitions.map((t, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="shrink-0 flex flex-col items-center" style={{ width: 20, paddingTop: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 8, background: STATUS[t.toAxis].c, display: "block" }} />
                      {i < keyTransitions.length - 1 && <div style={{ width: 1, flex: 1, background: C.panelEdge, marginTop: 4, minHeight: 16 }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono" style={{ fontSize: 10, color: STATUS[t.toAxis].c }}>{STATUS[t.toAxis].label}</span>
                        <span className="font-mono" style={{ fontSize: 10, color: C.faint }}>{yr(t.occurredAt)} · {COMMUNITY_LABEL[t.community]}</span>
                      </div>
                      <p style={{ fontSize: 13, color: C.mut, lineHeight: 1.5 }}>{t.reason}</p>
                      {t.source.url ? (
                        <a href={t.source.url} style={{ fontSize: 11, color: C.brand }}>{t.source.name}</a>
                      ) : (
                        <span style={{ fontSize: 11, color: C.faint }}>{t.source.name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // Reading-mode footer: 3 related trajectories (same domain, then same era)
  // drawn from the already-loaded curated list. Deterministic picks.
  function renderRelated() {
    if (!activeItem || list.length === 0) return null;
    const pool = list.filter((x) => x.id !== activeItem.id);
    const sameDomain = pool.filter((x) => x.domain && x.domain === activeItem.domain);
    const sameEra = pool.filter((x) => x.era && x.era === activeItem.era && !sameDomain.includes(x));
    const picks = [...sameDomain, ...sameEra, ...pool].slice(0, 3);
    if (picks.length === 0) return null;

    return (
      <div className="mt-8">
        <span className="font-mono tracking-widest block mb-3" style={{ fontSize: 10, color: C.faint, letterSpacing: "0.08em" }}>
          RELATED TRAJECTORIES
        </span>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {picks.map((it) => {
            const axis = it.currentAxis && STATUS[it.currentAxis] ? STATUS[it.currentAxis] : null;
            return (
              <Link
                key={it.id}
                href={`/settling-curve?t=${encodeURIComponent(it.id)}`}
                className="block rounded-lg p-4 transition-colors group"
                style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono" style={{ fontSize: 10, color: axis?.c ?? C.faint }}>
                    {axis ? `● ${axis.label}` : it.era ?? ""}
                  </span>
                  <span className="font-mono" style={{ fontSize: 10, color: C.faint }}>
                    {it.firstYear ?? ""}{it.lastYear != null && it.lastYear !== it.firstYear ? ` → ${it.lastYear}` : ""}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.45, minHeight: 36 }}>
                  {it.claim.length > 110 ? it.claim.slice(0, 107) + "…" : it.claim}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono" style={{ fontSize: 10, color: C.mut }}>
                    {it.transitionCount ?? "—"} transitions
                  </span>
                  <span className="font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 11, color: C.brand }}>
                    view →
                  </span>
                </div>
              </Link>
            );
          })}
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

      {/* Tab nav inside full-bleed wrapper so -2rem marginTop doesn't overlap it */}
      <SettlingCurveNav active="individual" />

      <div
        className="flex"
        style={{ minHeight: "calc(100vh - 140px)" }}
      >
        {/* Sidebar (desktop sticky, mobile drawer) */}
        <aside
          className="hidden md:flex md:flex-col md:sticky shrink-0 z-30 sc-anim"
          style={{
            width: sidebarOpen ? "min(35%, 380px)" : 0,
            minWidth: sidebarOpen ? 280 : 0,
            top: 48,
            height: "calc(100vh - 48px)",
            borderRight: sidebarOpen ? `1px solid ${C.panelEdge}` : "none",
            background: C.panel,
            overflow: "hidden",
            transition: "width 0.25s ease, min-width 0.25s ease",
          }}
        >
          {renderSidebar()}
        </aside>

        {/* Sidebar toggle button (desktop) */}
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="hidden md:flex items-center justify-center sticky z-30 sc-anim"
          style={{
            top: 48,
            height: "calc(100vh - 48px)",
            width: 20,
            background: C.panel,
            borderRight: `1px solid ${C.panelEdge}`,
            color: C.faint,
            fontSize: 12,
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.panelEdge; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = C.panel; }}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? "◀" : "▶"}
        </button>

        {/* Mobile drawer overlay — only covers area above the drawer (bottom 80vh excluded) */}
        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed left-0 right-0 top-0 z-40"
            style={{ bottom: "80vh", background: "rgba(0,0,0,0.6)" }}
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

        {/* Right panel. With the sidebar open the column sits beside it; when
            collapsed (reading mode) it recenters and widens into the freed
            space instead of leaving a dead right half. */}
        <main className="flex-1 min-w-0">
          <div className={`px-5 md:px-8 py-6 mx-auto ${sidebarOpen ? "max-w-5xl" : "max-w-6xl"}`}>
            {browseMode ? renderFeed() : (<>

            {/* Chart header */}
            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
              <div className="flex-1 min-w-0" style={{ minWidth: 260 }}>
                <h1
                  className="font-semibold tracking-tight mb-1"
                  style={{ fontSize: 26, lineHeight: 1.15 }}
                >
                  {title || (loadingDetail || listLoading ? "" : "Select a trajectory")}
                </h1>
                {traj && traj.transitions.length > 0 && (() => {
                  const years = traj.transitions.map((x) => yr(x.occurredAt));
                  const first = Math.min(...years);
                  const last = Math.max(...years);
                  const yearRange = last - first;
                  const shareText = `I traced the ${yearRange > 0 ? `${yearRange}-year ` : ""}epistemic journey of "${title.slice(0, 160)}". ${traj.transitions.length} transitions${yearRange > 0 ? ` (${first}–${last})` : ""}. 🧾`;
                  return (
                    <>
                      <p
                        className="font-mono"
                        style={{ fontSize: 12, color: C.mut, letterSpacing: "0.04em" }}
                      >
                        {traj.transitions.length} TRANSITIONS · {first}
                        {first !== last && ` → ${last}`}
                        {activeItem?.era && ` · ${activeItem.era.toUpperCase()}`}
                        {traj.ingestedBy && (
                          <span style={{ color: C.faint }}> · {pipelineLabel(traj.ingestedBy)}</span>
                        )}
                      </p>
                      <div className="mt-2">
                        <ShareButtons
                          url={typeof window !== "undefined" ? window.location.href : ""}
                          text={shareText}
                          imageCardUrl={activeId ? `/api/og/trajectory?id=${activeId}` : undefined}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
              {headerInterval && headerDur && headerDur.n > 0 && (
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

            {/* Reading mode (sidebar collapsed): the chart pins to the top and
                the story/receipts scroll beneath it, so transitions stay
                visually anchored to their dots while reading. */}
            <div
              className={!sidebarOpen ? "lg:sticky lg:top-0 lg:z-20" : undefined}
              style={!sidebarOpen ? { background: C.bg } : undefined}
            >
              {renderChart()}
            </div>

            {/* Story summary + receipts rail — shown when sidebar is collapsed */}
            {!sidebarOpen && renderStorySummary()}

            {/* Transition log — knowledge inheritance view */}
            {renderTransitionLog()}

            {/* Related trajectories — reading-mode footer, same domain/era */}
            {!sidebarOpen && renderRelated()}

            {/* Footnote — methodology link, unobtrusive */}
            <p className="mt-8 font-mono" style={{ fontSize: 10, color: C.faint, letterSpacing: "0.04em" }}>
              Trajectories generated by an agentic loop.{" "}
              <a
                href="https://github.com/contofalskyR/epistemic-receipts/blob/main/scripts/loop-settling-curve.sh"
                target="_blank"
                rel="noreferrer"
                style={{ color: C.mut, textDecoration: "underline" }}
              >
                How it works →
              </a>
              <span style={{ margin: "0 8px", color: C.faint }}>·</span>
              <a
                href="/labs/claim-diff"
                data-no-viewer="1"
                style={{ color: C.mut, textDecoration: "underline" }}
              >
                Labs ↗
              </a>
            </p>
            </>)}
          </div>
        </main>
      </div>

      {/* Mobile floating button */}
      <button
        type="button"
        onClick={() => listError ? setRetryKey(k => k + 1) : setDrawerOpen(true)}
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
        {listLoading ? "Loading Trajectories…" : listError ? "Retry Loading Trajectories" : `Browse Trajectories (${filteredList.length})`}
      </button>
      {listError && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#1a0a0a", border: "1px solid #f43f5e", borderRadius: 8, padding: "10px 16px", fontSize: 12, color: "#f43f5e", zIndex: 200, whiteSpace: "nowrap" }}>
          Failed to load trajectories.{" "}
          <button onClick={() => setRetryKey(k => k + 1)} style={{ color: C.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
            Tap to retry
          </button>
        </div>
      )}
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
