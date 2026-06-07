"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatAge, formatEmerged, type EmergedPrecision } from "@/lib/claimAge";
import WorldBankView from "./WorldBankView";

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT:      "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED:       "bg-yellow-900 text-yellow-300",
};

const DOMAIN_LABELS: Record<string, string> = {
  astronomy:    "Astronomy",
  history:      "History",
  law:          "Law",
  medicine:     "Medicine",
  psychology:   "Psychology",
  public_health: "Public Health",
};

function partyEmoji(party: string): string {
  if (/conservative|republican|tory/i.test(party)) return "🔵";
  if (/labour|democrat/i.test(party)) return "🔴";
  if (/liberal|ndp|green/i.test(party)) return "🟡";
  return "⚪";
}

function partyColor(party: string): string {
  if (/conservative|republican|tory/i.test(party)) return "#3b82f6"; // blue
  if (/labour|democrat/i.test(party)) return "#ef4444";              // red
  if (/liberal/i.test(party)) return "#f59e0b";                      // amber
  if (/ndp|new democratic/i.test(party)) return "#f97316";           // orange
  if (/green/i.test(party)) return "#22c55e";                        // green
  return "#6b7280";                                                   // gray
}

function PartyBreakdownBar({
  availableParties,
  activeParty,
  onSelect,
}: {
  availableParties: { party: string; claimCount: number }[];
  activeParty: string;
  onSelect: (party: string) => void;
}) {
  if (availableParties.length < 2) return null;
  const total = availableParties.reduce((s, p) => s + p.claimCount, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-1.5">
      {/* Stacked bar */}
      <div className="flex h-6 w-full rounded overflow-hidden">
        {availableParties.map(({ party, claimCount }) => {
          const pct = (claimCount / total) * 100;
          const isActive = activeParty === party;
          return (
            <button
              key={party}
              onClick={() => onSelect(activeParty === party ? "" : party)}
              title={`${party}: ${claimCount} claims (${pct.toFixed(1)}%)`}
              style={{ width: `${pct}%`, backgroundColor: partyColor(party), opacity: activeParty && !isActive ? 0.35 : 1 }}
              className="transition-opacity hover:opacity-90 focus:outline-none"
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {availableParties.map(({ party, claimCount }) => {
          const pct = ((claimCount / total) * 100).toFixed(1);
          return (
            <button
              key={party}
              onClick={() => onSelect(activeParty === party ? "" : party)}
              className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: partyColor(party) }}
              />
              <span className={activeParty === party ? "text-white font-medium" : ""}>{party}</span>
              <span className="opacity-50">{pct}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "emerged_desc", label: "Newest emerged" },
  { value: "emerged_asc",  label: "Oldest emerged" },
  { value: "most_sources", label: "Most sources" },
];

type TopicTag = { id: string; name: string; slug: string; domain: string };

type ClaimItem = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  claimEmergedAt: string | null;
  claimEmergedPrecision: EmergedPrecision | null;
  createdAt: string;
  humanReviewed: boolean;
  _count: { edges: number };
  topics: { topic: TopicTag }[];
  edges: {
    source: {
      politicalContext: { hogParty: string | null; headOfGovernment: string | null } | null;
      legislativeVotes: { chamber: string | null; yesCount: number | null; noCount: number | null; abstainCount: number | null; totalSeats: number | null }[];
    } | null;
  }[];
};

type TimelinePoint = { year: number; count: number };

type VoteStats = {
  totalVotes: number;
  contestedCount: number;
  contestedPct: number;
  unanimousCount: number;
  unanimousPct: number;
  avgAyePct: number;
  avgNayPct: number;
  contestedThreshold: number;
  minTotal: number;
};

type PartyTally = {
  party: string;
  yes: number;
  no: number;
  abstain: number;
  billCount: number;
  totalVotes: number;
  yesPct: number;
  noPct: number;
  abstainPct: number;
};

type TopicData = {
  topic: {
    id: string; name: string; slug: string; domain: string;
    description: string | null;
    children: { id: string; name: string; slug: string; claimCount: number }[];
  };
  parentChain: { name: string; slug: string }[];
  siblings: { id: string; name: string; slug: string; claimCount: number }[];
  claims: ClaimItem[];
  total: number;
  page: number;
  pages: number;
  availableParties: { party: string; claimCount: number }[];
  availableLeaders: { leader: string; claimCount: number }[];
  timeline: TimelinePoint[];
  voteStats: VoteStats | null;
  partyVoteTallies: PartyTally[];
  partyRowsParsed: number;
};

function TopicChips({ topics, exclude }: { topics: { topic: TopicTag }[]; exclude?: string }) {
  const visible = topics.filter(ct => ct.topic.slug !== exclude);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {visible.map(ct => (
        <Link
          key={ct.topic.id}
          href={`/topics/${ct.topic.slug}`}
          onClick={e => e.stopPropagation()}
          className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
        >
          {ct.topic.name}
        </Link>
      ))}
    </div>
  );
}

function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

function TimelineSection({ points }: { points: TimelinePoint[] }) {
  if (points.length === 0) return null;
  const minYear = points[0].year;
  const maxYear = points[points.length - 1].year;
  const filled: TimelinePoint[] = [];
  const byYear = new Map(points.map(p => [p.year, p.count]));
  for (let y = minYear; y <= maxYear; y++) {
    filled.push({ year: y, count: byYear.get(y) ?? 0 });
  }
  const max = Math.max(...filled.map(p => p.count));
  const total = filled.reduce((s, p) => s + p.count, 0);
  const CHART_H = 128; // px, matches h-32
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Timeline</h2>
        <p className="text-[11px] text-gray-600 mt-1">
          {total.toLocaleString()} claims · {minYear}–{maxYear} · grouped by claim-emerged year (or createdAt fallback)
        </p>
      </div>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
        <div className="flex gap-2">
          {/* Y-axis */}
          <div className="flex flex-col justify-between text-right" style={{ height: CHART_H, minWidth: 28 }}>
            <span className="text-[10px] text-gray-600 font-mono">{max}</span>
            <span className="text-[10px] text-gray-600 font-mono">{Math.round(max / 2)}</span>
            <span className="text-[10px] text-gray-600 font-mono">0</span>
          </div>
          {/* Bars */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-end gap-0.5" style={{ height: CHART_H }}>
              {filled.map(p => {
                const h = max > 0 ? Math.round((p.count / max) * CHART_H) : 0;
                return (
                  <div
                    key={p.year}
                    className="flex-1 min-w-[2px] bg-blue-700 hover:bg-blue-500 transition-colors rounded-sm"
                    style={{ height: h > 0 ? h : 1, opacity: h > 0 ? 1 : 0.15 }}
                    title={`${p.year}: ${p.count} ${p.count === 1 ? "claim" : "claims"}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-600 font-mono">
              <span>{minYear}</span>
              {maxYear - minYear > 8 && (
                <span>{Math.round((minYear + maxYear) / 2)}</span>
              )}
              <span>{maxYear}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VoteStatsSection({ stats }: { stats: VoteStats }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Vote patterns</h2>
        <p className="text-[11px] text-gray-600 mt-1">
          Recorded legislative votes on sources linked to claims in this topic. Contested when nay share &gt; {pct(stats.contestedThreshold * 100)}.
          Procedural votes with fewer than {stats.minTotal} recorded ayes-plus-nays excluded.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded border border-gray-800 bg-gray-900 px-3 py-2">
          <div className="text-[11px] text-gray-500">Recorded votes</div>
          <div className="text-lg font-semibold text-white tabular-nums">{stats.totalVotes.toLocaleString()}</div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-3 py-2">
          <div className="text-[11px] text-gray-500">Contested</div>
          <div className="text-lg font-semibold text-red-300 tabular-nums">{stats.contestedCount.toLocaleString()}</div>
          <div className="text-[10px] text-gray-600">{pct(stats.contestedPct, 1)}</div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-3 py-2">
          <div className="text-[11px] text-gray-500">Unanimous</div>
          <div className="text-lg font-semibold text-green-300 tabular-nums">{stats.unanimousCount.toLocaleString()}</div>
          <div className="text-[10px] text-gray-600">{pct(stats.unanimousPct, 1)}</div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-3 py-2">
          <div className="text-[11px] text-gray-500">Avg aye / nay</div>
          <div className="text-sm font-semibold tabular-nums">
            <span className="text-green-300">{pct(stats.avgAyePct, 1)}</span>
            <span className="text-gray-600 mx-1">/</span>
            <span className="text-red-300">{pct(stats.avgNayPct, 1)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PartyTalliesSection({ tallies, partyRowsParsed, totalVotes }: { tallies: PartyTally[]; partyRowsParsed: number; totalVotes: number }) {
  if (tallies.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Party vote breakdown</h2>
        <p className="text-[11px] text-gray-600 mt-1">
          Aggregate yes / no / abstain totals per party, parsed from{" "}
          {partyRowsParsed.toLocaleString()} of {totalVotes.toLocaleString()} vote records that include a per-party breakdown.
        </p>
      </div>
      <div className="rounded border border-gray-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-3 py-2 text-left font-medium text-gray-500">Party</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Bills</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Votes</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Yes</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">No</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Abstain</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Yes %</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">No %</th>
            </tr>
          </thead>
          <tbody>
            {tallies.map((p, i) => (
              <tr
                key={p.party}
                className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
              >
                <td className="px-3 py-2 align-top">
                  <span
                    className="inline-block w-2 h-2 rounded-sm mr-1.5"
                    style={{ backgroundColor: partyColor(p.party) }}
                  />
                  <span className="text-gray-100">{p.party}</span>
                </td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{p.billCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{p.totalVotes.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{p.yes.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{p.no.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-500 tabular-nums align-top">{p.abstain.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{pct(p.yesPct, 1)}</td>
                <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{pct(p.noPct, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TopicSlugContent() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const sort = searchParams.get("sort") ?? "emerged_desc";
  const party = searchParams.get("party") ?? "";
  const leader = searchParams.get("leader") ?? "";

  // Special-case the World Bank Indicators topic: the generic list view is
  // unusable for ~35k atomic country-year data points.
  const isWorldBank = slug === "world-bank-indicators";

  const [data, setData] = useState<TopicData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    const qs = new URLSearchParams({ page: String(page), sort });
    if (party) qs.set("party", party);
    if (leader) qs.set("leader", leader);
    fetch(`/api/topics/${slug}?${qs.toString()}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setData(d); });
  }, [slug, page, sort, party, leader]);

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value === "") {
      p.delete(key);
    } else {
      p.set(key, value);
    }
    if (key !== "page") p.delete("page");
    // Clearing party should also clear leader
    if (key === "party") p.delete("leader");
    router.push(`/topics/${slug}?${p.toString()}`);
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link href="/topics" className="text-xs text-gray-500 hover:text-white">← Topics</Link>
        <p className="text-gray-500">Topic not found.</p>
      </div>
    );
  }

  if (!data) return <p className="text-gray-600 text-sm">Loading…</p>;

  const { topic, parentChain, siblings, claims, total, pages, availableParties, availableLeaders, timeline, voteStats, partyVoteTallies, partyRowsParsed } = data;
  const domainLabel = DOMAIN_LABELS[topic.domain] ?? topic.domain;

  // Render the dedicated World Bank view (indicator faceting, country filter, comparison chart).
  if (isWorldBank) {
    return <WorldBankView topicName={topic.name} topicTotal={total} />;
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
        <Link href="/topics" className="hover:text-gray-300 transition-colors">Topics</Link>
        <span className="text-gray-700">›</span>
        <Link href={`/domains/${topic.domain}`} className="hover:text-gray-300 transition-colors capitalize">
          {domainLabel}
        </Link>
        {parentChain.map(p => (
          <>
            <span key={`sep-${p.slug}`} className="text-gray-700">›</span>
            <Link key={p.slug} href={`/topics/${p.slug}`} className="hover:text-gray-300 transition-colors">
              {p.name}
            </Link>
          </>
        ))}
        <span className="text-gray-700">›</span>
        <span className="text-gray-300">{topic.name}</span>
      </nav>

      {/* Heading */}
      <div className="border-b border-gray-800 pb-6 space-y-2">
        <h1 className="text-xl font-semibold text-white">{topic.name}</h1>
        {topic.description && (
          <p className="text-sm text-gray-400">{topic.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>{total.toLocaleString()} {total === 1 ? "claim" : "claims"}</span>
          <span className="text-gray-800">·</span>
          <Link href={`/domains/${topic.domain}`} className="hover:text-gray-300 transition-colors">
            {domainLabel}
          </Link>
        </div>
      </div>

      {/* Timeline */}
      <TimelineSection points={timeline} />

      {/* Vote stats */}
      {voteStats && <VoteStatsSection stats={voteStats} />}

      {/* Party tallies from LegislativeVote.byPartyJson */}
      {voteStats && (
        <PartyTalliesSection tallies={partyVoteTallies} partyRowsParsed={partyRowsParsed} totalVotes={voteStats.totalVotes} />
      )}

      {/* Subtopics */}
      {topic.children.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Subtopics</h2>
          <div className="flex flex-wrap gap-2">
            {topic.children.map(c => (
              <Link
                key={c.id}
                href={`/topics/${c.slug}`}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
              >
                {c.name}
                <span className="text-xs text-gray-600">({c.claimCount})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sibling topics */}
      {siblings.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Related topics in {domainLabel}
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map(s => (
              <Link
                key={s.id}
                href={`/topics/${s.slug}`}
                className="text-xs px-2.5 py-1 rounded border border-gray-800 bg-gray-900 text-gray-500 hover:border-gray-600 hover:text-gray-300 transition-colors"
              >
                {s.name} <span className="text-gray-700">({s.claimCount})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Claims */}
      <section className="space-y-4">
        {availableParties.length > 0 && (
          <div className="space-y-3">
            <PartyBreakdownBar
              availableParties={availableParties}
              activeParty={party}
              onSelect={p => setParam("party", p)}
            />
            {/* Party chips row */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setParam("party", "")}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  !party
                    ? "border-gray-400 bg-gray-700 text-white"
                    : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                All
              </button>
              {availableParties.map(({ party: p, claimCount }) => (
                <button
                  key={p}
                  onClick={() => setParam("party", p)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    party === p
                      ? "border-gray-400 bg-gray-700 text-white"
                      : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                  }`}
                >
                  {partyEmoji(p)} {p} <span className="opacity-60">({claimCount})</span>
                </button>
              ))}
            </div>
            {/* Leader sub-row — shown when a party is selected */}
            {party && availableLeaders && availableLeaders.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-1 border-l-2 border-gray-700">
                <button
                  onClick={() => setParam("leader", "")}
                  className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                    !leader
                      ? "border-gray-500 bg-gray-800 text-gray-200"
                      : "border-gray-800 bg-transparent text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  All eras
                </button>
                {availableLeaders.map(({ leader: l, claimCount }) => (
                  <button
                    key={l}
                    onClick={() => setParam("leader", l)}
                    className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                      leader === l
                        ? "border-gray-500 bg-gray-800 text-gray-200"
                        : "border-gray-800 bg-transparent text-gray-500 hover:border-gray-600 hover:text-gray-300"
                    }`}
                  >
                    {l} <span className="opacity-60">({claimCount})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Claims{total > 0 && ` (${total})`}
          </h2>
          <select
            value={sort}
            onChange={e => setParam("sort", e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-400 focus:outline-none"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {total === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-8 text-center">
            <p className="text-gray-600 text-sm">No claims tagged with this topic yet.</p>
            <p className="text-gray-700 text-xs mt-1">
              Claims are tagged via their edit page or the topic management API.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map(c => (
              <Link
                key={c.id}
                href={`/claims/${c.id}`}
                className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group"
              >
                <p className="text-sm text-gray-200 group-hover:text-white transition-colors leading-snug line-clamp-2">
                  {c.text}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[c.currentStatus] ?? STATUS_STYLE.DISPUTED}`}>
                    {c.currentStatus}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                    {c.claimType}
                  </span>
                  {(() => {
                    const pc = c.edges.find(e => e.source?.politicalContext?.hogParty)?.source?.politicalContext;
                    if (!pc?.hogParty) return null;
                    return (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium text-white"
                        style={{ backgroundColor: partyColor(pc.hogParty) }}
                      >
                        {partyEmoji(pc.hogParty)} {pc.headOfGovernment ?? pc.hogParty}
                      </span>
                    );
                  })()}
                  {(() => {
                    const vote = c.edges.find(e => e.source?.legislativeVotes?.length)?.source?.legislativeVotes?.[0];
                    if (!vote || vote.yesCount == null || vote.noCount == null) return null;
                    const yes = vote.yesCount, no = vote.noCount;
                    const total = yes + no;
                    if (total === 0) return null;
                    const yesPct = Math.round((yes / total) * 100);
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <span className="inline-flex h-2 w-16 rounded overflow-hidden">
                          <span className="bg-green-600" style={{ width: `${yesPct}%` }} />
                          <span className="bg-red-700" style={{ width: `${100 - yesPct}%` }} />
                        </span>
                        <span className="text-green-500">{yes}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-red-500">{no}</span>
                      </span>
                    );
                  })()}
                  <span className="text-xs text-gray-600">
                    {c._count.edges} {c._count.edges === 1 ? "source" : "sources"}
                  </span>
                  {c.claimEmergedAt && c.claimEmergedPrecision && (
                    <span className="text-xs text-gray-600">
                      {formatAge(c.claimEmergedAt, c.claimEmergedPrecision)} · emerged {formatEmerged(c.claimEmergedAt, c.claimEmergedPrecision)}
                    </span>
                  )}
                </div>
                <TopicChips topics={c.topics} exclude={slug} />
              </Link>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-600">
            <button
              onClick={() => setParam("page", String(page - 1))}
              disabled={page <= 1}
              className="hover:text-gray-400 disabled:opacity-30 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-gray-800">·</span>
            <span>Page {page} of {pages}</span>
            <span className="text-gray-800">·</span>
            <button
              onClick={() => setParam("page", String(page + 1))}
              disabled={page >= pages}
              className="hover:text-gray-400 disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function TopicSlugPage() {
  return (
    <Suspense fallback={<p className="text-gray-600 text-sm">Loading…</p>}>
      <TopicSlugContent />
    </Suspense>
  );
}
