"use client";
import React, { useState, useEffect, Suspense, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SettlingCurveMini from "../components/SettlingCurveMini";
import { ShareButtons } from "@/components/ShareButtons";
import SettlingCurveNav from "./SettlingCurveNav";
import { AXIS_COLOR } from "@/lib/status";
import { EpistemicLegend } from "@/components/EpistemicLegend";

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
  ingestedBy?: string | null;
}

interface Transition {
  id?: string;
  /** Explicit chain order (1..n per claim); null/absent on unbackfilled rows. */
  seq?: number | null;
  fromAxis?: string | null;
  toAxis: Axis;
  community: Community;
  occurredAt: string;
  datePrecision?: string | null;
  reason: string | null;
  source: TransitionSource;
}

// ── Provenance — who wrote this receipt? Derived from the row-id conventions
// each writer uses (deterministic slugs, curated csh:/trajectory: ids,
// :retraction: rows, Layer-1 cuids) + the marker source's pipeline tag.
// Radical transparency: every dot on a curve says where it came from.
const SLUG_ROW_RE = /-(RECORDED|SETTLED|CONTESTED|OPEN|UNRESOLVABLE|REVERSED|ABANDONED)-\d{4}-\d{2}-\d{2}$/;

function provenanceOf(t: Transition): { label: string; title: string } {
  const id = t.id ?? "";
  const srcTag = t.source?.ingestedBy ?? "";
  if (id.startsWith("csh:") || id.startsWith("trajectory:") || id.includes(":trajectory:"))
    return { label: "curated", title: `Hand-owned seed / agentic research loop with human-owned seed files.\nrow: ${id}` };
  if (id.includes(":retraction:"))
    return { label: "retraction records", title: `Built from CrossRef/Retraction Watch retraction data.\nrow: ${id}` };
  if (SLUG_ROW_RE.test(id)) {
    if (srcTag.startsWith("event:"))
      return { label: "event feed", title: `Deterministic event pipeline (${srcTag.replace(/^event:/, "").replace(/_v\d+$/, "")}) — joined from a published institutional feed.\nrow: ${id}` };
    return { label: "pipeline", title: `Deterministic bulk/promoter pipeline write (verified source URL, preflight-gated).\nrow: ${id}` };
  }
  return { label: "auto baseline", title: `Layer-1 template baseline generated from the claim's ingest record.\nrow: ${id || "(id not exposed)"}` };
}

function flagHref(claimId: string | null, t: Transition): string {
  const params = new URLSearchParams();
  if (claimId) params.set("claim", claimId);
  if (t.id) params.set("transition", t.id);
  params.set("date", t.occurredAt);
  return `/corrections?${params.toString()}`;
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
  RECORDED:     { c: AXIS_COLOR["RECORDED"],     label: "Recorded" },
  SETTLED:      { c: AXIS_COLOR["SETTLED"],      label: "Settled" },
  CONTESTED:    { c: AXIS_COLOR["CONTESTED"],    label: "Contested" },
  OPEN:         { c: AXIS_COLOR["OPEN"],         label: "Open" },
  UNRESOLVABLE: { c: AXIS_COLOR["UNRESOLVABLE"], label: "Unresolvable" },
  REVERSED:     { c: AXIS_COLOR["REVERSED"],     label: "Reversed" },
  ABANDONED:    { c: AXIS_COLOR["ABANDONED"],    label: "Abandoned" },
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

// Chain order (ORDERING-SEMANTICS-2026-07-08.md): explicit seq wins; date is
// the fallback for unbackfilled legacy rows. X-POSITIONS still come from
// frac(date) — when a coarse YEAR date makes a later-in-chain dot sit left of
// its predecessor, the connector visibly doubles back. That's honest: the
// data really is that coarse; we order by the ledger, we plot by the date.
function chainOrder(
  a: { seq?: number | null; occurredAt: string },
  b: { seq?: number | null; occurredAt: string },
) {
  return (
    (a.seq ?? Infinity) - (b.seq ?? Infinity) ||
    new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
}

function keyInterval(t: { transitions: Transition[] }) {
  const sorted = [...t.transitions].sort(chainOrder);
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
  // Initialized from the URL so deep links open straight into the detail view
  // without a landing-grid flash.
  const [activeId, setActiveId] = useState<string | null>(() => searchParams.get("t"));
  const [traj, setTraj] = useState<TrajectoryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [eraFilter, setEraFilter] = useState<string>("ALL");
  const [domainFilter, setDomainFilter] = useState<string>("ALL");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState({ status: true, era: false, domain: false });
  const [receiptOpen, setReceiptOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(30);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [gridVisibleCount, setGridVisibleCount] = useState(24);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // No deep link → the landing grid (like /legislation's front). A ?t= id —
  // curated slug or raw claim CUID alike — opens the explorer detail view.
  const landing = activeId === null;

  // Fetch the list once (retryKey re-runs after errors) — NOT on every
  // searchParams change; card clicks only move the ?t= param.
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
      })
      .catch(() => {
        if (!cancelled) { setListLoading(false); setListError(true); setLoadingDetail(false); }
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  // Sync the open trajectory with the URL (deep links, card clicks via
  // history.pushState, and browser back/forward all land here).
  useEffect(() => {
    const deep = searchParams.get("t");
    if (deep) {
      setActiveId(deep);
    } else {
      setActiveId(null);
      setTraj(null);
      setSelected(null);
      setLoadingDetail(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingDetail(true);
    setTraj(null);
    setSelected(null);
    setTitleExpanded(false);
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
    // Shallow URL update — keeps curve URLs shareable and browser-back working
    // (Next syncs useSearchParams with native history).
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/settling-curve?t=${encodeURIComponent(id)}`);
    }
  };

  const backToAll = () => {
    setActiveId(null);
    setTraj(null);
    setSelected(null);
    setTitleExpanded(false);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/settling-curve");
    }
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
    setGridVisibleCount(24);
  }, [query, statusFilter, eraFilter, domainFilter]);

  // Sidebar sentinel (detail view only — the landing grid uses an explicit
  // Load-more button instead of infinite scroll)
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

  const activeItem = list.find((l) => l.id === activeId) || null;
  const [titleExpanded, setTitleExpanded] = useState(false);
  // Prefer the detail payload's FULL text — the list API truncates at 160 chars
  // and previously won this fallback chain, leaving long titles permanently
  // stuck at "…" with no way to read them (2026-07-08 smoke tour finding).
  const title = traj?.claim ?? activeItem?.claim ?? "";
  const TITLE_CLAMP = 180;
  const titleNeedsToggle = title.length > TITLE_CLAMP;
  const displayTitle = titleNeedsToggle && !titleExpanded ? truncate(title, TITLE_CLAMP) : title;

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

    // Single-step claim: still a settling curve — one dot on its community
    // lane, then a dashed dormant line to today. A flat curve says something
    // true: nothing has moved yet. Receipt card below carries the source.
    if (t.transitions.length === 1) {
      const only = t.transitions[0];
      const pl = pipelineLabel(traj.ingestedBy);

      const nowDate = new Date();
      const nowFrac = nowDate.getUTCFullYear() + nowDate.getUTCMonth() / 12;
      const evFrac = frac(only.occurredAt);
      const minY = Math.floor(Math.min(evFrac, nowFrac) - 2);
      const maxY = Math.ceil(Math.max(evFrac, nowFrac) + 1);
      const W = 920, padL = 132, padR = 60, padTop = 84, laneH = 54, axisH = 46;
      const H = padTop + laneH + axisH;
      const x = (yv: number) => padL + ((yv - minY) / (maxY - minY)) * (W - padL - padR);
      const laneY = padTop + laneH / 2;

      // Adaptive ticks — a 1,700-year dormancy must not draw 170 decade labels.
      const span = Math.max(maxY - minY, 1);
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(span / 8, 1))));
      const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= 10) ?? 10 * mag;
      const ticks: number[] = [];
      for (let v = Math.ceil(minY / step) * step; v <= maxY; v += step) ticks.push(v);

      const dormantYears = Math.floor(nowFrac - evFrac);
      const dormantLabel =
        nowFrac > evFrac
          ? `${dormantYears >= 1 ? `${dormantYears.toLocaleString()} yr${dormantYears === 1 ? "" : "s"}` : "<1 yr"} · no new activity`
          : null;
      const segPx = x(nowFrac) - x(evFrac);

      return (
        <>
        <div className="rounded-lg p-2 mb-5" style={{ background: C.panel, border: `1px solid ${C.panelEdge}` }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", height: "auto" }} role="img"
            aria-label={`Single-point settling curve for: ${t.claim}`}>
            <line x1={padL} x2={W - padR} y1={laneY} y2={laneY} stroke={C.panelEdge} strokeWidth={1} />
            <text x={14} y={laneY - 5} fontFamily="ui-monospace, monospace" fontSize={11.5} fill={C.ink} fontWeight="600">
              {COMMUNITY_LABEL[only.community]}
            </text>
            <text x={14} y={laneY + 11} fontFamily="ui-monospace, monospace" fontSize={9.5} fill={C.faint}>
              1 marker
            </text>

            {dormantLabel && (
              <g>
                <line x1={x(evFrac)} x2={x(nowFrac)} y1={laneY} y2={laneY}
                  stroke={C.mut} strokeWidth={1.5} strokeDasharray="4 5" strokeOpacity={0.6} />
                <line x1={x(nowFrac)} x2={x(nowFrac)} y1={padTop - 10} y2={H - axisH}
                  stroke={C.brand} strokeOpacity={0.35} />
                <circle cx={x(nowFrac)} cy={laneY} r={4} fill={C.brand} />
                <text x={x(nowFrac)} y={padTop - 18} textAnchor="middle"
                  fontFamily="ui-monospace, monospace" fontSize={10} fill={C.brand}>
                  today
                </text>
                {segPx > 220 && (
                  <g>
                    <rect x={(x(evFrac) + x(nowFrac)) / 2 - 95} y={laneY - 36} width={190} height={20} rx={10}
                      fill="rgba(212,168,83,0.08)" stroke={C.brand} strokeOpacity={0.5} />
                    <text x={(x(evFrac) + x(nowFrac)) / 2} y={laneY - 22} textAnchor="middle"
                      fontFamily="ui-monospace, monospace" fontSize={10.5} fill={C.brand}>
                      {dormantLabel}
                    </text>
                  </g>
                )}
              </g>
            )}

            <circle cx={x(evFrac)} cy={laneY} r={7} fill={STATUS[only.toAxis].c} stroke={C.bg} strokeWidth={2} />
            <text x={x(evFrac)} y={laneY + 26} textAnchor="middle"
              fontFamily="ui-monospace, monospace" fontSize={10} fill={C.mut}>
              {yr(only.occurredAt)}
            </text>

            {ticks.map((d) => (
              <g key={d}>
                <line x1={x(d)} x2={x(d)} y1={H - axisH} y2={H - axisH + 5} stroke={C.faint} />
                <text x={x(d)} y={H - axisH + 20} textAnchor="middle"
                  fontFamily="ui-monospace, monospace" fontSize={11} fill={C.faint}>
                  {d}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5">
          <div className="flex items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: 9, background: STATUS[only.toAxis].c, display: "inline-block" }} />
            <span className="font-mono" style={{ fontSize: 11, color: C.mut }}>{STATUS[only.toAxis].label}</span>
          </div>
          {dormantLabel && (
            <div className="flex items-center gap-2">
              <span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.mut}`, display: "inline-block" }} />
              <span className="font-mono" style={{ fontSize: 11, color: C.mut }}>dormant since {yr(only.occurredAt)}</span>
            </div>
          )}
        </div>

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
            <div className="flex items-center gap-3 mt-3">
              <span
                className="font-mono px-1.5 py-px rounded"
                title={provenanceOf(only).title}
                style={{ fontSize: 9, color: C.faint, border: `1px solid ${C.panelEdge}`, letterSpacing: "0.05em", cursor: "help" }}
              >
                {provenanceOf(only).label}
              </span>
              <Link href={flagHref(activeId, only)} className="font-mono" style={{ fontSize: 9, color: C.faint, letterSpacing: "0.05em" }}>
                flag this receipt →
              </Link>
            </div>
            <p className="mt-4" style={{ fontSize: 12, color: C.faint, lineHeight: 1.55 }}>
              A single-point curve is a real claim: nothing has moved yet. When a dated, sourced
              event touches this claim — a repeal, a retraction, an overruling — the loops add the
              next point automatically.
            </p>
          </div>
        </div>
        </>
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
                .sort(chainOrder);
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
              <div className="flex items-center gap-3 mt-3">
                <span
                  className="font-mono px-1.5 py-px rounded"
                  title={provenanceOf(detail).title}
                  style={{ fontSize: 9, color: C.faint, border: `1px solid ${C.panelEdge}`, letterSpacing: "0.05em", cursor: "help" }}
                >
                  {provenanceOf(detail).label}
                </span>
                <Link href={flagHref(activeId, detail)} className="font-mono" style={{ fontSize: 9, color: C.faint, letterSpacing: "0.05em" }}>
                  flag this receipt →
                </Link>
              </div>
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
    const sorted = [...traj.transitions].sort(chainOrder);

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
                      <div className="flex items-center gap-3 mt-2">
                        <span
                          className="font-mono px-1.5 py-px rounded"
                          title={provenanceOf(tr).title}
                          style={{ fontSize: 9, color: C.faint, border: `1px solid ${C.panelEdge}`, letterSpacing: "0.05em", cursor: "help" }}
                        >
                          {provenanceOf(tr).label}
                        </span>
                        <Link
                          href={flagHref(activeId, tr)}
                          className="font-mono"
                          style={{ fontSize: 9, color: C.faint, letterSpacing: "0.05em" }}
                        >
                          flag this receipt →
                        </Link>
                      </div>
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
                      onClick={() => setDomainFilter(d.key)}
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
            listError ? (
              // Previously an API failure rendered as "No trajectories match
              // these filters" on desktop — indistinguishable from an empty
              // filter. Say what happened and offer a retry.
              <div className="px-3 py-6 text-center">
                <p style={{ color: "#f43f5e", fontSize: 12 }} className="mb-3">
                  Couldn&apos;t load trajectories.
                </p>
                <button
                  type="button"
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="px-3 py-1.5 rounded font-mono"
                  style={{ fontSize: 11, color: C.ink, border: `1px solid ${C.panelEdge}` }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="px-3 py-6 text-center" style={{ color: C.mut, fontSize: 12 }}>
                {listLoading ? "Loading trajectories…" : "No trajectories match these filters."}
              </div>
            )
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

  // Landing — /legislation-style front page: headline, explainer, filter
  // chips, and a card grid. The explorer detail view opens on ?t= only.
  function renderLanding() {
    const gridItems = filteredList.slice(0, gridVisibleCount);
    const gridHasMore = gridVisibleCount < filteredList.length;
    const domainsInList = ["ALL", ...Array.from(new Set(list.map((i) => i.domain ?? "history"))).sort()];

    const chip = (on: boolean, color: string) => ({
      fontSize: 10,
      letterSpacing: "0.05em",
      textTransform: "uppercase" as const,
      background: on ? `${color}22` : "transparent",
      border: `1px solid ${on ? color : C.panelEdge}`,
      color: on ? color : C.mut,
    });

    return (
      <div>
        <header className="mb-6">
          <h1 className="font-semibold tracking-tight" style={{ fontSize: 28, lineHeight: 1.15 }}>
            Settling curves
          </h1>
          <p className="mt-2" style={{ fontSize: 14, color: C.mut, lineHeight: 1.6, maxWidth: 760 }}>
            Trace how confidence in a claim builds — or unravels — across expert literature,
            institutions, courts, and the public. Every curve is receipt-by-receipt: each point is a
            dated, sourced transition. Open one to audit it.
          </p>
          <p className="font-mono mt-2" style={{ fontSize: 11, color: C.faint, letterSpacing: "0.05em" }}>
            {listLoading ? "LOADING TRAJECTORIES…" : `${filteredList.length} CURATED TRAJECTORIES`}
          </p>
          <div className="mt-3">
            <EpistemicLegend label="Axis key:" />
          </div>
        </header>

        {/* Filters — one compact row instead of a sidebar */}
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trajectories…"
            className="px-3 py-1.5 rounded outline-none"
            style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, color: C.ink, fontSize: 13, minWidth: 220 }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)}
                className="font-mono rounded-full px-2.5 py-1" style={chip(statusFilter === f.key, f.color)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ERA_FILTERS.map((f) => (
              <button key={f.key} type="button" onClick={() => setEraFilter(f.key)}
                className="font-mono rounded-full px-2.5 py-1" style={chip(eraFilter === f.key, C.brand)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {domainsInList.map((d) => (
              <button key={d} type="button" onClick={() => setDomainFilter(d)}
                className="font-mono rounded-full px-2.5 py-1" style={chip(domainFilter === d, "#38bdf8")}>
                {d === "ALL" ? "All domains" : d}
              </button>
            ))}
          </div>
        </div>

        {/* Reversals showcase — the claims the world took back. Longest-held
            beliefs that flipped, drawn from the same list the grid uses, so
            every new reversal the pipelines create competes for a spot. Hidden
            once the visitor starts filtering/searching (the grid takes over). */}
        {statusFilter === "ALL" && !query.trim() && (() => {
          const showcase = filteredList
            .filter((i) => i.hasReversal && (i.transitionCount ?? 0) >= 2)
            .sort((a, b) => {
              const spanA = (a.lastYear ?? 0) - (a.firstYear ?? 0);
              const spanB = (b.lastYear ?? 0) - (b.firstYear ?? 0);
              return spanB - spanA || (b.transitionCount ?? 0) - (a.transitionCount ?? 0);
            })
            .slice(0, 3);
          if (showcase.length === 0) return null;
          return (
            <div className="mb-8">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="font-semibold" style={{ fontSize: 16, color: C.ink }}>
                  <span style={{ color: C.red }}>↩</span> Reversals
                </h2>
                <span style={{ fontSize: 12, color: C.mut }}>
                  claims the world took back — held longest, overturned anyway
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("REVERSED")}
                  className="font-mono ml-auto"
                  style={{ fontSize: 11, color: C.red, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.04em" }}
                >
                  all reversals →
                </button>
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                {showcase.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item.id)}
                    className="text-left rounded-lg sc-anim"
                    style={{
                      background: C.panel,
                      border: `1px solid ${C.red}44`,
                      borderLeft: `3px solid ${C.red}`,
                      padding: "14px 16px",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.red; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${C.red}44`; }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono" style={{ fontSize: 10, color: C.faint }}>
                        {item.firstYear ?? ""}
                        {item.lastYear != null && item.lastYear !== item.firstYear ? ` → ${item.lastYear}` : ""}
                      </span>
                      <span className="font-mono" style={{ fontSize: 10, color: C.red }}>
                        held {Math.max(0, (item.lastYear ?? 0) - (item.firstYear ?? 0))} yrs
                      </span>
                    </div>
                    <p className="leading-snug mb-3" style={{ fontSize: 13, color: C.ink, minHeight: 51 }}>
                      {truncate(item.claim, 120)}
                    </p>
                    {item.milestones && item.milestones.length > 0 && (
                      <SettlingCurveMini
                        milestones={item.milestones}
                        animate={false}
                        ariaLabel={`Reversal curve: ${item.claim}`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {listError && (
          <div className="rounded-lg p-5 mb-6" style={{ background: C.panel, border: "1px solid #f43f5e" }}>
            <span style={{ fontSize: 13, color: "#f43f5e" }}>Failed to load trajectories. </span>
            <button onClick={() => setRetryKey((k) => k + 1)}
              style={{ color: C.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              Tap to retry
            </button>
          </div>
        )}

        {/* Card grid — /legislation's DomainCurveRail pattern */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {listLoading
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={i} aria-hidden className="rounded-lg" style={{
                  height: 190, background: "linear-gradient(90deg,#10101c,#16162a,#10101c)",
                  border: `1px solid ${C.panelEdge}`,
                }} />
              ))
            : gridItems.map((item) => {
                const axisLabel = item.currentAxis ? (STATUS[item.currentAxis]?.label ?? item.currentAxis) : null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item.id)}
                    className="text-left rounded-lg sc-anim group"
                    style={{
                      background: C.panel,
                      border: `1px solid ${C.panelEdge}`,
                      padding: "14px 16px",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.brand + "66"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.panelEdge; }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono" style={{ fontSize: 10, color: C.faint }}>
                        {item.firstYear ?? ""}
                        {item.lastYear != null && item.lastYear !== item.firstYear ? ` → ${item.lastYear}` : ""}
                      </span>
                      {item.hasReversal ? (
                        <span className="font-mono" style={{ fontSize: 10, color: C.red }}>↩ reversed</span>
                      ) : axisLabel ? (
                        <span className="font-mono px-1.5 py-px rounded" style={{
                          fontSize: 9,
                          color: item.currentAxis ? STATUS[item.currentAxis].c : C.mut,
                          border: `1px solid ${item.currentAxis ? STATUS[item.currentAxis].c + "55" : C.panelEdge}`,
                        }}>
                          {axisLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="leading-snug mb-3" style={{ fontSize: 13, color: C.ink, minHeight: 51 }}>
                      {truncate(item.claim, 120)}
                    </p>
                    {item.milestones && item.milestones.length > 0 && (
                      <SettlingCurveMini
                        milestones={item.milestones}
                        animate={false}
                        ariaLabel={`Settling curve: ${item.claim}`}
                      />
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono" style={{ fontSize: 10, color: C.faint }}>
                        {item.transitionCount ?? 0} transitions{item.era ? ` · ${item.era}` : ""}
                      </span>
                      <span className="font-mono opacity-0 group-hover:opacity-100 sc-anim" style={{ fontSize: 11, color: C.brand, transition: "opacity 0.15s" }}>
                        trace it →
                      </span>
                    </div>
                  </button>
                );
              })}
        </div>

        {!listLoading && gridHasMore && (
          <div className="py-8 text-center">
            <button
              type="button"
              onClick={() => setGridVisibleCount((n) => n + 24)}
              className="font-mono rounded px-5 py-2.5"
              style={{ fontSize: 12, color: C.brand, border: `1px solid ${C.brand}66`, letterSpacing: "0.05em", background: "rgba(212,168,83,0.06)" }}
            >
              LOAD MORE · {filteredList.length - gridVisibleCount} REMAINING
            </button>
          </div>
        )}
        {!listLoading && !gridHasMore && filteredList.length > 0 && (
          <div className="py-8 text-center font-mono" style={{ color: C.faint, fontSize: 10, letterSpacing: "0.06em" }}>
            {filteredList.length} TRAJECTORIES · END OF RESULTS
          </div>
        )}

        <p className="mt-4 mb-8 font-mono" style={{ fontSize: 10, color: C.faint, letterSpacing: "0.04em" }}>
          Trajectories generated by an agentic loop.{" "}
          <a
            href="https://github.com/contofalskyR/epistemic-receipts/blob/main/scripts/loop-settling-curve.sh"
            target="_blank"
            rel="noreferrer"
            style={{ color: C.mut, textDecoration: "underline" }}
          >
            How it works →
          </a>
        </p>
      </div>
    );
  }

  function renderStorySummary() {
    if (!traj || traj.transitions.length < 2) return null;
    const sorted = [...traj.transitions].sort(chainOrder);
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
    if (list.length === 0) return null;
    // Raw-claim mode has no curated metadata to match on — fall back to the
    // top of the curated list so reading mode always ends with onward paths.
    const pool = list.filter((x) => x.id !== activeId);
    const sameDomain = activeItem ? pool.filter((x) => x.domain && x.domain === activeItem.domain) : [];
    const sameEra = activeItem ? pool.filter((x) => x.era && x.era === activeItem.era && !sameDomain.includes(x)) : [];
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
        {/* Sidebar (desktop sticky, mobile drawer) — explorer detail view only */}
        {!landing && (
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
        )}

        {/* Sidebar toggle button (desktop, detail view only) */}
        {!landing && (
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
        )}

        {/* Mobile drawer overlay — only covers area above the drawer (bottom 80vh excluded) */}
        {!landing && drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed left-0 right-0 top-0 z-40"
            style={{ bottom: "80vh", background: "rgba(0,0,0,0.6)" }}
            aria-hidden
          />
        )}
        {!landing && (
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
        )}

        {/* Right panel. With the sidebar open the column sits beside it; when
            collapsed (reading mode) it recenters and widens into the freed
            space instead of leaving a dead right half. */}
        <main className="flex-1 min-w-0">
          <div className={`px-5 md:px-8 py-6 mx-auto ${landing || !sidebarOpen ? "max-w-6xl" : "max-w-5xl"}`}>
            {landing ? renderLanding() : (<>

            {/* Chart header */}
            <button
              type="button"
              onClick={backToAll}
              className="font-mono mb-3 rounded px-2.5 py-1"
              style={{ fontSize: 11, color: C.mut, border: `1px solid ${C.panelEdge}`, letterSpacing: "0.05em", background: "transparent", cursor: "pointer" }}
            >
              ← ALL CURVES
            </button>
            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
              <div className="flex-1 min-w-0" style={{ minWidth: 260 }}>
                <h1
                  className={`font-semibold tracking-tight mb-1${titleNeedsToggle ? " cursor-pointer select-text" : ""}`}
                  style={{ fontSize: 26, lineHeight: 1.15 }}
                  onClick={titleNeedsToggle ? () => setTitleExpanded((v) => !v) : undefined}
                  onKeyDown={
                    titleNeedsToggle
                      ? (e) => e.key === "Enter" && setTitleExpanded((v) => !v)
                      : undefined
                  }
                  tabIndex={titleNeedsToggle ? 0 : undefined}
                  role={titleNeedsToggle ? "button" : undefined}
                  aria-expanded={titleNeedsToggle ? titleExpanded : undefined}
                  title={
                    titleNeedsToggle
                      ? titleExpanded
                        ? "Click to collapse the title"
                        : "Click to show the full title"
                      : undefined
                  }
                >
                  {displayTitle || (loadingDetail || listLoading ? "" : "Select a trajectory")}
                  {titleNeedsToggle && !titleExpanded && (
                    <span
                      className="ml-2 align-middle font-mono"
                      style={{ fontSize: 11, color: "#8b8fa3", letterSpacing: "0.06em" }}
                    >
                      SHOW FULL
                    </span>
                  )}
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
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <ShareButtons
                          url={typeof window !== "undefined" ? window.location.href : ""}
                          text={shareText}
                          imageCardUrl={activeId ? `/api/og/trajectory?id=${activeId}` : undefined}
                        />
                        {/* Raw-claim mode (id not in the curated list): link back to the receipt */}
                        {activeId && !activeItem && (
                          <Link
                            href={`/claims/${encodeURIComponent(activeId)}`}
                            className="font-mono"
                            style={{ fontSize: 11, color: C.brand }}
                          >
                            Open receipt →
                          </Link>
                        )}
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
              {" · "}
              <a href="/communities" style={{ color: C.mut, textDecoration: "underline" }}>
                Ratifying communities →
              </a>
              {" · "}
              <a href="/split-ledger" style={{ color: C.mut, textDecoration: "underline" }}>
                Split Ledger →
              </a>
            </p>
            </>)}
          </div>
        </main>
      </div>

      {/* Mobile floating button — detail view only (the landing IS the browser) */}
      {!landing && (
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
      )}
      {!landing && listError && (
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
