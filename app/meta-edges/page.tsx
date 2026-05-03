"use client";
import { useEffect, useState } from "react";

type Source = { id: string; name: string };
type EdgeOption = {
  id: string;
  type: string;
  source: { name: string };
  claim: { id: string; text: string };
};
type MetaEdge = {
  id: string;
  type: string;
  reason: string | null;
  createdAt: string;
  actorSource: { name: string };
  targetEdge: {
    type: string;
    source: { name: string };
    claim: { text: string };
  };
};

const META_TYPES = [
  { value: "SUPPRESSED", label: "SUPPRESSED", desc: "Actor blocked, hid, or removed the target edge (Solicitor General hiding evidence; platform removing posts)" },
  { value: "AMPLIFIED",  label: "AMPLIFIED",  desc: "Actor boosted the target edge's visibility (algorithmic amplification, official endorsement)" },
  { value: "LABELED",    label: "LABELED",    desc: "Actor applied a label to the target edge (fact-check labels, content warnings)" },
  { value: "DEMOTED",    label: "DEMOTED",    desc: "Actor reduced the target edge's visibility without removing it (algorithmic demotion, search deranking)" },
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
  const [sources, setSources] = useState<Source[]>([]);
  const [edges, setEdges] = useState<EdgeOption[]>([]);
  const [metaEdges, setMetaEdges] = useState<MetaEdge[]>([]);

  const [actorSourceId, setActorSourceId] = useState("");
  const [targetEdgeId, setTargetEdgeId] = useState("");
  const [type, setType] = useState<string>("SUPPRESSED");
  const [happenedAt, setHappenedAt] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [sr, er, mr] = await Promise.all([
      fetch("/api/sources"),
      fetch("/api/edges"),
      fetch("/api/meta-edges"),
    ]);
    setSources(await sr.json());
    setEdges(await er.json());
    setMetaEdges(await mr.json());
  }

  useEffect(() => { load(); }, []);

  // Derive claimId from selected target edge
  const selectedEdge = edges.find(e => e.id === targetEdgeId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedEdge) { setError("Select a target edge"); return; }

    const res = await fetch("/api/meta-edges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorSourceId,
        targetEdgeId,
        claimId: selectedEdge.claim.id,
        type,
        reason: reason || null,
        createdAt: happenedAt || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to create meta-edge");
      return;
    }
    setActorSourceId("");
    setTargetEdgeId("");
    setType("SUPPRESSED");
    setHappenedAt("");
    setReason("");
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">Meta-edges</h2>
        <p className="text-xs text-gray-500 mt-1">
          Actions taken on edges — suppression, amplification, labeling, demotion.
          This is not about disagreeing with an edge; it&apos;s about an actor doing something to its visibility or standing.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-lg border border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-300">Record a meta-event</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Actor (who did this)</label>
            <select value={actorSourceId} onChange={e => setActorSourceId(e.target.value)} required
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500">
              <option value="">Select source…</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Target edge (what was acted upon)</label>
            <select value={targetEdgeId} onChange={e => setTargetEdgeId(e.target.value)} required
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500">
              <option value="">Select edge…</option>
              {edges.map(e => (
                <option key={e.id} value={e.id}>
                  {e.source.name} → {e.claim.text.slice(0, 50)}… [{e.type}]
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-2">Action type</label>
          <div className="space-y-2">
            {META_TYPES.map(mt => (
              <label key={mt.value}
                className={`flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                  type === mt.value ? "border-gray-500 bg-gray-800/60" : "border-gray-800 hover:border-gray-700"
                }`}>
                <input type="radio" name="type" value={mt.value}
                  checked={type === mt.value} onChange={() => setType(mt.value)}
                  className="mt-0.5 accent-white shrink-0" />
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[mt.value]}`}>{mt.label}</span>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{mt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">When did this happen?</label>
            <input type="date" value={happenedAt} onChange={e => setHappenedAt(e.target.value)}
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500" />
            <p className="text-[10px] text-gray-700 mt-1">When the suppression/amplification occurred — not today&apos;s date</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Reason (optional)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Why this action was taken, or what evidence exists that it happened…"
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500" />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button type="submit"
          className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 transition-colors">
          Record meta-event
        </button>
      </form>

      {/* List */}
      <div className="space-y-2">
        {metaEdges.length === 0 && (
          <p className="text-gray-600 text-sm italic">No meta-events recorded yet.</p>
        )}
        {metaEdges.map(me => (
          <div key={me.id} className="rounded-lg border border-gray-800 px-4 py-3">
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
    </div>
  );
}
