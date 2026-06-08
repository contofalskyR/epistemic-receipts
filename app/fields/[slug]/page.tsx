"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { FieldDetailResponse } from "@/app/api/fields/[slug]/route";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";

const DOMAIN_LABELS: Record<string, string> = {
  archives:     "Archives",
  astronomy:    "Astronomy",
  government:   "Government",
  history:      "History",
  law:          "Law",
  medicine:     "Medicine",
  psychology:   "Psychology",
  public_health: "Public Health",
};

export default function FieldPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<FieldDetailResponse | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/fields/${slug}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); });
  }, [slug]);

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500 text-sm">Field not found.</p>
        <Link href="/fields" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to Fields
        </Link>
      </div>
    );
  }

  if (!data) return <p className="text-gray-600 text-sm">Loading…</p>;

  const { field, children, topics, recentClaims } = data;

  // Build breadcrumb ancestors
  const ancestors: { name: string; slug: string }[] = [];
  if (field.parent) ancestors.push({ name: field.parent.name, slug: field.parent.slug });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6">
        <nav className="text-xs text-gray-500 mb-3 flex items-center gap-1.5 flex-wrap">
          <Link href="/fields" className="hover:text-gray-300 transition-colors">Fields</Link>
          {ancestors.map(a => (
            <span key={a.slug} className="flex items-center gap-1.5">
              <span className="text-gray-700">›</span>
              <Link href={`/fields/${a.slug}`} className="hover:text-gray-300 transition-colors">
                {a.name}
              </Link>
            </span>
          ))}
          <span className="text-gray-700">›</span>
          <span className="text-gray-300">{field.name}</span>
        </nav>
        <h1 className="text-xl font-semibold text-white">{field.name}</h1>
        <div className="mt-2 flex gap-4 text-xs text-gray-600">
          {field.claimCount > 0 && (
            <span><span className="text-gray-400">{field.claimCount.toLocaleString()}</span> claims</span>
          )}
          {field.topicCount > 0 && (
            <span><span className="text-gray-400">{field.topicCount}</span> topics</span>
          )}
          {children.length > 0 && (
            <span><span className="text-gray-400">{children.length}</span> subfields</span>
          )}
        </div>
      </div>

      {/* Subfields grid */}
      {children.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Subfields</h2>
          <div className="grid gap-2">
            {children.map(c => (
              <Link
                key={c.id}
                href={`/fields/${c.slug}`}
                className="flex items-center justify-between rounded border border-gray-800 px-3 py-2.5 hover:border-gray-600 hover:bg-gray-900/50 transition-colors group"
              >
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{c.name}</span>
                <div className="flex gap-3 text-xs text-gray-700 shrink-0">
                  {c.claimCount > 0 && (
                    <span><span className="text-gray-500">{c.claimCount.toLocaleString()}</span> claims</span>
                  )}
                  {c.topicCount > 0 && (
                    <span><span className="text-gray-500">{c.topicCount}</span> topics</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Topics linked to this field */}
      {topics.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Topics</h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 divide-y divide-gray-800">
            {topics.map(t => (
              <Link
                key={t.id}
                href={`/domains/${t.domain}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-900/70 transition-colors group"
              >
                <div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{t.name}</span>
                  <span className="ml-2 text-xs text-gray-600">
                    {DOMAIN_LABELS[t.domain] ?? t.domain}
                  </span>
                </div>
                <span className="text-xs text-gray-600 shrink-0">
                  {t.claimCount} claims
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent claims tagged to this field */}
      {recentClaims.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Recent Claims in this Field
          </h2>
          <div className="space-y-2">
            {recentClaims.map(c => (
              <Link
                key={c.id}
                href={`/claims/${c.id}`}
                className="block rounded border border-gray-800 px-3 py-2.5 hover:border-gray-600 hover:bg-gray-900/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-400 leading-snug line-clamp-2">{c.text}</p>
                  <span className="shrink-0">
                    <EpistemicAxisBadge axis={c.epistemicAxis} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {children.length === 0 && topics.length === 0 && recentClaims.length === 0 && (
        <p className="text-gray-600 text-sm italic">No data linked to this field yet.</p>
      )}
    </div>
  );
}
