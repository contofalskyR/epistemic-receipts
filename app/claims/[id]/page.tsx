"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { formatAge, formatEmerged, type EmergedPrecision } from "@/lib/claimAge";
import { useBookmarks } from "@/hooks/useBookmarks";
import ClaimRelationsPanel from "@/components/ClaimRelationsPanel";
import WhatHappenedNextPanel from "@/components/WhatHappenedNextPanel";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

type Revision = {
  id: string;
  priorScore: number | null;
  newScore: number;
  reason: string | null;
  changedAt: string;
};

type MetaEdgeDetail = {
  id: string;
  type: string;
  reason: string | null;
  createdAt: string;
  actorSource: { id: string; name: string };
};

type MemberVoteRecord = {
  id: string;
  memberName: string;
  memberState: string | null;
  memberParty: string | null;
  memberId: string | null;
  chamber: string;
  vote: string;
};

type LegislativeVoteRecord = {
  id: string;
  chamber: string;
  yesCount: number | null;
  noCount: number | null;
  abstainCount: number | null;
  totalSeats: number | null;
  passageThreshold: string | null;
  voteDate: string | null;
  passageType: string | null;
  byPartyJson: string | null;
  dataSource: string | null;
  _count: { memberVotes: number };
};

type EdgeDetail = {
  id: string;
  type: string;
  evidenceType: string;
  createdAt: string;
  source: {
    id: string;
    name: string;
    url: string | null;
    publishedAt: string | null;
    methodologyType: string;
    politicalContext: {
      headOfGovernment: string | null;
      hogParty: string | null;
      country: string;
    } | null;
    legislativeVotes: LegislativeVoteRecord[];
  };
  revisions: Revision[];
  metaEdges: MetaEdgeDetail[];
};

type ThresholdEvent = {
  id: string;
  triggeredBy: string;
  confirmedBy: string;
  note: string | null;
  evidenceSnapshot: string;
  createdAt: string;
  triggeredBySource: { name: string; url: string | null } | null;
};

type ChildClaim = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  _count: { edges: number };
};

type TopicTag = { id: string; name: string; slug: string; domain: string };

type ClaimDetail = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  claimEmergedAt: string | null;
  claimEmergedPrecision: EmergedPrecision | null;
  createdAt: string;
  humanReviewed: boolean;
  epistemicStatus: string | null;
  parent: { id: string; text: string } | null;
  children: ChildClaim[];
  edges: EdgeDetail[];
  thresholdEvents: ThresholdEvent[];
  topics: { topic: TopicTag }[];
};

// ── Shared constants ──────────────────────────────────────────────────────────

const EPISTEMIC_BADGE: Record<string, { label: string; style: string }> = {
  confirmed:         { label: "Confirmed ✓",      style: "bg-green-900/70 text-green-300 border border-green-700/50" },
  retracted:         { label: "Retracted ✗",      style: "bg-red-900/70 text-red-300 border border-red-700/50" },
  candidate:         { label: "Candidate",         style: "bg-yellow-900/70 text-yellow-300 border border-yellow-700/50" },
  false_positive:    { label: "False Positive",    style: "bg-gray-700/70 text-gray-400 border border-gray-600/50" },
  contested_dissent: { label: "Split Decision",    style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
  registered_trial:  { label: "Registered Trial",  style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
  active_trial:      { label: "Active Trial",      style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
  completed_trial:   { label: "Completed Trial",   style: "bg-cyan-900/70 text-cyan-300 border border-cyan-700/50" },
  approved:          { label: "FDA Approved",      style: "bg-emerald-900/70 text-emerald-300 border border-emerald-700/50" },
  established:       { label: "Established",       style: "bg-teal-900/70 text-teal-300 border border-teal-700/50" },
  settled_judgment:  { label: "Settled Judgment",  style: "bg-indigo-900/70 text-indigo-300 border border-indigo-700/50" },
  contested:         { label: "Contested",         style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
};

const TYPE_COLOR: Record<string, { dot: string; label: string }> = {
  FOR:       { dot: "bg-green-500 border-green-400",   label: "bg-green-900 text-green-300" },
  AGAINST:   { dot: "bg-red-500 border-red-400",       label: "bg-red-900 text-red-300" },
  CITES:     { dot: "bg-blue-500 border-blue-400",     label: "bg-blue-900 text-blue-300" },
  RETRACTS:  { dot: "bg-orange-500 border-orange-400", label: "bg-orange-900 text-orange-300" },
  CORRECTED: { dot: "bg-yellow-500 border-yellow-400", label: "bg-yellow-900 text-yellow-300" },
};

// ── Timeline utilities (inlined from timeline page) ───────────────────────────

function latestScore(edge: EdgeDetail) { return edge.revisions.at(-1)?.newScore ?? 50; }
function latestReason(edge: EdgeDetail) { return edge.revisions.at(-1)?.reason ?? null; }
function dotSize(score: number) { return 10 + (score / 100) * 14; }

function xPct(iso: string, paddedMin: number, paddedMax: number) {
  if (paddedMax === paddedMin) return 50;
  return ((new Date(iso).getTime() - paddedMin) / (paddedMax - paddedMin)) * 100;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

const CLUSTER_THRESHOLD = 5;
const LEVEL_PX = 16;

function assignOffsets(edges: EdgeDetail[], xFn: (iso: string) => number): Map<string, number> {
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

// ── Inline timeline for a single claim ───────────────────────────────────────

function ClaimTimeline({ claim }: { claim: ClaimDetail }) {
  const [hovered, setHovered] = useState<{ edge: EdgeDetail; x: number; y: number } | null>(null);
  const [hoveredThreshold, setHoveredThreshold] = useState<{ te: ThresholdEvent; x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function openUrl(url: string | null | undefined) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else { setToast("no link available"); setTimeout(() => setToast(null), 2000); }
  }

  const datedEdges = claim.edges.filter(e => e.source.publishedAt);
  if (datedEdges.length === 0 && claim.thresholdEvents.length === 0) {
    return <p className="text-xs text-gray-600 italic">No dated sources — dots will appear here once sources have publication dates.</p>;
  }

  const todayTime = Date.now();
  const edgeDates = datedEdges.map(e => new Date(e.source.publishedAt!).getTime());
  const teDates = claim.thresholdEvents.map(te => new Date(te.createdAt).getTime());
  const allDates = [...edgeDates, ...teDates];
  const minTime = allDates.length ? Math.min(...allDates) : todayTime - 1;
  const maxTime = Math.max(...allDates, todayTime);
  const span = maxTime - minTime || 1;
  const pad = span * 0.05;
  const paddedMin = minTime - pad;
  const paddedMax = maxTime + pad;
  const xFn = (iso: string) => xPct(iso, paddedMin, paddedMax);
  const todayPct = ((todayTime - paddedMin) / (paddedMax - paddedMin)) * 100;
  const offsets = assignOffsets(datedEdges, xFn);

  const yearTicks: number[] = [];
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

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
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

        {datedEdges.map(edge => {
          const score = latestScore(edge);
          const size = dotSize(score);
          const pct = xFn(edge.source.publishedAt!);
          const yOffset = offsets.get(edge.id) ?? 0;
          const colors = TYPE_COLOR[edge.type] ?? TYPE_COLOR.CITES;
          const hasUrl = !!edge.source.url;
          const isSuppressed = edge.metaEdges.some(m => m.type === "SUPPRESSED");
          const isAmplified = edge.metaEdges.some(m => m.type === "AMPLIFIED");
          const isLabeled = edge.metaEdges.some(m => m.type === "LABELED");
          const isDemoted = edge.metaEdges.some(m => m.type === "DEMOTED");
          return (
            <button key={edge.id}
              className="absolute hover:scale-125 transition-transform"
              style={{
                width: size, height: size,
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
              <div className={`w-full h-full rounded-full border-2 ${colors.dot}`} />
              {isSuppressed && (
                <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-red-950/70" />
                  <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-px bg-red-400 rotate-45" /></div>
                  <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-px bg-red-400 -rotate-45" /></div>
                </div>
              )}
              {isLabeled && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center pointer-events-none text-black font-bold text-[6px]">!</div>
              )}
            </button>
          );
        })}

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
      </div>

      <div className="flex justify-between text-[10px] text-gray-700 px-4 pb-2">
        <span>{formatDate(new Date(minTime).toISOString())}</span>
        <span>today</span>
      </div>

      {hovered && (
        <div className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs max-w-xs shadow-xl"
          style={{ left: hovered.x, top: hovered.y - 8, transform: "translate(-50%, -100%)" }}>
          <p className="text-white font-medium">{hovered.edge.source.name}</p>
          {hovered.edge.source.publishedAt && <p className="text-gray-400 mt-0.5">{formatDate(hovered.edge.source.publishedAt)}</p>}
          {hovered.edge.source.politicalContext?.headOfGovernment && (
            <p className="text-gray-500 mt-0.5 text-[10px]">
              {hovered.edge.source.politicalContext.headOfGovernment}
              {hovered.edge.source.politicalContext.hogParty ? ` · ${hovered.edge.source.politicalContext.hogParty}` : ""}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLOR[hovered.edge.type]?.label}`}>{hovered.edge.type}</span>
            <span className="text-gray-400">{latestScore(hovered.edge)}/100</span>
            {!hovered.edge.source.url && <span className="text-gray-600">· no link</span>}
          </div>
          {latestReason(hovered.edge) && <p className="text-gray-400 mt-1 leading-snug">{latestReason(hovered.edge)}</p>}
          {hovered.edge.metaEdges.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
              {hovered.edge.metaEdges.map(m => (
                <div key={m.id}>
                  <span className={`font-medium ${m.type === "SUPPRESSED" ? "text-red-400" : m.type === "AMPLIFIED" ? "text-white" : m.type === "LABELED" ? "text-amber-400" : "text-gray-500"}`}>
                    {m.type}
                  </span>
                  <span className="text-gray-500"> by </span>
                  <span className="text-gray-300">{m.actorSource.name}</span>
                  <span className="text-gray-600"> on {new Date(m.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {hoveredThreshold && (
        <div className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs max-w-xs shadow-xl"
          style={{ left: hoveredThreshold.x, top: hoveredThreshold.y - 8, transform: "translate(-50%, -100%)" }}>
          <p className="text-white font-medium">{hoveredThreshold.te.triggeredBy}</p>
          {hoveredThreshold.te.triggeredBySource && <p className="text-gray-400 mt-0.5">{hoveredThreshold.te.triggeredBySource.name}</p>}
          {hoveredThreshold.te.note && <p className="text-gray-400 mt-1 leading-snug">{hoveredThreshold.te.note}</p>}
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

// ── EU party colors ───────────────────────────────────────────────────────────

const EU_PARTY_COLORS: Record<string, string> = {
  EPP:       "bg-blue-900/70 text-blue-300",
  SD:        "bg-red-900/70 text-red-300",
  RENEW:     "bg-yellow-900/70 text-yellow-300",
  ECR:       "bg-teal-900/70 text-teal-300",
  GUE_NGL:   "bg-rose-900/70 text-rose-300",
  GREENS:    "bg-green-900/70 text-green-300",
  GREEN_EFA: "bg-green-900/70 text-green-300",
  ID:        "bg-indigo-900/70 text-indigo-300",
  ESN:       "bg-purple-900/70 text-purple-300",
  PFE:       "bg-orange-900/70 text-orange-300",
  NI:        "bg-gray-800 text-gray-400",
};

// US parties
const US_PARTY_COLORS: Record<string, string> = {
  D: "bg-blue-900/70 text-blue-300",
  R: "bg-red-900/70 text-red-300",
};

function partyColor(party: string | null): string {
  if (!party) return "bg-gray-800 text-gray-400";
  return EU_PARTY_COLORS[party] ?? US_PARTY_COLORS[party] ?? "bg-gray-800 text-gray-400";
}

// ── Country code → flag emoji ─────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  // EU member states (ISO 3166-1 alpha-3)
  AUT:"🇦🇹", BEL:"🇧🇪", BGR:"🇧🇬", HRV:"🇭🇷", CYP:"🇨🇾", CZE:"🇨🇿", DNK:"🇩🇰",
  EST:"🇪🇪", FIN:"🇫🇮", FRA:"🇫🇷", DEU:"🇩🇪", GRC:"🇬🇷", HUN:"🇭🇺", IRL:"🇮🇪",
  ITA:"🇮🇹", LVA:"🇱🇻", LTU:"🇱🇹", LUX:"🇱🇺", MLT:"🇲🇹", NLD:"🇳🇱", POL:"🇵🇱",
  PRT:"🇵🇹", ROU:"🇷🇴", SVK:"🇸🇰", SVN:"🇸🇮", ESP:"🇪🇸", SWE:"🇸🇪", GBR:"🇬🇧",
  // Others
  USA:"🇺🇸", CAN:"🇨🇦", AUS:"🇦🇺", NZL:"🇳🇿", JPN:"🇯🇵", CHN:"🇨🇳", NOR:"🇳🇴",
  CHE:"🇨🇭", ISL:"🇮🇸", UKR:"🇺🇦", TUR:"🇹🇷",
};

function countryFlag(code: string | null): string {
  if (!code) return "";
  return COUNTRY_FLAGS[code.toUpperCase()] ?? "";
}

// EU Parliament MEP profile URL
function mepProfileUrl(memberId: string | null, chamber: string): string | null {
  if (!memberId) return null;
  if (chamber === "European Parliament") {
    return `https://howtheyvote.eu/members/${memberId}`;
  }
  // US Congress: bioguide
  return `https://bioguide.congress.gov/search/bio/${memberId}`;
}

// ── Individual member votes ───────────────────────────────────────────────────

function MemberVotesSection({ legislativeVoteId, count }: { legislativeVoteId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [votes, setVotes] = useState<MemberVoteRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || votes !== null || loading) return;
    setLoading(true);
    setError(null);
    fetch(`/api/legislative-votes/${legislativeVoteId}/members`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: MemberVoteRecord[]) => setVotes(data))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open, votes, loading, legislativeVoteId]);

  const filtered = (votes && filter)
    ? votes.filter(v =>
        v.memberName.toLowerCase().includes(filter.toLowerCase()) ||
        (v.memberState ?? "").toLowerCase().includes(filter.toLowerCase()) ||
        (v.memberParty ?? "").toLowerCase().includes(filter.toLowerCase()) ||
        v.vote.toLowerCase().includes(filter.toLowerCase())
      )
    : (votes ?? []);

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-gray-400 font-medium">{count} individual votes</span>
        <span className="text-gray-600 ml-1">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p className="text-xs text-gray-500 italic">Loading member votes…</p>}
          {error && <p className="text-xs text-red-400">Failed to load: {error}</p>}
          {votes && (
            <>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                placeholder="Filter by name, state, party, or vote…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <div className="max-h-64 overflow-y-auto rounded border border-gray-800">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900 z-10">
                    <tr className="text-gray-600 border-b border-gray-800">
                      <th className="py-1 px-2 text-left font-medium">Member</th>
                      <th className="py-1 px-2 text-left font-medium">St</th>
                      <th className="py-1 px-2 text-left font-medium">Party</th>
                      <th className="py-1 px-2 text-left font-medium">Vote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(m => {
                      const profileUrl = mepProfileUrl(m.memberId, m.chamber);
                      const flag = countryFlag(m.memberState);
                      return (
                        <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-0.5 px-2 text-gray-300">
                            {profileUrl ? (
                              <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                                className="hover:text-white hover:underline">
                                {m.memberName}
                              </a>
                            ) : m.memberName}
                          </td>
                          <td className="py-0.5 px-2 text-gray-500 text-center" title={m.memberState ?? undefined}>
                            {flag ? flag : (m.memberState || "—")}
                          </td>
                          <td className="py-0.5 px-2">
                            <span className={`px-1 rounded text-[10px] font-medium ${partyColor(m.memberParty)}`}>
                              {m.memberParty ?? "—"}
                            </span>
                          </td>
                          <td className="py-0.5 px-2">
                            <span className={`px-1 rounded text-[10px] font-medium ${
                              m.vote === "Yea"     ? "bg-green-900/60 text-green-300" :
                              m.vote === "Nay"     ? "bg-red-900/60 text-red-300" :
                              m.vote === "Abstain" ? "bg-yellow-900/60 text-yellow-400" :
                              m.vote === "Present" ? "bg-yellow-900/60 text-yellow-400" :
                              "bg-gray-800 text-gray-500"
                            }`}>{m.vote}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 px-2 text-gray-600 italic">No matching members.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edges table row ───────────────────────────────────────────────────────────

function EdgeRow({ edge, hasRetraction }: { edge: EdgeDetail; hasRetraction?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const score = latestScore(edge);
  const colors = TYPE_COLOR[edge.type] ?? TYPE_COLOR.CITES;

  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-900/40 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="py-2.5 pr-4">
          {edge.source.url ? (
            <span className="flex items-center gap-2 flex-wrap">
              <a href={edge.source.url} target="_blank" rel="noopener noreferrer"
                className="text-gray-200 hover:text-white hover:underline text-sm"
                onClick={e => e.stopPropagation()}>
                {edge.source.name}
              </a>
              {edge.source.url.startsWith('https://doi.org/') ? (
                <>
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(edge.source.url.replace('https://doi.org/', ''))}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 hover:text-blue-300 hover:bg-blue-900 transition-colors whitespace-nowrap"
                    title="Search on PubMed">
                    PubMed ↗
                  </a>
                  <a
                    href={`https://www.semanticscholar.org/search?q=${encodeURIComponent(edge.source.url.replace('https://doi.org/', ''))}&sort=Relevance`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-400 hover:text-purple-300 hover:bg-purple-900 transition-colors whitespace-nowrap"
                    title="Search on Semantic Scholar">
                    S2 ↗
                  </a>
                </>
              ) : (
                <a
                  href={`https://scholar.google.com/scholar?q=${encodeURIComponent(edge.source.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700 transition-colors whitespace-nowrap"
                  title="Search on Google Scholar">
                  Scholar ↗
                </a>
              )}
            </span>
          ) : (
            <span className="text-gray-300 text-sm">{edge.source.name}</span>
          )}
        </td>
        <td className="py-2.5 pr-4">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.label}`}>{edge.type}</span>
        </td>
        <td className="py-2.5 pr-4">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{edge.evidenceType}</span>
        </td>
        <td className="py-2.5 pr-4 text-sm font-mono text-gray-300 whitespace-nowrap">
          {score}/100
          {hasRetraction && (
            <span className="text-rose-500/70 font-sans font-normal" title="Score reflects the claim at time of publication — it was later retracted">
              , at the time
            </span>
          )}
        </td>
        <td className="py-2.5 pr-4 text-xs text-gray-500">
          {edge.source.publishedAt ? formatDate(edge.source.publishedAt) : "—"}
          {edge.source.politicalContext?.headOfGovernment && (
            <span className="block text-xs text-gray-600 mt-0.5">
              {edge.source.politicalContext.hogParty === "Conservative Party" ? "🔵 " :
               edge.source.politicalContext.hogParty === "Labour Party" ? "🔴 " : ""}
              {edge.source.politicalContext.headOfGovernment}
            </span>
          )}
          {edge.source.legislativeVotes[0] && (() => {
            const v = edge.source.legislativeVotes[0];
            const yes = v.yesCount ?? 0, no = v.noCount ?? 0;
            const total = yes + no;
            if (total === 0) return null;
            const yesPct = Math.round((yes / total) * 100);
            return (
              <span className="flex items-center gap-1 mt-1">
                <span className="inline-flex h-1.5 w-12 rounded overflow-hidden">
                  <span className="bg-green-600" style={{ width: `${yesPct}%` }} />
                  <span className="bg-red-700" style={{ width: `${100 - yesPct}%` }} />
                </span>
                <span className="text-green-500">{yes}</span>
                <span className="text-gray-700">/</span>
                <span className="text-red-500">{no}</span>
              </span>
            );
          })()}
        </td>
        <td className="py-2.5 text-xs text-gray-600">{edge.source.methodologyType}</td>
        <td className="py-2.5 pl-4 text-gray-600 text-xs">{expanded ? "▲" : "▼"}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-800 bg-gray-900/30">
          <td colSpan={7} className="px-4 py-3">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Revision history</p>
            <div className="space-y-1.5">
              {edge.revisions.map(r => (
                <div key={r.id} className="flex items-start gap-4 text-xs">
                  <span className="text-white font-mono font-medium shrink-0">
                    {r.priorScore !== null ? `${r.priorScore} → ${r.newScore}` : `Initial: ${r.newScore}`}/100
                  </span>
                  <span className="text-gray-600 shrink-0">{new Date(r.changedAt).toLocaleDateString()}</span>
                  {r.reason && <span className="text-gray-400 leading-snug">{r.reason}</span>}
                </div>
              ))}
            </div>
            {edge.source.legislativeVotes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Vote record</p>
                {edge.source.legislativeVotes.map((v, i) => {
                  const total = (v.yesCount ?? 0) + (v.noCount ?? 0) + (v.abstainCount ?? 0);
                  const yesPct = total > 0 ? Math.round(((v.yesCount ?? 0) / total) * 100) : 0;
                  const noPct  = total > 0 ? Math.round(((v.noCount ?? 0) / total) * 100) : 0;
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-400">{v.chamber}</span>
                        {v.voteDate && <span className="text-gray-600">{new Date(v.voteDate).toLocaleDateString()}</span>}
                        {v.passageType && <span className="text-gray-600">{v.passageType}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-green-400">{v.yesCount ?? "—"} aye</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-red-400">{v.noCount ?? "—"} no</span>
                        {v.abstainCount !== null && v.abstainCount > 0 && (
                          <>
                            <span className="text-gray-700">·</span>
                            <span className="text-gray-500">{v.abstainCount} abstain</span>
                          </>
                        )}
                      </div>
                      {total > 0 && (
                        <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden flex">
                          <div className="h-full bg-green-700" style={{ width: `${yesPct}%` }} />
                          <div className="h-full bg-red-800" style={{ width: `${noPct}%` }} />
                        </div>
                      )}
                      {v._count.memberVotes > 0 && (
                        <MemberVotesSection legislativeVoteId={v.id} count={v._count.memberVotes} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function BookmarkToggle({ claimId }: { claimId: string }) {
  const { isBookmarked, toggle, profileKey } = useBookmarks();
  const active = profileKey ? isBookmarked(claimId) : false;
  return (
    <button
      type="button"
      onClick={() => toggle(claimId)}
      className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-colors ${
        active
          ? "bg-amber-900/60 text-amber-300 hover:bg-amber-900"
          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
      }`}
      title={active ? "Remove bookmark" : "Bookmark this claim"}
      aria-pressed={active}
    >
      {active ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
      <span>{active ? "Bookmarked" : "Bookmark"}</span>
    </button>
  );
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sortDir] = useState<"desc">("desc");
  const [hasRetraction, setHasRetraction] = useState(false);

  useEffect(() => {
    fetch(`/api/claims/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) { setFetchError(`Server error (${r.status})`); return null; }
        return r.json();
      })
      .then(d => { if (d) setClaim(d); })
      .catch(e => setFetchError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-white">← back</Link>
        <p className="text-gray-500">Claim not found.</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-white">← back</Link>
        <p className="text-red-500 text-sm">{fetchError}</p>
      </div>
    );
  }

  if (!claim) {
    return <p className="text-gray-600 text-sm">Loading…</p>;
  }

  const sortedEdges = [...claim.edges].sort((a, b) =>
    sortDir === "desc" ? latestScore(b) - latestScore(a) : latestScore(a) - latestScore(b)
  );
  const uniqueSources = new Set(claim.edges.map(e => e.source.id)).size;

  return (
    <div className="space-y-10">

      {/* Breadcrumb */}
      {claim.parent ? (
        <Link href={`/claims/${claim.parent.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          <span>←</span>
          <span className="line-clamp-1">{claim.parent.text}</span>
        </Link>
      ) : (
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← all claims</Link>
      )}

      {/* Claim header */}
      <div className="space-y-3 pb-6 border-b border-gray-800">
        <h1 className="text-xl font-semibold text-white leading-snug">{claim.text}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <EpistemicAxisBadge axis={claim.epistemicAxis} />
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
            {claim.claimType}
          </span>
          {claim.epistemicStatus && EPISTEMIC_BADGE[claim.epistemicStatus] && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EPISTEMIC_BADGE[claim.epistemicStatus]!.style}`}>
              {EPISTEMIC_BADGE[claim.epistemicStatus]!.label}
            </span>
          )}
          {!claim.humanReviewed && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800/60 text-gray-600 border border-gray-700">
              UNREVIEWED
            </span>
          )}
          <BookmarkToggle claimId={claim.id} />
        </div>
        {claim.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {claim.topics.map(ct => (
              <Link
                key={ct.topic.id}
                href={`/topics/${ct.topic.slug}`}
                className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
              >
                {ct.topic.name}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
          {claim.claimEmergedAt && claim.claimEmergedPrecision ? (
            <span>{formatAge(claim.claimEmergedAt, claim.claimEmergedPrecision)} · emerged {formatEmerged(claim.claimEmergedAt, claim.claimEmergedPrecision)}</span>
          ) : (
            <span>added {new Date(claim.createdAt).toLocaleDateString()}</span>
          )}
          <span>{claim.edges.length} {claim.edges.length === 1 ? "edge" : "edges"}</span>
          <span>{uniqueSources} {uniqueSources === 1 ? "source" : "sources"}</span>
          {claim.thresholdEvents.length > 0 && (
            <span className="text-green-500">{claim.thresholdEvents.length} threshold {claim.thresholdEvents.length === 1 ? "event" : "events"}</span>
          )}
        </div>
      </div>

      {/* Threshold events */}
      {claim.thresholdEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Threshold events</h2>
          {claim.thresholdEvents.map(te => {
            let snapshot: { edges?: { id: string; score: number }[] } = {};
            try { snapshot = JSON.parse(te.evidenceSnapshot); } catch { /* raw */ }
            return (
              <div key={te.id} className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-4 space-y-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <p className="text-sm font-medium text-white">{te.triggeredBy}</p>
                  <span className="text-xs text-gray-500 shrink-0">{formatDate(te.createdAt)}</span>
                </div>
                {te.triggeredBySource && (
                  <p className="text-xs text-gray-400">
                    Source:{" "}
                    {te.triggeredBySource.url ? (
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <a href={te.triggeredBySource.url} target="_blank" rel="noopener noreferrer"
                          className="text-gray-200 hover:underline">
                          {te.triggeredBySource.name}
                        </a>
                        {te.triggeredBySource.url.startsWith('https://doi.org/') ? (
                          <>
                            <a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(te.triggeredBySource.url.replace('https://doi.org/', ''))}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-xs px-1 py-0.5 rounded bg-blue-900/50 text-blue-400 hover:text-blue-300">PubMed ↗</a>
                            <a href={`https://www.semanticscholar.org/search?q=${encodeURIComponent(te.triggeredBySource.url.replace('https://doi.org/', ''))}&sort=Relevance`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-xs px-1 py-0.5 rounded bg-purple-900/50 text-purple-400 hover:text-purple-300">S2 ↗</a>
                          </>
                        ) : (
                          <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(te.triggeredBySource.name)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs px-1 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-300">Scholar ↗</a>
                        )}
                      </span>
                    ) : (
                      <span>{te.triggeredBySource.name}</span>
                    )}
                  </p>
                )}
                <p className="text-xs text-gray-500">Confirmed by: {te.confirmedBy}</p>
                {te.note && <p className="text-sm text-gray-300 leading-relaxed">{te.note}</p>}
                {snapshot.edges && snapshot.edges.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Evidence snapshot</p>
                    <div className="flex flex-wrap gap-2">
                      {snapshot.edges.map(e => (
                        <span key={e.id} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                          {e.id.slice(-6)} · {e.score}/100
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Embedded timeline */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Timeline</h2>
        <ClaimTimeline claim={claim} />
      </section>

      {/* Sources & edges table */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Sources & edges
          <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">
            — click any row to expand revision history
          </span>
        </h2>
        {claim.edges.length === 0 ? (
          <p className="text-sm text-gray-700 italic">No edges yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-gray-600 border-b border-gray-800">
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Evidence</th>
                  <th className="pb-2 pr-4 font-medium">Score ↓</th>
                  <th className="pb-2 pr-4 font-medium">Published</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 pl-4" />
                </tr>
              </thead>
              <tbody>
                {sortedEdges.map(edge => <EdgeRow key={edge.id} edge={edge} hasRetraction={hasRetraction} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Follow-up layer — renders nothing if no follow-up relations */}
      <WhatHappenedNextPanel claimId={claim.id} onHasReversed={setHasRetraction} />

      {/* Citation graph (lazy-loaded — renders nothing if no relations) */}
      <ClaimRelationsPanel claimId={claim.id} />

      {/* Child claims */}
      {claim.children.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Frames & sub-claims
            <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">({claim.children.length})</span>
          </h2>
          <div className="space-y-2">
            {claim.children.map(child => (
              <Link key={child.id} href={`/claims/${child.id}`}
                className="block rounded-md border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 hover:bg-gray-800 transition-colors group">
                <p className="text-sm text-gray-300 group-hover:text-white transition-colors leading-snug line-clamp-2">
                  {child.text}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <EpistemicAxisBadge axis={child.epistemicAxis} />
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
                    {child.claimType}
                  </span>
                  <span className="text-xs text-gray-600">
                    {child._count.edges} {child._count.edges === 1 ? "source" : "sources"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
