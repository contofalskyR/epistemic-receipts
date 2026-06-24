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
import { ShareButtons } from "@/components/ShareButtons";

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
  ingestedBy: string;
  verificationStatus: string | null;
  parent: { id: string; text: string } | null;
  children: ChildClaim[];
  edges: EdgeDetail[];
  thresholdEvents: ThresholdEvent[];
  topics: { topic: TopicTag }[];
};

// ── Shared constants ──────────────────────────────────────────────────────────

const CLAIM_TYPE_LABEL: Record<string, string> = {
  EMPIRICAL: "Empirical",
  INSTITUTIONAL: "Institutional",
  INTERPRETIVE: "Interpretive",
  HYBRID: "Hybrid",
};

const CLAIM_TYPE_TOOLTIP: Record<string, string> = {
  EMPIRICAL: "A factual claim grounded in observable, measurable evidence",
  INSTITUTIONAL: "A claim about laws, rules, or official decisions by institutions",
  INTERPRETIVE: "A claim that involves inference or expert judgment",
  HYBRID: "Combines empirical data with institutional or interpretive framing",
};

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

// ── Edge/source helpers ───────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, { dot: string; label: string }> = {
  FOR:       { dot: "bg-green-500 border-green-400",   label: "bg-green-900 text-green-300" },
  AGAINST:   { dot: "bg-red-500 border-red-400",       label: "bg-red-900 text-red-300" },
  CITES:     { dot: "bg-blue-500 border-blue-400",     label: "bg-blue-900 text-blue-300" },
  RETRACTS:  { dot: "bg-orange-500 border-orange-400", label: "bg-orange-900 text-orange-300" },
  CORRECTED: { dot: "bg-yellow-500 border-yellow-400", label: "bg-yellow-900 text-yellow-300" },
};

function latestScore(edge: EdgeDetail) { return edge.revisions.at(-1)?.newScore ?? 50; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

// ── Inline timeline for a single claim — lifeline redesign ───────────────────

function fmtTlDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function TlLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: "#888898" }}>{label}</span>
    </div>
  );
}

function ClaimTimeline({ claim }: { claim: ClaimDetail }) {
  const datedEdges = claim.edges.filter(e => e.source.publishedAt);

  if (datedEdges.length === 0) {
    return (
      <p className="text-xs text-gray-600 italic">
        No dated sources — dots will appear here once sources have publication dates.
      </p>
    );
  }

  const today = new Date();
  const todayTime = today.getTime();
  const PAD_L = 3, PAD_R = 3, RANGE = 94;
  const startTime = Math.min(...datedEdges.map(e => new Date(e.source.publishedAt!).getTime()));
  const totalSpan = Math.max(todayTime - startTime, 1);

  function at(d: Date) {
    return PAD_L + ((d.getTime() - startTime) / totalSpan) * RANGE;
  }

  const todayPct = at(today);

  const nodes = datedEdges
    .map(e => ({ edge: e, date: new Date(e.source.publishedAt!), pct: at(new Date(e.source.publishedAt!)) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const yOff = nodes.map((n, i) => {
    for (let j = 0; j < i; j++) {
      if (Math.abs(nodes[j].pct - n.pct) < 6) return i % 2 === 0 ? 15 : -15;
    }
    return 0;
  });

  const firstPct = nodes[0].pct;
  const lastNode = nodes[nodes.length - 1];
  const dormantYrs = (todayTime - lastNode.date.getTime()) / (365.25 * 86400000);

  const yearTicks: number[] = [];
  let lastYearPct = -Infinity;
  for (let y = new Date(startTime).getFullYear(); y <= today.getFullYear(); y++) {
    const pct = at(new Date(y, 0, 1));
    if (pct >= PAD_L && pct <= 100 - PAD_R && pct - lastYearPct >= 5) {
      yearTicks.push(new Date(y, 0, 1).getTime());
      lastYearPct = pct;
    }
  }

  function voteTag(edge: EdgeDetail) {
    const v = edge.source.legislativeVotes?.[0];
    if (!v) return null;
    const passed = v.passageType === "PASSED";
    return { text: `${v.yesCount ?? 0}–${v.noCount ?? 0} · ${passed ? "PASSED" : "FAILED"}`, color: passed ? "#22c55e" : "#ef4444" };
  }

  const BLUE = "#60a5fa", AMB = "#f0a000", MUT = "#888898";
  const TRACK_H = 170, AY = 106;

  const dormantChipLeft = lastNode.pct + (todayPct - lastNode.pct) / 2;
  const dormantLabel = dormantYrs >= 1
    ? `${(Math.round(dormantYrs * 10) / 10).toFixed(1)} yrs · unreviewed since emergence`
    : `${Math.round(dormantYrs * 12)} mo · unreviewed since emergence`;
  const showDormant = dormantYrs > 0.3 && (todayPct - lastNode.pct) > 4;

  return (
    <div style={{ background: "#0e0e1c", border: "1px solid #1e1e38", borderRadius: 12, position: "relative", padding: "1.4rem 1.75rem 3.25rem", overflow: "hidden" }}>
      {/* gradient tint top-left */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 12,
        background: "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.07) 0%, transparent 55%)" }} />

      {/* legend — top-right */}
      <div style={{ display: "flex", alignItems: "center", gap: 16,
        position: "absolute", top: "1.25rem", right: "1.5rem", zIndex: 2, flexWrap: "wrap" }}>
        <TlLegendDot color={BLUE} label="Emerged" />
        <TlLegendDot color={AMB} label="Today" />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 24, height: 0, borderTop: `2px dashed ${MUT}`, opacity: 0.5 }} />
          <span style={{ fontSize: 11, color: MUT }}>Dormant · no revisions</span>
        </div>
      </div>

      {/* track */}
      <div style={{ position: "relative", height: TRACK_H, marginTop: "1.1rem" }}>

        {/* active axis: left edge → first emerged node */}
        <div style={{ position: "absolute", top: AY, height: 2, left: `${PAD_L}%`,
          width: `${Math.max(0, firstPct - PAD_L)}%`, transform: "translateY(-50%)",
          background: `linear-gradient(to right, rgba(96,165,250,0.25), ${BLUE})`,
          pointerEvents: "none" }} />

        {/* dormant axis: last emerged → today */}
        <div style={{ position: "absolute", top: AY - 1, left: `${lastNode.pct}%`,
          width: `${Math.max(0, todayPct - lastNode.pct)}%`,
          borderTop: "2px dashed rgba(136,136,152,0.35)", pointerEvents: "none" }} />

        {/* year ticks */}
        {yearTicks.map(ts => {
          const pct = at(new Date(ts));
          return (
            <div key={ts}>
              <div style={{ position: "absolute", left: `${pct}%`, top: AY - 4,
                width: 1, height: 8, background: "#1e1e38",
                transform: "translateX(-50%)", pointerEvents: "none" }} />
              <span style={{ position: "absolute", left: `${pct}%`, top: AY + 8,
                transform: "translateX(-50%)", fontSize: 10, color: "#3a3a55",
                whiteSpace: "nowrap", pointerEvents: "none" }}>
                {new Date(ts).getFullYear()}
              </span>
            </div>
          );
        })}

        {/* dormant bracket + chip */}
        {showDormant && (
          <>
            <div style={{ position: "absolute", left: `${lastNode.pct + 0.5}%`,
              width: `${Math.max(0, todayPct - lastNode.pct - 1)}%`,
              top: AY - 20, height: 10, pointerEvents: "none",
              borderTop: "1px solid rgba(240,160,0,0.3)",
              borderLeft: "1px solid rgba(240,160,0,0.3)",
              borderRight: "1px solid rgba(240,160,0,0.3)",
              borderRadius: "3px 3px 0 0" }} />
            <div style={{ position: "absolute", left: `${dormantChipLeft}%`, top: AY - 38,
              transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 10,
              color: AMB, background: "rgba(240,160,0,0.1)",
              border: "1px solid rgba(240,160,0,0.28)", borderRadius: 20,
              padding: "2px 9px", zIndex: 5, pointerEvents: "none" }}>
              {dormantLabel}
            </div>
          </>
        )}

        {/* today: full-height vertical line */}
        <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, width: 1,
          background: "rgba(240,160,0,0.18)", transform: "translateX(-50%)",
          pointerEvents: "none" }} />

        {/* today: halo */}
        <div style={{ position: "absolute", left: `${todayPct}%`, top: AY, width: 40, height: 40,
          transform: "translate(-50%, -50%)", borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(240,160,0,0.22) 0%, transparent 68%)" }} />

        {/* today: core */}
        <div style={{ position: "absolute", left: `${todayPct}%`, top: AY, width: 9, height: 9,
          transform: "translate(-50%, -50%)", borderRadius: "50%", background: AMB,
          zIndex: 10 }} />

        {/* today: caption right-below */}
        <div style={{ position: "absolute", left: `${todayPct}%`, top: AY + 8,
          paddingLeft: 10, pointerEvents: "none", zIndex: 5 }}>
          <div style={{ fontSize: 11, color: AMB, fontWeight: 600,
            whiteSpace: "nowrap", lineHeight: 1.3 }}>today</div>
          <div style={{ fontSize: 10, color: MUT,
            whiteSpace: "nowrap", lineHeight: 1.3 }}>{fmtTlDate(today)}</div>
        </div>

        {/* emerged nodes */}
        {nodes.map(({ edge, date, pct }, idx) => {
          const nodeAY = AY + yOff[idx];
          const tag = voteTag(edge);
          return (
            <div key={edge.id} style={{ position: "absolute", left: `${pct}%`, top: nodeAY,
              width: 0, height: 0, zIndex: 3 }}>
              {/* halo */}
              <div style={{ position: "absolute", transform: "translate(-50%,-50%)",
                width: 54, height: 54, borderRadius: "50%", pointerEvents: "none",
                background: "radial-gradient(circle, rgba(96,165,250,0.2) 0%, transparent 68%)" }} />
              {/* ring */}
              <div style={{ position: "absolute", transform: "translate(-50%,-50%)",
                width: 22, height: 22, borderRadius: "50%",
                border: `1.5px solid ${BLUE}`, background: "rgba(96,165,250,0.05)" }} />
              {/* core */}
              <div style={{ position: "absolute", transform: "translate(-50%,-50%)",
                width: 10, height: 10, borderRadius: "50%", background: BLUE, zIndex: 1 }} />
              {/* caption above */}
              <div style={{ position: "absolute", bottom: "calc(50% + 15px)",
                transform: "translateX(-50%)", display: "flex", flexDirection: "column",
                alignItems: "center", paddingBottom: 4, pointerEvents: "none", zIndex: 2 }}>
                <span style={{ fontSize: 10, color: MUT,
                  whiteSpace: "nowrap", lineHeight: 1.4 }}>Claim emerged</span>
                <span style={{ fontSize: 10, color: "#b0b0c8", fontWeight: 500,
                  whiteSpace: "nowrap", lineHeight: 1.4 }}>{fmtTlDate(date)}</span>
                {tag && (
                  <span style={{ fontSize: 9, color: tag.color, whiteSpace: "nowrap",
                    lineHeight: 1.4, marginTop: 1, background: `${tag.color}1a`,
                    border: `1px solid ${tag.color}44`, borderRadius: 4,
                    padding: "1px 4px" }}>{tag.text}</span>
                )}
              </div>
            </div>
          );
        })}

      </div>

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
    return <p className="text-gray-600 text-sm font-mono animate-pulse">Pulling the receipt…</p>;
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

      {/* Claim header — the receipt itself */}
      <div className="space-y-3 pb-6 border-b border-dashed border-gray-700">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-500">
          Receipt <span className="text-gray-600">№</span>{" "}
          <span className="text-gray-400" title={claim.id}>{claim.id.slice(-8)}</span>
        </p>
        {claim.verificationStatus === "DEPRECATED" && (
          <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            This record was retired after a pipeline audit. It is excluded from default views
            and preserved here for the audit trail only.
          </div>
        )}
        <h1 className="text-xl font-semibold text-white leading-snug">{claim.text}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <EpistemicAxisBadge axis={claim.epistemicAxis} />
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400"
            title={CLAIM_TYPE_TOOLTIP[claim.claimType] ?? ""}
          >
            {CLAIM_TYPE_LABEL[claim.claimType] ?? claim.claimType}
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
        <ShareButtons
          url={typeof window !== "undefined" ? window.location.href : `https://epistemic-receipts.vercel.app/claims/${claim.id}`}
          text={`"${claim.text.slice(0, 220)}"${claim.epistemicAxis ? ` — ${claim.epistemicAxis}` : ""} 🧾`}
        />
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
          <span>{uniqueSources} {uniqueSources === 1 ? "source" : "sources"}</span>
          <span>{claim.edges.length} evidence {claim.edges.length === 1 ? "link" : "links"}</span>
          {claim.ingestedBy && (
            <span className="font-mono text-gray-600" title="Ingestion pipeline that produced this record">
              via {claim.ingestedBy}
            </span>
          )}
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
          Evidence & sources
          <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">
            — click any row to expand revision history
          </span>
        </h2>
        {claim.edges.length === 0 ? (
          <p className="text-sm text-gray-700 italic">No sources linked to this claim yet.</p>
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
                    {CLAIM_TYPE_LABEL[child.claimType] ?? child.claimType}
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
