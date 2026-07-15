import { prisma } from "@/lib/prisma";

type IdeologyRow = {
  congress: number;
  chamber: string;
  nominateDim1: number | null;
  nominateDim2: number | null;
  party: string | null;
  stateAbbrev: string | null;
};

type PeerStats = {
  partyMedian: number | null;
  congressMedian: number | null;
};

function pct(dim1: number): number {
  // map -1..+1 to 0..100 for CSS positioning
  return Math.round(((dim1 + 1) / 2) * 100);
}

function dim1Label(v: number): string {
  if (v <= -0.6) return "Strongly liberal";
  if (v <= -0.3) return "Liberal";
  if (v < 0.3) return "Moderate";
  if (v < 0.6) return "Conservative";
  return "Strongly conservative";
}

function fmt(v: number | null): string {
  if (v === null) return "—";
  return v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3);
}

function EconomicBar({ dim1 }: { dim1: number }) {
  const pos = pct(dim1);
  return (
    <div className="relative w-full">
      <div
        className="h-2 w-full rounded-full"
        style={{
          background: "linear-gradient(to right, #3b82f6, #6b7280, #ef4444)",
        }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-white shadow"
        style={{ left: `calc(${pos}% - 6px)` }}
      />
      <div className="flex justify-between mt-1 text-[9px] font-mono text-gray-600 select-none">
        <span>−1 Liberal</span>
        <span>0</span>
        <span>+1 Conservative</span>
      </div>
    </div>
  );
}

export default async function IdeologySection({ memberId }: { memberId: string }) {
  const rows = await prisma.memberIdeology.findMany({
    where: { bioguideId: memberId },
    orderBy: { congress: "desc" },
    select: {
      congress: true,
      chamber: true,
      nominateDim1: true,
      nominateDim2: true,
      party: true,
      stateAbbrev: true,
    },
  });

  if (rows.length === 0) return null;

  const latest = rows[0] as IdeologyRow;
  if (latest.nominateDim1 === null) return null;

  // Peer context: median dim1 for same party + congress, and full congress
  const peerStats = await prisma.$queryRaw<PeerStats[]>`
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "nominateDim1")
        FILTER (WHERE "party" = ${latest.party} AND "nominateDim1" IS NOT NULL)
        AS "partyMedian",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "nominateDim1")
        FILTER (WHERE "nominateDim1" IS NOT NULL)
        AS "congressMedian"
    FROM "MemberIdeology"
    WHERE congress = ${latest.congress}
      AND chamber = ${latest.chamber}
  `;

  const peer = peerStats[0] ?? { partyMedian: null, congressMedian: null };

  return (
    <section>
      <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">
        DW-NOMINATE ideology
      </h2>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
        {/* Score headline */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[120px]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              Economic axis (Dim 1)
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-100 font-mono">
              {fmt(latest.nominateDim1)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{dim1Label(latest.nominateDim1)}</div>
          </div>
          {latest.nominateDim2 !== null && (
            <div className="flex-1 min-w-[120px]">
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                Social axis (Dim 2)
              </div>
              <div className="mt-1 text-2xl font-semibold text-gray-100 font-mono">
                {fmt(latest.nominateDim2)}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-[120px]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              Congress
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-100 font-mono">
              {latest.congress}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{latest.chamber}</div>
          </div>
        </div>

        {/* Visual bar */}
        <EconomicBar dim1={latest.nominateDim1} />

        {/* Peer context */}
        {(peer.partyMedian !== null || peer.congressMedian !== null) && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-400 border-t border-gray-800 pt-3">
            {peer.partyMedian !== null && (
              <span>
                <span className="text-gray-500 font-mono">{latest.party ?? "party"} median ({latest.congress}th):</span>{" "}
                <span className="font-mono">{fmt(peer.partyMedian as number)}</span>
              </span>
            )}
            {peer.congressMedian !== null && (
              <span>
                <span className="text-gray-500 font-mono">Full chamber median:</span>{" "}
                <span className="font-mono">{fmt(peer.congressMedian as number)}</span>
              </span>
            )}
          </div>
        )}

        {/* History if multiple congresses */}
        {rows.length > 1 && (
          <details className="border-t border-gray-800 pt-3">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none">
              Score history ({rows.length} congresses)
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="text-xs font-mono w-full">
                <thead>
                  <tr className="text-gray-600 border-b border-gray-800">
                    <th className="text-left pb-1 pr-4">Congress</th>
                    <th className="text-left pb-1 pr-4">Chamber</th>
                    <th className="text-left pb-1 pr-4">Dim 1</th>
                    <th className="text-left pb-1">Dim 2</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as IdeologyRow[]).map((r) => (
                    <tr key={`${r.congress}-${r.chamber}`} className="border-b border-gray-800/50 text-gray-400">
                      <td className="py-1 pr-4">{r.congress}</td>
                      <td className="py-1 pr-4">{r.chamber}</td>
                      <td className="py-1 pr-4">{fmt(r.nominateDim1)}</td>
                      <td className="py-1">{fmt(r.nominateDim2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* Attribution */}
        <p className="text-[10px] text-gray-600 border-t border-gray-800 pt-2">
          DW-NOMINATE via Voteview (Lewis et al.) ·{" "}
          <a
            href="https://voteview.com/about"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-400 transition-colors underline"
          >
            methodology
          </a>
          {" "}· coverage: members with a bioguide ID in the{" "}
          <a
            href="https://voteview.com/static/data/out/members/HSall_members.csv"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-400 transition-colors underline"
          >
            HSall_members.csv
          </a>{" "}
          dataset
        </p>
      </div>
    </section>
  );
}
