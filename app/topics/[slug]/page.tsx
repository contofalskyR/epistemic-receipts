"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatAge, formatEmerged, type EmergedPrecision } from "@/lib/claimAge";

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
  edges: { source: { politicalContext: { hogParty: string | null; headOfGovernment: string | null } | null } | null }[];
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

function TopicSlugContent() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const sort = searchParams.get("sort") ?? "emerged_desc";
  const party = searchParams.get("party") ?? "";
  const leader = searchParams.get("leader") ?? "";

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

  const { topic, parentChain, siblings, claims, total, pages, availableParties, availableLeaders } = data;
  const domainLabel = DOMAIN_LABELS[topic.domain] ?? topic.domain;

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
        <p className="text-xs text-gray-600">{total} {total === 1 ? "claim" : "claims"}</p>
      </div>

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
