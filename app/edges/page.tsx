"use client";
import { useEffect, useState } from "react";
import { isReadOnly } from "@/lib/isReadOnly";

type Claim = { id: string; text: string };
type Source = { id: string; name: string };
type EdgeRevision = { newScore: number };
type Edge = {
  id: string;
  type: string;
  evidenceType: string;
  source: Source;
  claim: Claim;
  revisions: EdgeRevision[];
  createdAt: string;
};

const EDGE_COLORS: Record<string, string> = {
  FOR: "bg-green-900 text-green-300",
  AGAINST: "bg-red-900 text-red-300",
  CITES: "bg-blue-900 text-blue-300",
  RETRACTS: "bg-orange-900 text-orange-300",
  CORRECTED: "bg-yellow-900 text-yellow-300",
};

export default function EdgesPage() {
  const [edges, setEdges] = useState<Edge[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [claimId, setClaimId] = useState("");
  const [type, setType] = useState("FOR");
  const [evidenceType, setEvidenceType] = useState("EVIDENTIARY");
  const [score, setScore] = useState(50);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [edgesRes, claimsRes, sourcesRes] = await Promise.all([
      fetch("/api/edges"),
      fetch("/api/claims"),
      fetch("/api/sources"),
    ]);
    setEdges(await edgesRes.json());
    setClaims(await claimsRes.json());
    setSources(await sourcesRes.json());
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/edges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, claimId, type, evidenceType, score, reason }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create edge");
      return;
    }
    setSourceId("");
    setClaimId("");
    setType("FOR");
    setEvidenceType("EVIDENTIARY");
    setScore(50);
    setReason("");
    load();
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-white">Edges</h2>
      {isReadOnly() && <p className="text-sm text-gray-500 italic">Editing is disabled in this deployment.</p>}
      {!isReadOnly() && (

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-medium text-gray-300">Link a source to a claim</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Source</label>
            <select
              value={sourceId}
              onChange={e => setSourceId(e.target.value)}
              required
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              <option value="">Select source…</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Claim</label>
            <select
              value={claimId}
              onChange={e => setClaimId(e.target.value)}
              required
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              <option value="">Select claim…</option>
              {claims.map(c => <option key={c.id} value={c.id}>{c.text}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Edge type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              <option value="FOR">FOR — asserts the claim</option>
              <option value="AGAINST">AGAINST — contests the claim</option>
              <option value="CITES">CITES — references without position</option>
              <option value="RETRACTS">RETRACTS — retracts prior assertion</option>
              <option value="CORRECTED">CORRECTED — updates prior assertion</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Evidence score: <span className="text-white font-medium">{score}</span>/100
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={e => setScore(Number(e.target.value))}
              className="w-full accent-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Evidence type</label>
          <div className="flex gap-2">
            {(["EVIDENTIARY", "PROCEDURAL", "ARGUMENTATIVE"] as const).map(et => (
              <button
                key={et}
                type="button"
                onClick={() => setEvidenceType(et)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  evidenceType === et
                    ? "bg-white text-gray-950 border-white font-medium"
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
              >
                {et}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Reason (optional)</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why this score?"
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 transition-colors"
        >
          Add edge
        </button>
      </form>
      )}

      <div className="space-y-2">
        {edges.map(e => (
          <div key={e.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs text-gray-500">{e.source.name}</p>
                <p className="text-sm text-white">{e.claim.text}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EDGE_COLORS[e.type]}`}>
                  {e.type}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
                  {e.evidenceType}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {e.revisions[0]?.newScore ?? "—"}/100
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
