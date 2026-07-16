export const revalidate = 3600;

import { prisma } from "@/lib/prisma";
import { ScatterPlot, Dim1Histogram, type IdeologyPoint } from "./IdeologyClient";
import PageHero from "@/app/components/PageHero";

export const metadata = {
  title: "Ideology Analysis — Epistemic Receipts",
  description: "DW-NOMINATE ideology scores for US Congress members, via Voteview.",
};

type CongressRow = { congress: number; chamber: string; count: bigint };

export default async function IdeologyAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ congress?: string; chamber?: string }>;
}) {
  const sp = await searchParams;

  // Available congress+chamber combinations
  const available = await prisma.$queryRaw<CongressRow[]>`
    SELECT congress, chamber, COUNT(*)::bigint as count
    FROM "MemberIdeology"
    WHERE "nominateDim1" IS NOT NULL
    GROUP BY congress, chamber
    ORDER BY congress DESC, chamber
  `;

  if (available.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 mt-8">
          No DW-NOMINATE scores available yet. The MemberIdeology ingest is in progress.
        </p>
      </div>
    );
  }

  const totalRows = available.reduce((s, r) => s + Number(r.count), 0);
  const maxCongress = available[0].congress;

  const congress = Number.parseInt(sp.congress ?? String(maxCongress), 10) || maxCongress;
  const chamberOptions = available
    .filter((r) => r.congress === congress)
    .map((r) => r.chamber);
  const chamber = sp.chamber ?? chamberOptions[0] ?? "House";

  const rawPoints = await prisma.$queryRaw<
    { dim1: number; dim2: number | null; party: string | null; name: string; state: string | null }[]
  >`
    SELECT
      "nominateDim1" AS dim1,
      "nominateDim2" AS dim2,
      party,
      "memberName" AS name,
      "stateAbbrev" AS state
    FROM "MemberIdeology"
    WHERE congress = ${congress}
      AND chamber = ${chamber}
      AND "nominateDim1" IS NOT NULL
    ORDER BY "nominateDim1"
  `;

  const points: IdeologyPoint[] = rawPoints.map((r) => ({
    dim1: r.dim1,
    dim2: r.dim2 ?? 0,
    party: r.party ?? "?",
    name: r.name,
    state: r.state,
  }));

  const chamberRow = available.find((r) => r.congress === congress && r.chamber === chamber);
  const totalMembersInCongress = Number(chamberRow?.count ?? 0);

  // Summary stats by party
  type PartyStats = { party: string | null; n: bigint; avgdim1: number | null; mindim1: number | null; maxdim1: number | null };
  const partyStats = await prisma.$queryRaw<PartyStats[]>`
    SELECT
      party,
      COUNT(*)::bigint AS n,
      AVG("nominateDim1") AS avgdim1,
      MIN("nominateDim1") AS mindim1,
      MAX("nominateDim1") AS maxdim1
    FROM "MemberIdeology"
    WHERE congress = ${congress}
      AND chamber = ${chamber}
      AND "nominateDim1" IS NOT NULL
    GROUP BY party
    ORDER BY AVG("nominateDim1")
  `;

  function ordinal(n: number): string {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  }

  const PARTY_NAMES: Record<string, string> = {
    "100": "Democrat", "200": "Republican", "328": "Independent",
    "329": "Independent Democrat", "522": "Independent",
  };
  function partyLabel(code: string | null): string {
    return code ? (PARTY_NAMES[code] ?? code) : "?";
  }

  function fmt(v: number | null): string {
    if (v === null) return "—";
    return v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHero
        eyebrow="Analysis · Ideology"
        title="Congressional Ideology"
        lede="DW-NOMINATE scores place members on a −1 (liberal) to +1 (conservative) economic axis, estimated from roll-call voting patterns."
      />

      {/* Congress / chamber picker */}
      <div className="flex flex-wrap gap-3 items-center">
        <form method="get" className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-mono text-gray-600 uppercase tracking-widest">Congress</span>
            <select
              name="congress"
              defaultValue={String(congress)}
              className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
            >
              {[...new Set(available.map((r) => r.congress))].map((c) => (
                <option key={c} value={String(c)}>
                  {ordinal(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-mono text-gray-600 uppercase tracking-widest">Chamber</span>
            <select
              name="chamber"
              defaultValue={chamber}
              className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
            >
              {chamberOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded border border-gray-700 transition-colors"
          >
            Update
          </button>
        </form>
        <span className="text-xs text-gray-600 font-mono ml-auto">
          {totalRows.toLocaleString()} total member-congress scores in DB
        </span>
      </div>

      {/* Party summary table */}
      {partyStats.length > 0 && (
        <section>
          <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">
            Party summary — {ordinal(congress)} Congress · {chamber}
          </h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800 text-gray-600">
                  <th className="text-left px-4 py-2">Party</th>
                  <th className="text-right px-4 py-2">Members</th>
                  <th className="text-right px-4 py-2">Avg Dim 1</th>
                  <th className="text-right px-4 py-2">Min</th>
                  <th className="text-right px-4 py-2">Max</th>
                </tr>
              </thead>
              <tbody>
                {partyStats.map((s) => (
                  <tr key={s.party ?? "_"} className="border-b border-gray-800/50 text-gray-400 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-200">{partyLabel(s.party)}</td>
                    <td className="px-4 py-2 text-right">{Number(s.n).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{fmt(s.avgdim1)}</td>
                    <td className="px-4 py-2 text-right">{fmt(s.mindim1)}</td>
                    <td className="px-4 py-2 text-right">{fmt(s.maxdim1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            DW-NOMINATE via Voteview · {points.length.toLocaleString()} of {totalMembersInCongress.toLocaleString()} members with scores shown
          </p>
        </section>
      )}

      {/* Histogram */}
      <section>
        <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">
          Dim 1 distribution — {ordinal(congress)} Congress · {chamber}
        </h2>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <Dim1Histogram points={points} congress={congress} chamber={chamber} />
        </div>
      </section>

      {/* Scatter plot */}
      <section>
        <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">
          Dim 1 × Dim 2 scatter — {ordinal(congress)} Congress · {chamber}
        </h2>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <ScatterPlot
            points={points}
            congress={congress}
            chamber={chamber}
            totalMembers={totalMembersInCongress}
          />
        </div>
      </section>

      {/* Attribution */}
      <section className="text-xs text-gray-600 border-t border-gray-800 pt-4">
        <p>
          <strong className="text-gray-500">Source:</strong> Lewis, Jeffrey B., Keith Poole, Howard Rosenthal, Adam Boche,
          Aaron Rudkin, and Luke Sonnet (2024).{" "}
          <em>Voteview: Congressional Roll-Call Votes Database.</em>{" "}
          <a href="https://voteview.com" target="_blank" rel="noreferrer" className="hover:text-gray-400 underline">
            https://voteview.com
          </a>
          . DW-NOMINATE scores estimated from all available roll-call votes for each Congress.
        </p>
        <p className="mt-2">
          Dim 1 (economic axis): negative scores indicate more liberal voting patterns (favoring redistribution,
          expanded government); positive scores indicate more conservative patterns. Dim 2 (social/racial axis)
          was more predictive in the pre-civil-rights era and is secondary in modern Congresses.
        </p>
      </section>
    </div>
  );
}
