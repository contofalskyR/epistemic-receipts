"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const FOLLOWUP_TYPES = ["OUTCOME", "STATUS_UPDATE", "SUPERSEDED_BY", "REVERSED", "EXPANDED"] as const;
type FollowUpType = (typeof FOLLOWUP_TYPES)[number];

type FollowUpClaim = {
  id: string;
  text: string;
  year: number | null;
  ingestedBy: string;
  sourceUrl: string | null;
  verificationStatus: string | null;
  relationType: FollowUpType;
  context: Record<string, unknown> | null;
};

type FollowUpGroup = Record<FollowUpType, FollowUpClaim[]>;

const SECTION_META: Record<FollowUpType, { label: string; hint: string; badgeClass: string }> = {
  OUTCOME: {
    label: "Led to",
    hint: "what came of this",
    badgeClass: "bg-emerald-950 text-emerald-400 border-emerald-900",
  },
  STATUS_UPDATE: {
    label: "Status update",
    hint: "later developments",
    badgeClass: "bg-sky-950 text-sky-400 border-sky-900",
  },
  SUPERSEDED_BY: {
    label: "Superseded by",
    hint: "replaced by a later record",
    badgeClass: "bg-amber-950 text-amber-400 border-amber-900",
  },
  REVERSED: {
    label: "Retracted",
    hint: "later overturned, retracted, or revoked",
    badgeClass: "bg-rose-950 text-rose-400 border-rose-900",
  },
  EXPANDED: {
    label: "Expanded by",
    hint: "scope broadened by a later record",
    badgeClass: "bg-violet-950 text-violet-400 border-violet-900",
  },
};

function FollowUpRow({ item }: { item: FollowUpClaim }) {
  const meta = SECTION_META[item.relationType];
  return (
    <li className="border-b border-gray-800/50 last:border-b-0 py-2.5">
      <div className="flex items-start gap-2">
        <span
          className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide ${meta.badgeClass}`}
          title={meta.hint}
        >
          {meta.label}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/claims/${item.id}`}
            prefetch={false}
            className="text-sm leading-snug text-gray-200 hover:text-white hover:underline line-clamp-3"
          >
            {item.text}
          </Link>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] text-gray-500">
            {item.year !== null && <span>{item.year}</span>}
            <span className="text-gray-600">via {item.ingestedBy}</span>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-300"
                title="open source"
              >
                ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function WhatHappenedNextPanel({
  claimId,
  onHasReversed,
}: {
  claimId: string;
  onHasReversed?: (v: boolean) => void;
}) {
  const [data, setData] = useState<FollowUpGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/claims/${claimId}/followups`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: FollowUpGroup | null) => {
        if (!cancelled) {
          setData(d);
          if (d && d.REVERSED?.length > 0) onHasReversed?.(true);
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [claimId, onHasReversed]);

  if (!data) return null;

  const total = FOLLOWUP_TYPES.reduce((acc, k) => acc + data[k].length, 0);
  if (total === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        What happened next
        <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">
          {total} follow-up{total === 1 ? "" : "s"}
        </span>
      </h2>
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-2">
        <ul className="pl-1 pr-1">
          {FOLLOWUP_TYPES.flatMap(k => data[k]).map(item => (
            <FollowUpRow key={`${item.relationType}-${item.id}`} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}
