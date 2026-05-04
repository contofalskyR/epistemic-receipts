"use client";
import { useEffect, useState } from "react";
import { formatAge, formatEmerged, type EmergedPrecision } from "@/lib/claimAge";
import { isReadOnly } from "@/lib/isReadOnly";

type Claim = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  parentClaimId: string | null;
  createdAt: string;
  claimEmergedAt: string | null;
  claimEmergedPrecision: EmergedPrecision | null;
};

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [text, setText] = useState("");
  const [parentClaimId, setParentClaimId] = useState("");
  const [claimEmergedAt, setClaimEmergedAt] = useState("");
  const [claimEmergedPrecision, setClaimEmergedPrecision] = useState<EmergedPrecision>("MONTH");
  const [claimType, setClaimType] = useState("EMPIRICAL");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/claims");
    setClaims(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        parentClaimId: parentClaimId || null,
        claimEmergedAt: claimEmergedAt || null,
        claimEmergedPrecision: claimEmergedAt ? claimEmergedPrecision : null,
        claimType,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create claim");
      return;
    }
    setText("");
    setParentClaimId("");
    setClaimEmergedAt("");
    setClaimEmergedPrecision("MONTH");
    setClaimType("EMPIRICAL");
    load();
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-white">Claims</h2>

      {isReadOnly() ? (
        <p className="text-sm text-gray-500 italic">Editing is disabled in this deployment.</p>
      ) : (
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-medium text-gray-300">Add a claim</h3>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Claim text</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            required
            rows={3}
            placeholder="e.g. SARS-CoV-2 originated from a laboratory rather than a natural zoonotic spillover"
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Parent claim (optional)</label>
          <select
            value={parentClaimId}
            onChange={e => setParentClaimId(e.target.value)}
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            <option value="">None — top-level claim</option>
            {claims.map(c => (
              <option key={c.id} value={c.id}>{c.text}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Claim emerged (optional)</label>
            <input
              type="date"
              value={claimEmergedAt}
              onChange={e => setClaimEmergedAt(e.target.value)}
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Precision</label>
            <select
              value={claimEmergedPrecision}
              onChange={e => setClaimEmergedPrecision(e.target.value as EmergedPrecision)}
              disabled={!claimEmergedAt}
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500 disabled:opacity-40"
            >
              <option value="YEAR">Year</option>
              <option value="QUARTER">Quarter</option>
              <option value="MONTH">Month</option>
              <option value="DAY">Day</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Claim type</label>
          <div className="flex flex-wrap gap-2">
            {(["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"] as const).map(ct => (
              <button
                key={ct}
                type="button"
                onClick={() => setClaimType(ct)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  claimType === ct
                    ? "bg-white text-gray-950 border-white font-medium"
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
              >
                {ct}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {claimType === "EMPIRICAL" && "Testable against evidence"}
            {claimType === "INSTITUTIONAL" && "Status conferred by an institution"}
            {claimType === "INTERPRETIVE" && "Framing or meaning — never fully resolves"}
            {claimType === "HYBRID" && "Mix of empirical and interpretive"}
          </p>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 transition-colors"
        >
          Add claim
        </button>
      </form>
      )}

      <div className="space-y-2">
        {claims.map(c => (
          <div key={c.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-white">{c.text}</p>
              <div className="shrink-0 flex items-center gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.currentStatus === "HARD_FACT" ? "bg-green-900 text-green-300" :
                  c.currentStatus === "NEVER_RESOLVES" ? "bg-gray-700 text-gray-400" :
                  "bg-yellow-900 text-yellow-300"
                }`}>
                  {c.currentStatus}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
                  {c.claimType}
                </span>
              </div>
            </div>
            {c.claimEmergedAt && c.claimEmergedPrecision && (
              <p className="text-xs text-gray-500 mt-1">
                {formatAge(c.claimEmergedAt, c.claimEmergedPrecision)} · emerged {formatEmerged(c.claimEmergedAt, c.claimEmergedPrecision)}
              </p>
            )}
            {c.parentClaimId && (
              <p className="text-xs text-gray-500 mt-0.5">
                sub-claim of {claims.find(p => p.id === c.parentClaimId)?.text ?? c.parentClaimId}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
