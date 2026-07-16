"use client";

import { useEffect, useRef, useState } from "react";

type DefectionRow = {
  rollcallId: string | null;
  date: string;
  memberVote: string;
  partyMajority: string;
  partyYes: number;
  partyNo: number;
  billName: string;
};

type PanelData = {
  bioguideId: string;
  ideology: {
    memberName: string;
    party: string | null;
    stateAbbrev: string | null;
    nominateDim1: number | null;
    nominateDim2: number | null;
  } | null;
  cohesion: {
    pct: number | null;
    coveredRollcalls: number;
    withParty: number;
    defectionCount: number;
  };
  defections: DefectionRow[];
  datasetRollcalls: number;
};

const PARTY_NAMES: Record<string, string> = {
  "100": "Democrat", "200": "Republican", "328": "Independent",
  "329": "Independent Democrat", "522": "Independent",
};
function partyLabel(code: string | null | undefined): string {
  return code ? (PARTY_NAMES[code] ?? code) : "?";
}

type Props = {
  bioguideId: string | null;
  congress: number;
  chamber: string;
  onClose: () => void;
};

export function IdeologyPanel({ bioguideId, congress, chamber, onClose }: Props) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bioguideId) return;
    setData(null);
    setError(false);
    setLoading(true);
    fetch(`/api/analysis/ideology/member?bioguideId=${bioguideId}&congress=${congress}&chamber=${encodeURIComponent(chamber)}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [bioguideId, congress, chamber]);

  // Close on backdrop click
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!bioguideId) return null;

  const dim1 = data?.ideology?.nominateDim1;
  const dim1Str = dim1 != null ? (dim1 >= 0 ? `+${dim1.toFixed(3)}` : dim1.toFixed(3)) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — side on ≥768px, bottom sheet on mobile */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Member ideology detail"
        className="fixed z-50 bg-gray-950 border-gray-800 overflow-y-auto
          inset-x-0 bottom-0 max-h-[80vh] rounded-t-xl border-t
          md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:max-h-none md:w-[420px] md:rounded-none md:border-t-0 md:border-l"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-5 py-4 flex items-start justify-between">
          <div>
            {loading && <span className="text-sm text-gray-500">Loading…</span>}
            {error && <span className="text-sm text-red-400">Failed to load.</span>}
            {data?.ideology && (
              <>
                <div className="text-base font-semibold text-gray-100">{data.ideology.memberName}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {data.ideology.stateAbbrev} · {partyLabel(data.ideology.party)}
                  {dim1Str && (
                    <span className="ml-2 font-mono text-gray-400">Dim 1: {dim1Str}</span>
                  )}
                </div>
              </>
            )}
            {data && !data.ideology && !loading && (
              <span className="text-sm text-gray-500">No DW-NOMINATE score for this congress/chamber.</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-600 hover:text-gray-300 text-xl leading-none mt-0.5"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {data && (
          <div className="px-5 py-4 space-y-5 text-sm">
            {/* Party cohesion */}
            <section>
              <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">
                Party cohesion
              </div>
              {data.cohesion.coveredRollcalls === 0 ? (
                <p className="text-xs text-gray-600 italic">
                  No defection data — member not found in {congress}th Congress{" "}
                  {chamber} roll-calls with party breakdown.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-100">
                      {data.cohesion.pct != null ? `${data.cohesion.pct}%` : "—"}
                    </span>
                    <span className="text-xs text-gray-500">
                      with party majority across {data.cohesion.coveredRollcalls} covered roll-calls
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">
                    {data.cohesion.defectionCount} defection{data.cohesion.defectionCount !== 1 ? "s" : ""} in covered roll-calls.
                    Present and Not Voting excluded.
                  </p>
                </>
              )}
            </section>

            {/* Defection table */}
            {data.cohesion.coveredRollcalls > 0 && (
              <section>
                <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">
                  Recent defections ({Math.min(data.defections.length, 10)} of {data.cohesion.defectionCount})
                </div>
                {data.defections.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">
                    No defections in {data.cohesion.coveredRollcalls} covered roll-calls.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.defections.map((d, i) => (
                      <div key={i} className="rounded border border-gray-800 bg-gray-900/60 px-3 py-2">
                        <div className="text-xs text-gray-300 leading-snug line-clamp-2">{d.billName}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] font-mono">
                          <span className="text-gray-500">{d.date}</span>
                          <span className="text-amber-400">
                            voted {d.memberVote} · party majority {d.partyMajority}{" "}
                            <span className="text-gray-600">
                              ({d.partyYes}–{d.partyNo})
                            </span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-gray-700 mt-2">
                  Ordered by recency. Covers {data.datasetRollcalls} US roll-calls with recorded party breakdowns (113th–119th Congresses).
                  <br />
                  Placement is estimated from this member{"'"}s full voting record — defections are where individual position shows through party discipline, not the input to the score.
                </p>
              </section>
            )}

            {/* Footer links */}
            <div className="border-t border-gray-800 pt-4 flex flex-wrap gap-3">
              <a
                href={`/members/${bioguideId}`}
                className="text-xs text-amber-500/80 hover:text-amber-400 underline"
              >
                Full member page →
              </a>
              <a
                href={`/members/${bioguideId}#ideology`}
                className="text-xs text-gray-500 hover:text-gray-300 underline"
              >
                Score history →
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
