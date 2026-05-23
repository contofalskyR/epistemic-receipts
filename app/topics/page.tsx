"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

type TopicNode = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  description: string | null;
  claimCount: number;
  children: TopicNode[];
};

const DOMAIN_LABELS: Record<string, string> = {
  astronomy:    "Astronomy",
  government:   "Government & Legislation",
  history:      "History",
  law:          "Law",
  medicine:     "Medicine",
  psychology:   "Psychology",
  public_health: "Public Health",
};

function flattenTopics(nodes: TopicNode[]): TopicNode[] {
  return nodes.flatMap(n => [n, ...flattenTopics(n.children)]);
}

function TopicTreeItem({ topic, depth }: { topic: TopicNode; depth: number }) {
  return (
    <div>
      <Link
        href={`/topics/${topic.slug}`}
        className="flex items-baseline gap-2 group hover:bg-gray-900/50 rounded px-2 py-1 transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {depth > 0 && <span className="text-gray-700 text-xs shrink-0">└</span>}
        <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
          {topic.name}
        </span>
        <span className="text-xs text-gray-600 shrink-0">({topic.claimCount})</span>
      </Link>
      {topic.children.map(child => (
        <TopicTreeItem key={child.id} topic={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function SearchResult({ topic }: { topic: TopicNode }) {
  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="flex items-baseline gap-2 group hover:bg-gray-900/50 rounded px-3 py-1.5 transition-colors"
    >
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
        {topic.name}
      </span>
      <span className="text-xs text-gray-600 shrink-0">({topic.claimCount})</span>
      <span className="text-xs text-gray-700 ml-auto shrink-0">
        {DOMAIN_LABELS[topic.domain] ?? topic.domain}
      </span>
    </Link>
  );
}

function DomainSection({ domain, roots }: { domain: string; roots: TopicNode[] }) {
  const [open, setOpen] = useState(true);
  const label = DOMAIN_LABELS[domain] ?? domain;

  function countAll(nodes: TopicNode[]): number {
    return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0);
  }
  const totalTopics = countAll(roots);

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-baseline gap-2 mb-3 w-full text-left group"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">
          {label}
        </span>
        <span className="text-gray-700 text-xs">({totalTopics} topics)</span>
        <span className="text-gray-700 text-xs ml-1">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 py-1">
          {roots.map(topic => (
            <TopicTreeItem key={topic.id} topic={topic} depth={0} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function TopicsPage() {
  const [data, setData] = useState<Record<string, TopicNode[]> | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/topics")
      .then(r => r.json())
      .then(d => setData(d.domains));
  }, []);

  const allTopics = useMemo(() => {
    if (!data) return [];
    return Object.values(data).flatMap(flattenTopics);
  }, [data]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allTopics.filter(t => t.name.toLowerCase().includes(q));
  }, [query, allTopics]);

  if (!data) return <p className="text-gray-600 text-sm">Loading…</p>;

  const domainKeys = Object.keys(data).sort((a, b) =>
    (DOMAIN_LABELS[a] ?? a).localeCompare(DOMAIN_LABELS[b] ?? b)
  );

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-xl font-semibold text-white">Topics</h1>
        <p className="mt-2 text-sm text-gray-500">
          Browse claims by domain and topic.
        </p>
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search topics…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
          />
        </div>
      </div>

      {results ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 py-1">
          {results.length === 0 ? (
            <p className="text-sm text-gray-600 px-3 py-2">No topics match "{query}"</p>
          ) : (
            results.map(t => <SearchResult key={t.id} topic={t} />)
          )}
        </div>
      ) : (
        domainKeys.map(domain => (
          <DomainSection key={domain} domain={domain} roots={data[domain]} />
        ))
      )}
    </div>
  );
}
