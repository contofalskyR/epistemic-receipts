"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAge, formatEmerged, type EmergedPrecision } from "@/lib/claimAge";

type Revision = { id: string; priorScore: number | null; newScore: number; reason: string | null; changedAt: string };
type MetaEdgeData = {
  id: string;
  type: string;
  reason: string | null;
  createdAt: string;
  actorSource: { name: string; url: string | null };
};
type EdgeData = {
  id: string;
  type: string;
  source: { name: string; url: string | null; publishedAt: string | null };
  revisions: Revision[];
  metaEdges: MetaEdgeData[];
};
type ThresholdEventData = {
  id: string;
  triggeredBy: string;
  confirmedBy: string;
  note: string | null;
  createdAt: string;
  triggeredBySource: { name: string; url: string | null } | null;
};
type ClaimData = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  claimEmergedAt: string | null;
  claimEmergedPrecision: EmergedPrecision | null;
  edges: EdgeData[];
  thresholdEvents: ThresholdEventData[];
};

const TYPE_COLOR: Record<string, { dot: string; label: string }> = {
  FOR:       { dot: "bg-green-500 border-green-400",   label: "bg-green-900 text-green-300" },
  AGAINST:   { dot: "bg-red-500 border-red-400",       label: "bg-red-900 text-red-300" },
  CITES:     { dot: "bg-blue-500 border-blue-400",     label: "bg-blue-900 text-blue-300" },
  RETRACTS:  { dot: "bg-orange-500 border-orange-400", label: "bg-orange-900 text-orange-300" },
  CORRECTED: { dot: "bg-yellow-500 border-yellow-400", label: "bg-yellow-900 text-yellow-300" },
};

const META_TYPE_COLOR: Record<string, string> = {
  SUPPRESSED: "text-red-400",
  AMPLIFIED:  "text-green-400",
  LABELED:    "text-amber-400",
  DEMOTED:    "text-gray-400",
};

function latestScore(edge: EdgeData) { return edge.revisions.at(-1)?.newScore ?? 50; }
function latestReason(edge: EdgeData) { return edge.revisions.at(-1)?.reason ?? null; }
function dotSize(score: number) { return 10 + (score / 100) * 14; }

function xPct(iso: string, paddedMin: number, paddedMax: number): number {
  if (paddedMax === paddedMin) return 50;
  return ((new Date(iso).getTime() - paddedMin) / (paddedMax - paddedMin)) * 100;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

const CLUSTER_THRESHOLD = 5;
const LEVEL_PX = 16;

function assignOffsets(edges: EdgeData[], xFn: (iso: string) => number): Map<string, number> {
  const sorted = [...edges]
    .filter(e => e.source.publishedAt)
    .sort((a, b) => new Date(a.source.publishedAt!).getTime() - new Date(b.source.publishedAt!).getTime());

  const offsets = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const edge = sorted[i];
    const x = xFn(edge.source.publishedAt!);
    const nearby = sorted.slice(0, i).filter(e =>
      Math.abs(xFn(e.source.publishedAt!) - x) < CLUSTER_THRESHOLD
    );
    if (nearby.length === 0) {
      offsets.set(edge.id, 0);
    } else {
      const level = Math.ceil(nearby.length / 2) * (nearby.length % 2 === 1 ? 1 : -1);
      offsets.set(edge.id, level * LEVEL_PX);
    }
  }
  return offsets;
}

export default function TimelinePage() {
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [timeRange, setTimeRange] = useState<{ min: string; max: string } | null>(null);
  const [hovered, setHovered] = useState<{ edge: EdgeData; x: number; y: number } | null>(null);
  const [hoveredThreshold, setHoveredThreshold] = useState<{ te: ThresholdEventData; x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function openUrl(url: string | null | undefined) {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      showToast("no link available");
    }
  }

  useEffect(() => {
    fetch("/api/timeline")
      .then(r => r.json())
      .then(data => { setClaims(data.claims); setTimeRange(data.timeRange); });
  }, []);

  const minTime = timeRange ? new Date(timeRange.min).getTime() : 0;
  const todayTime = Date.now();
  const maxTime = timeRange ? Math.max(new Date(timeRange.max).getTime(), todayTime) : todayTime;

  const span = maxTime - minTime;
  const pad = span * 0.05;
  const paddedMin = minTime - pad;
  const paddedMax = maxTime + pad;

  const xFn = (iso: string) => xPct(iso, paddedMin, paddedMax);
  const todayPct = ((todayTime - paddedMin) / (paddedMax - paddedMin)) * 100;

  const yearTicks: number[] = [];
  if (timeRange) {
    const startYear = new Date(paddedMin).getFullYear();
    const endYear = new Date(paddedMax).getFullYear();
    let lastPct = -Infinity;
    for (let y = startYear; y <= endYear; y++) {
      const ts = new Date(y, 0, 1).getTime();
      const pct = ((ts - paddedMin) / (paddedMax - paddedMin)) * 100;
      if (pct >= 0 && pct <= 100 && pct - lastPct >= 4) {
        yearTicks.push(ts);
        lastPct = pct;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-white">Timeline</h2>
        <div className="flex gap-3 text-xs flex-wrap">
          {Object.entries(TYPE_COLOR).map(([type, c]) => (
            <span key={type} className={`px-2 py-0.5 rounded-full font-medium ${c.label}`}>{type}</span>
          ))}
          <span className="text-gray-500">· dot size = evidence score</span>
        </div>
      </div>

      {claims.length === 0 && (
        <p className="text-gray-500 text-sm">No edges with dated sources yet.</p>
      )}

      <div className="space-y-1">
        {claims.map(claim => {
          const datedEdges = claim.edges.filter(e => e.source.publishedAt);
          const offsets = assignOffsets(datedEdges, xFn);

          return (
            <div key={claim.id} className="rounded-lg border border-gray-800 overflow-hidden">
              {/* Claim label */}
              <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50">
                <Link href={`/claims/${claim.id}`} className="text-xs text-gray-300 hover:text-white leading-snug block transition-colors">
                  {claim.text}
                </Link>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    claim.currentStatus === "HARD_FACT" ? "bg-green-900 text-green-300" :
                    claim.currentStatus === "NEVER_RESOLVES" ? "bg-gray-700 text-gray-400" :
                    "bg-yellow-900 text-yellow-300"
                  }`}>{claim.currentStatus}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-800 text-gray-500">
                    {claim.claimType}
                  </span>
                  {claim.claimEmergedAt && claim.claimEmergedPrecision && (
                    <span className="text-xs text-gray-500">
                      {formatAge(claim.claimEmergedAt, claim.claimEmergedPrecision)} · emerged {formatEmerged(claim.claimEmergedAt, claim.claimEmergedPrecision)}
                    </span>
                  )}
                </div>
              </div>

              {/* Track */}
              <div className="relative h-24 px-4">
                <div className="absolute left-4 right-4 top-1/2 h-px bg-gray-800" />

                {yearTicks.map(ts => {
                  const pct = ((ts - paddedMin) / (paddedMax - paddedMin)) * 100;
                  return (
                    <div key={ts} className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
                      style={{ left: `calc(1rem + (100% - 2rem) * ${pct} / 100)` }}>
                      <div className="mt-auto mb-1 h-2 w-px bg-gray-700" />
                      <span className="text-gray-600 text-[9px] absolute bottom-1">{new Date(ts).getFullYear()}</span>
                    </div>
                  );
                })}

                <div className="absolute top-2 bottom-2 w-px bg-gray-600 pointer-events-none"
                  style={{ left: `calc(1rem + (100% - 2rem) * ${todayPct} / 100)` }}>
                  <span className="absolute -top-0.5 left-1 text-gray-500 text-[9px] whitespace-nowrap">today</span>
                </div>

                {/* Edge dots — wrapper div holds position; button fills it */}
                {datedEdges.map(edge => {
                  const score = latestScore(edge);
                  const size = dotSize(score);
                  const pct = xFn(edge.source.publishedAt!);
                  const yOffset = offsets.get(edge.id) ?? 0;
                  const colors = TYPE_COLOR[edge.type] ?? TYPE_COLOR.CITES;
                  const hasUrl = !!edge.source.url;

                  const metaTypes = new Set(edge.metaEdges.map(me => me.type));
                  const isSuppressed = metaTypes.has("SUPPRESSED");
                  const isAmplified  = metaTypes.has("AMPLIFIED");
                  const isLabeled    = metaTypes.has("LABELED");
                  const isDemoted    = metaTypes.has("DEMOTED");

                  return (
                    <button
                      key={edge.id}
                      className="absolute hover:scale-125 transition-transform"
                      style={{
                        width: size,
                        height: size,
                        left: `calc(1rem + (100% - 2rem) * ${pct} / 100)`,
                        top: `calc(50% + ${yOffset}px)`,
                        transform: "translate(-50%, -50%)",
                        zIndex: 10,
                        cursor: hasUrl ? "pointer" : "default",
                        opacity: isDemoted ? 0.5 : 1,
                        ...(isAmplified ? { filter: "drop-shadow(0 0 5px rgba(255,255,255,0.5))" } : {}),
                      }}
                      onMouseEnter={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHovered({ edge, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => openUrl(edge.source.url)}
                    >
                      {/* Main dot */}
                      <div className={`w-full h-full rounded-full border-2 ${colors.dot} ${isAmplified ? "border-white/60" : ""}`} />

                      {/* SUPPRESSED: red overlay + X */}
                      {isSuppressed && (
                        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                          <div className="absolute inset-0 bg-red-950/70" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-px bg-red-400 rotate-45" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-px bg-red-400 -rotate-45" />
                          </div>
                        </div>
                      )}

                      {/* LABELED: amber badge */}
                      {isLabeled && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center pointer-events-none text-[6px] font-black text-black leading-none">
                          !
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* ThresholdEvent markers */}
                {claim.thresholdEvents.map(te => {
                  const pct = xFn(te.createdAt);
                  const hasUrl = !!te.triggeredBySource?.url;
                  return (
                    <button key={te.id}
                      className="absolute top-1 bottom-1 flex flex-col items-center"
                      style={{ left: `calc(1rem + (100% - 2rem) * ${pct} / 100)`, zIndex: 20, cursor: hasUrl ? "pointer" : "default" }}
                      onMouseEnter={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setHoveredThreshold({ te, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setHoveredThreshold(null)}
                      onClick={() => openUrl(te.triggeredBySource?.url)}
                    >
                      <div className="w-0.5 flex-1 bg-white/80 pointer-events-none" />
                      <div className="absolute w-3 h-3 bg-white rotate-45 border border-white/60 pointer-events-none" style={{ top: "calc(50% - 6px)" }} />
                      <span className="absolute text-[9px] text-white font-medium whitespace-nowrap bg-gray-950/80 px-1 rounded leading-tight pointer-events-none"
                        style={{ top: 4, transform: "translateX(-50%)", left: "50%" }}>
                        {te.triggeredBy}
                      </span>
                    </button>
                  );
                })}

                {claim.edges.length > datedEdges.length && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-600">
                    +{claim.edges.length - datedEdges.length} undated
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {timeRange && (
        <div className="flex justify-between text-xs text-gray-600 px-4">
          <span>{formatDate(timeRange.min)}</span>
          <span className="text-gray-500">today</span>
        </div>
      )}

      {/* Edge dot hover tooltip */}
      {hovered && (
        <div className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs max-w-xs shadow-xl"
          style={{ left: hovered.x, top: hovered.y - 8, transform: "translate(-50%, -100%)" }}>
          <p className="text-white font-medium">{hovered.edge.source.name}</p>
          {hovered.edge.source.publishedAt && (
            <p className="text-gray-400 mt-0.5">{formatDate(hovered.edge.source.publishedAt)}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLOR[hovered.edge.type]?.label}`}>
              {hovered.edge.type}
            </span>
            <span className="text-gray-400">{latestScore(hovered.edge)}/100</span>
            {!hovered.edge.source.url && <span className="text-gray-600">· no link</span>}
          </div>
          {latestReason(hovered.edge) && (
            <p className="text-gray-400 mt-1 leading-snug">{latestReason(hovered.edge)}</p>
          )}
          {hovered.edge.metaEdges.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-gray-600 text-[10px] uppercase tracking-wide mb-1">Meta-events on this edge</p>
              {hovered.edge.metaEdges.map(me => (
                <p key={me.id} className="text-[10px] mt-0.5 leading-snug">
                  <span className={META_TYPE_COLOR[me.type] ?? "text-gray-400"}>{me.type}</span>
                  <span className="text-gray-500"> by {me.actorSource.name}</span>
                  <span className="text-gray-600"> · {formatDate(me.createdAt)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Threshold event hover tooltip */}
      {hoveredThreshold && (
        <div className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs max-w-xs shadow-xl"
          style={{ left: hoveredThreshold.x, top: hoveredThreshold.y - 8, transform: "translate(-50%, -100%)" }}>
          <p className="text-white font-medium">{hoveredThreshold.te.triggeredBy}</p>
          {hoveredThreshold.te.triggeredBySource && (
            <p className="text-gray-400 mt-0.5">{hoveredThreshold.te.triggeredBySource.name}</p>
          )}
          {hoveredThreshold.te.note && (
            <p className="text-gray-400 mt-1 leading-snug">{hoveredThreshold.te.note}</p>
          )}
          {!hoveredThreshold.te.triggeredBySource?.url && (
            <p className="text-gray-600 mt-1">no link</p>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-700 text-gray-300 text-xs px-4 py-2 rounded-full shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
