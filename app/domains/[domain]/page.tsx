"use client";
import { use, useEffect, useState } from "react";
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

export default function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = use(params);
  const [roots, setRoots] = useState<TopicNode[] | null>(null);

  useEffect(() => {
    fetch("/api/topics")
      .then(r => r.json())
      .then(d => setRoots(d.domains[domain] ?? []));
  }, [domain]);

  const label = DOMAIN_LABELS[domain] ?? domain;

  if (!roots) return <p className="text-gray-600 text-sm">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <nav className="text-xs text-gray-500 mb-3">
          <Link href="/topics" className="hover:text-gray-300 transition-colors">Topics</Link>
          <span className="mx-1.5 text-gray-700">›</span>
          <span className="text-gray-300">{label}</span>
        </nav>
        <h1 className="text-xl font-semibold text-white">{label}</h1>
        <p className="mt-1 text-xs text-gray-600">{roots.length} top-level {roots.length === 1 ? "topic" : "topics"}</p>
      </div>

      {roots.length === 0 ? (
        <p className="text-gray-600 text-sm italic">No topics in this domain yet.</p>
      ) : (
        <div className="space-y-4">
          {roots.map(topic => (
            <div key={topic.id} className="rounded-lg border border-gray-800 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/topics/${topic.slug}`}
                    className="text-sm font-medium text-gray-200 hover:text-white transition-colors"
                  >
                    {topic.name}
                  </Link>
                  {topic.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{topic.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0 mt-0.5">{topic.claimCount} claims</span>
              </div>

              {topic.children.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {topic.children.map(c => (
                    <Link
                      key={c.id}
                      href={`/topics/${c.slug}`}
                      className="text-xs px-2 py-0.5 rounded border border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300 transition-colors"
                    >
                      {c.name}
                      <span className="ml-1 text-gray-700">({c.claimCount})</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
