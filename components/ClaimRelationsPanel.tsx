"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type RelatedClaim = {
  id: string;
  title: string;
  year: number | null;
  sourceUrl: string | null;
  status: string;
  verificationStatus: string | null;
  isStub: boolean;
};

type RelationGroup = {
  cites: RelatedClaim[];
  cited_by: RelatedClaim[];
  related: RelatedClaim[];
};

type Section = {
  key: "cited_by" | "related" | "cites";
  label: string;
  hint: string;
  items: RelatedClaim[];
};

function RelatedItem({ item }: { item: RelatedClaim }) {
  const titleEl = item.isStub && item.sourceUrl ? (
    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
      className="text-gray-200 hover:text-white hover:underline">
      {item.title}
    </a>
  ) : (
    <Link href={`/claims/${item.id}`}
      className="text-gray-200 hover:text-white hover:underline">
      {item.title}
    </Link>
  );

  return (
    <li className="border-b border-gray-800/50 last:border-b-0 py-2.5">
      <p className="text-sm leading-snug line-clamp-3">{titleEl}</p>
      <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px]">
        {item.year !== null && (
          <span className="text-gray-500">{item.year}</span>
        )}
        {item.isStub ? (
          <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-medium">stub</span>
        ) : item.verificationStatus === "VERIFIED" ? (
          <span className="px-1.5 py-0.5 rounded bg-green-950 text-green-400 font-medium">VERIFIED</span>
        ) : null}
        {item.sourceUrl && !item.isStub && (
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-300">
            ↗
          </a>
        )}
      </div>
    </li>
  );
}

function Section({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  if (section.items.length === 0) return null;
  return (
    <div className="border-b border-gray-800 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2.5 text-left hover:bg-gray-900/40 transition-colors px-1"
      >
        <span>
          <span className="text-sm text-gray-200 font-medium">{section.label}</span>
          <span className="ml-2 text-xs text-gray-600">({section.items.length})</span>
          <span className="ml-2 text-[10px] text-gray-600 italic">{section.hint}</span>
        </span>
        <span className="text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="pl-1 pr-1 pb-2">
          {section.items.map(item => <RelatedItem key={`${section.key}-${item.id}`} item={item} />)}
        </ul>
      )}
    </div>
  );
}

export default function ClaimRelationsPanel({ claimId }: { claimId: string }) {
  const [data, setData] = useState<RelationGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>("cited_by");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/claims/${claimId}/relations`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: RelationGroup) => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [claimId]);

  if (loading) return null;
  if (error) return null;
  if (!data) return null;

  const total = data.cites.length + data.cited_by.length + data.related.length;
  if (total === 0) return null;

  const sections: Section[] = [
    {
      key: "cited_by",
      label: `Later Work`,
      hint: "papers that cite this one",
      items: data.cited_by,
    },
    {
      key: "related",
      label: `Related Papers`,
      hint: "topically similar",
      items: data.related,
    },
    {
      key: "cites",
      label: `References`,
      hint: "papers this one cites",
      items: data.cites,
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Citation graph
        <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">
          via OpenAlex
        </span>
      </h2>
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-2">
        {sections.map(s => (
          <Section
            key={s.key}
            section={s}
            open={openKey === s.key}
            onToggle={() => setOpenKey(prev => (prev === s.key ? null : s.key))}
          />
        ))}
      </div>
    </section>
  );
}
