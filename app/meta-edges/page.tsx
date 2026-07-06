"use client";
import { useEffect, useState } from "react";

type MetaEdge = {
  id: string;
  type: string;
  reason: string | null;
  createdAt: string;
  actorSource: { name: string };
  targetEdge: {
    type: string;
    source: { name: string };
    claim: { id?: string; text: string };
  };
};

// The four documented action types. Kept in sync with the MetaEdge schema.
const META_TYPES = [
  { value: "SUPPRESSED", label: "SUPPRESSED", desc: "An actor blocked, hid, or removed evidence — a Solicitor General omitting a report from a brief, an industry body burying a study." },
  { value: "AMPLIFIED",  label: "AMPLIFIED",  desc: "An actor boosted evidence beyond its own reach — official endorsement, coordinated promotion, algorithmic amplification." },
  { value: "LABELED",    label: "LABELED",    desc: "An actor applied a formal label to evidence — a fact-check verdict, a content warning, a congressional counter-labeling." },
  { value: "DEMOTED",    label: "DEMOTED",    desc: "An actor reduced evidence's visibility without removing it — search deranking, algorithmic demotion." },
] as const;

const TYPE_BADGE: Record<string, string> = {
  SUPPRESSED: "bg-red-900 text-red-300",
  AMPLIFIED:  "bg-green-900 text-green-300",
  LABELED:    "bg-amber-900 text-amber-300",
  DEMOTED:    "bg-gray-700 text-gray-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function MetaEdgesPage() {
  const [metaEdges, setMetaEdges] = useState<MetaEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/meta-edges")
      .then(r => r.json())
      .then(data => setMetaEdges(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest mb-2">Meta-edges</p>
        <h1 className="text-2xl font-semibold text-white">Suppression &amp; Amplification</h1>
        <p className="text-sm text-gray-400 mt-3 leading-relaxed">
          Most of this site records what sources say about claims. This page records something
          rarer: documented actions taken on the evidence itself — an actor suppressing,
          amplifying, labeling, or demoting a source-claim link. Not disagreement with the
          evidence; interference with its visibility or standing.
        </p>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          Every entry is hand-curated and names the actor, the target evidence, the date the
          action happened, and the documentation that proves it happened — an internal memo,
          a court finding, a released archive.
        </p>
      </div>

      {/* Action-type legend */}
      <div className="grid sm:grid-cols-2 gap-2">
        {META_TYPES.map(mt => (
          <div key={mt.value} className="rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[mt.value]}`}>{mt.label}</span>
            <p className="text-xs text-gray-500 mt-1.5 leading-snug">{mt.desc}</p>
          </div>
        ))}
      </div>

      {/* Record */}
      <div className="space-y-2">
        {loading && <p className="text-gray-600 text-sm italic">Loading the record…</p>}
        {!loading && metaEdges.length === 0 && (
          <p className="text-gray-600 text-sm italic">No meta-events recorded yet.</p>
        )}
        {metaEdges.map(me => (
          <div key={me.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[me.type]}`}>{me.type}</span>
                  <span className="text-xs text-gray-400">by {me.actorSource.name}</span>
                </div>
                <p className="text-xs text-gray-500">
                  on{" "}
                  <span className="text-gray-300">{me.targetEdge.source.name}</span>
                  <span className="text-gray-600"> [{me.targetEdge.type}]</span>
                  {" → "}
                  <span className="text-gray-500">{me.targetEdge.claim.text.slice(0, 60)}…</span>
                </p>
                {me.reason && <p className="text-xs text-gray-600 leading-snug">{me.reason}</p>}
              </div>
              <span className="text-xs text-gray-600 shrink-0">{formatDate(me.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 leading-relaxed">
        Why this matters: a settling curve shows how a claim&apos;s status moved. Meta-edges show
        when someone put a thumb on the scale — the part of the record the record itself tends
        to omit. See{" "}
        <a href="/corrections" className="underline hover:text-gray-400 transition-colors">Corrections</a>{" "}
        for the same discipline applied to this site&apos;s own pipelines.
      </p>
    </div>
  );
}
