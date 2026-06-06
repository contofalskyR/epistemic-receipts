"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Sample {
  id: string;
  text: string;
  url: string | null;
}

interface LiveResearchData {
  count: number;
  samples: Sample[];
}

export function LiveResearchCard({ slug }: { slug: string }) {
  const [data, setData] = useState<LiveResearchData | null>(null);

  useEffect(() => {
    fetch(`/api/taxonomy/${slug}/stats`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [slug]);

  if (!data || data.count === 0) return null;

  return (
    <div className="rounded border border-gray-800 bg-gray-900/40 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-200">Live Research</h2>
        <Link
          href={`/topics/${slug}`}
          className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors"
        >
          Browse all →
        </Link>
      </div>
      <p className="text-xs text-gray-500">
        <span className="text-gray-300 font-mono">{data.count.toLocaleString()}</span>{" "}
        papers indexed from OpenAlex
      </p>
      {data.samples.length > 0 && (
        <ul className="space-y-1.5">
          {data.samples.map((s) => (
            <li key={s.id} className="text-xs text-gray-400 leading-snug">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-200 hover:underline underline-offset-2 transition-colors"
                >
                  {s.text.length > 120 ? s.text.slice(0, 120) + "…" : s.text}
                </a>
              ) : (
                <Link
                  href={`/claims/${s.id}`}
                  className="hover:text-gray-200 hover:underline underline-offset-2 transition-colors"
                >
                  {s.text.length > 120 ? s.text.slice(0, 120) + "…" : s.text}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
