"use client";
import { useEffect, useState } from "react";
import type { ClaimDetail, EdgeDetail } from "@/lib/claim-detail";
import { latestScore, formatDate } from "./claim-ui";
import ClaimRelationsPanel from "@/components/ClaimRelationsPanel";
import WhatHappenedNextPanel from "@/components/WhatHappenedNextPanel";

// Client island for /claims/[id]. Receives the fully serialized claim from the
// server page and renders the interactive lower half: the evidence table
// (row expand + lazy member votes) plus the follow-up/relations panels. The
// `hasRetraction` state couples WhatHappenedNextPanel to the score column
// ("…, at the time"), which is why these live in one client boundary.
// The table itself is still server-rendered HTML (client components SSR too) —
// crawlers see the sources without JS.

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberVoteRecord = {
  id: string;
  memberName: string;
  memberState: string | null;
  memberParty: string | null;
  memberId: string | null;
  chamber: string;
  vote: string;
};

// ── Edge/source helpers ───────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, { dot: string; label: string }> = {
  FOR:       { dot: "bg-green-500 border-green-400",   label: "bg-green-900 text-green-300" },
  AGAINST:   { dot: "bg-red-500 border-red-400",       label: "bg-red-900 text-red-300" },
  CITES:     { dot: "bg-blue-500 border-blue-400",     label: "bg-blue-900 text-blue-300" },
  RETRACTS:  { dot: "bg-orange-500 border-orange-400", label: "bg-orange-900 text-orange-300" },
  CORRECTED: { dot: "bg-yellow-500 border-yellow-400", label: "bg-yellow-900 text-yellow-300" },
};

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
          <span title={score === 50
            ? "50/100 is the neutral starting weight assigned at ingestion — this evidence has not been editorially weighted yet."
            : "Provenance weight assigned at ingestion and updated only through recorded revisions — expand the row for the audit log."}>
            {score}/100
          </span>
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

// ── Client island root ────────────────────────────────────────────────────────

export default function ClaimInteractive({ claim }: { claim: ClaimDetail }) {
  const [hasRetraction, setHasRetraction] = useState(false);

  const sortedEdges = [...claim.edges].sort((a, b) => latestScore(b) - latestScore(a));

  return (
    <>
      {/* Sources & edges table */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Evidence &amp; sources
          <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">
            — click any row to expand revision history
          </span>
        </h2>
        <p className="text-xs text-gray-600 leading-snug">
          Scores are provenance weights (0–100) assigned at ingestion, not truth probabilities.
          50 is the neutral default for evidence not yet editorially weighted; every change is
          preserved in the edge&apos;s revision log.{" "}
          <a href="/glossary" className="underline hover:text-gray-400 transition-colors">Glossary →</a>
        </p>
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
    </>
  );
}
