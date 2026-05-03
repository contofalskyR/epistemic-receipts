"use client";
import { useEffect, useState } from "react";
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
  history:      "History",
  law:          "Law",
  medicine:     "Medicine",
  psychology:   "Psychology",
  public_health: "Public Health",
};

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
        <span className="text-xs text-gray-600 shrink-0">
          ({topic.claimCount})
        </span>
      </Link>
      {topic.children.map(child => (
        <TopicTreeItem key={child.id} topic={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function TopicsPage() {
  const [data, setData] = useState<Record<string, TopicNode[]> | null>(null);

  useEffect(() => {
    fetch("/api/topics")
      .then(r => r.json())
      .then(d => setData(d.domains));
  }, []);

  if (!data) return <p className="text-gray-600 text-sm">Loading…</p>;

  const domainKeys = Object.keys(data).sort((a, b) =>
    (DOMAIN_LABELS[a] ?? a).localeCompare(DOMAIN_LABELS[b] ?? b)
  );

  function countAll(nodes: TopicNode[]): number {
    return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0);
  }

  return (
    <div className="space-y-10">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-xl font-semibold text-white">Topics</h1>
        <p className="mt-2 text-sm text-gray-500">
          Browse claims by domain and topic. Each topic groups claims that share a subject area
          regardless of their type or status.
        </p>
      </div>

      {domainKeys.map(domain => {
        const roots = data[domain];
        const totalTopics = countAll(roots);
        const label = DOMAIN_LABELS[domain] ?? domain;
        return (
          <section key={domain}>
            <div className="flex items-baseline gap-2 mb-3">
              <Link
                href={`/domains/${domain}`}
                className="text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
              >
                {label}
              </Link>
              <span className="text-gray-700 text-xs">({totalTopics} topics)</span>
            </div>
            <div className="rounded-lg border border-gray-800 py-1">
              {roots.map(topic => (
                <TopicTreeItem key={topic.id} topic={topic} depth={0} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
