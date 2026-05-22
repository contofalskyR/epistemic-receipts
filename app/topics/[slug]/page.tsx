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
  if (/conservative/i.test(party)) return "🔵";
  if (/labour/i.test(party)) return "🔴";
  if (/liberal/i.test(party)) return "🟡";
  return "⚪";
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

  const [data, setData] = useState<TopicData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    const qs = new URLSearchParams({ page: String(page), sort });
    if (party) qs.set("party", party);
    fetch(`/api/topics/${slug}?${qs.toString()}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setData(d); });
  }, [slug, page, sort, party]);

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value === "") {
      p.delete(key);
    } else {
      p.set(key, value);
    }
    if (key !== "page") p.delete("page");
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

  const { topic, parentChain, siblings, claims, total, pages, availableParties } = data;
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
