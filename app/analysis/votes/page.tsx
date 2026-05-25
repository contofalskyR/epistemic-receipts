export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  buildVoteAnalysis,
  type BillRow,
  type GlobalRow,
  type PartyRow,
} from "@/lib/voteAnalysis";

function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

function BillCell({ row }: { row: BillRow | GlobalRow }) {
  const label = row.sourceName ?? "(untitled)";
  if (row.sourceUrl) {
    return (
      <a
        href={row.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="text-gray-200 hover:text-blue-300 transition-colors"
      >
        {label}
      </a>
    );
  }
  return <span className="text-gray-200">{label}</span>;
}

function NayBar({ nayPct }: { nayPct: number }) {
  const intensity =
    nayPct >= 50 ? "bg-red-700"
    : nayPct >= 25 ? "bg-orange-600"
    : nayPct >= 10 ? "bg-yellow-700"
    : "bg-gray-700";
  return (
    <div className="w-24 h-1.5 rounded bg-gray-800 overflow-hidden">
      <div
        className={`h-full ${intensity}`}
        style={{ width: `${Math.min(100, nayPct)}%` }}
      />
    </div>
  );
}

export default async function AnalysisVotesPage() {
  const data = await buildVoteAnalysis();
  const { meta, countries, globalContested, globalUnanimous, parties } = data;

  const overallContestedBills = countries.reduce((s, c) => s + c.contestedBills, 0);
  const overallUnanimousBills = countries.reduce((s, c) => s + c.unanimousBills, 0);
  const overallContestedPct =
    meta.totalVotes > 0 ? (overallContestedBills / meta.totalVotes) * 100 : 0;
  const overallUnanimousPct =
    meta.totalVotes > 0 ? (overallUnanimousBills / meta.totalVotes) * 100 : 0;

  return (
    <div className="space-y-10 text-sm text-gray-300">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Analysis</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Contested vs. unanimous votes</h1>
        <p className="mt-2 text-gray-400 max-w-2xl leading-relaxed">
          Recorded legislative votes from the UK, EU Parliament, Canada, and the U.S. Congress.
          A bill is <span className="text-gray-200">contested</span> when more than{" "}
          {pct(meta.contestedThreshold * 100)} of the recorded ayes-plus-nays were nays;
          <span className="text-gray-200"> unanimous</span> means zero nays. Procedural votes with fewer
          than {meta.minTotal} total recorded ayes-plus-nays are excluded.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Recorded votes</div>
          <div className="text-xl font-semibold text-white tabular-nums">
            {meta.totalVotes.toLocaleString()}
          </div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Contested</div>
          <div className="text-xl font-semibold text-red-300 tabular-nums">
            {overallContestedBills.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{pct(overallContestedPct, 1)} of total</div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Unanimous</div>
          <div className="text-xl font-semibold text-green-300 tabular-nums">
            {overallUnanimousBills.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{pct(overallUnanimousPct, 1)} of total</div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Bodies covered</div>
          <div className="text-xl font-semibold text-white tabular-nums">{countries.length}</div>
        </div>
      </div>

      {/* By-country breakdown */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-white">By legislative body</h2>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-4 py-2 text-left font-medium text-gray-500">Body</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Bills</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Contested</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Contested %</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Unanimous</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Unanimous %</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Avg. nay %</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((c, i) => (
                <tr
                  key={c.ingestedBy}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="text-gray-100">{c.label}</div>
                    <div className="text-gray-600 font-mono text-[10px] mt-0.5">{c.ingestedBy}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-white tabular-nums align-top">
                    {c.totalBills.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-red-300 tabular-nums align-top">
                    {c.contestedBills.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-red-300 tabular-nums align-top">
                    {pct(c.contestedPct, 1)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-300 tabular-nums align-top">
                    {c.unanimousBills.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-green-300 tabular-nums align-top">
                    {pct(c.unanimousPct, 1)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 tabular-nums align-top">
                    {pct(c.avgNayPct, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Most contested bills (global) */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-white">Most contested bills</h2>
        <p className="text-xs text-gray-500">
          Highest share of recorded nay votes across all bodies. Click a title to open the source record.
        </p>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-4 py-2 text-left font-medium text-gray-500">Bill</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Body</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Chamber</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Aye</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Nay</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Aye %</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Nay %</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {globalContested.map((r, i) => (
                <tr
                  key={r.legislativeVoteId}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-4 py-3 align-top max-w-md">
                    <BillCell row={r} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 align-top whitespace-nowrap">{r.country}</td>
                  <td className="px-4 py-3 text-gray-400 align-top whitespace-nowrap">{r.chamber}</td>
                  <td className="px-4 py-3 text-right text-gray-300 tabular-nums align-top">
                    {r.yesCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-red-300 tabular-nums align-top">
                    {r.noCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 tabular-nums align-top">
                    {pct(r.ayePct, 1)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-300 tabular-nums align-top">
                    {pct(r.nayPct, 1)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <NayBar nayPct={r.nayPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Most unanimous bills */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-white">Largest unanimous votes</h2>
        <p className="text-xs text-gray-500">
          Bills passed with zero recorded nays, ordered by total recorded ayes.
        </p>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-4 py-2 text-left font-medium text-gray-500">Bill</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Body</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Chamber</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Aye</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Nay</th>
              </tr>
            </thead>
            <tbody>
              {globalUnanimous.map((r, i) => (
                <tr
                  key={r.legislativeVoteId}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-4 py-3 align-top max-w-md"><BillCell row={r} /></td>
                  <td className="px-4 py-3 text-gray-400 align-top whitespace-nowrap">{r.country}</td>
                  <td className="px-4 py-3 text-gray-400 align-top whitespace-nowrap">{r.chamber}</td>
                  <td className="px-4 py-3 text-right text-green-300 tabular-nums align-top">
                    {r.yesCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums align-top">
                    {r.noCount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-country detail */}
      {countries.map((c) => (
        <section key={c.ingestedBy} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-white">{c.label}</h2>
            <p className="text-xs text-gray-500">
              {c.totalBills.toLocaleString()} bills · {c.contestedBills.toLocaleString()} contested ({pct(c.contestedPct, 1)}) · {c.unanimousBills.toLocaleString()} unanimous ({pct(c.unanimousPct, 1)})
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Most contested</h3>
            <div className="rounded border border-gray-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Bill</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Chamber</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Aye</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Nay</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Aye %</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Nay %</th>
                  </tr>
                </thead>
                <tbody>
                  {c.mostContested.map((r, i) => (
                    <tr
                      key={r.legislativeVoteId}
                      className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                    >
                      <td className="px-3 py-2 align-top max-w-md"><BillCell row={r} /></td>
                      <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{r.chamber}</td>
                      <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{r.yesCount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{r.noCount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{pct(r.ayePct, 1)}</td>
                      <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{pct(r.nayPct, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {c.mostUnanimous.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Largest unanimous</h3>
              <div className="rounded border border-gray-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/50">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Bill</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Chamber</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Aye</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Nay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.mostUnanimous.map((r, i) => (
                      <tr
                        key={r.legislativeVoteId}
                        className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                      >
                        <td className="px-3 py-2 align-top max-w-md"><BillCell row={r} /></td>
                        <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{r.chamber}</td>
                        <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{r.yesCount.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums align-top">{r.noCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ))}

      {/* Party breakdown */}
      {parties.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">By party</h2>
          <p className="text-xs text-gray-500">
            Aggregate yes/no/abstain totals per party across all recorded votes that included a
            per-party breakdown. Limited to parties present in 3+ bills. Parsed from{" "}
            {meta.partyRowsParsed.toLocaleString()} of {meta.totalVotes.toLocaleString()} vote records.
          </p>
          <div className="rounded border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Body</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Party</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Bills</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Votes</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Yes</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">No</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Abstain</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Yes %</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">No %</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((p: PartyRow, i: number) => (
                  <tr
                    key={`${p.ingestedBy}::${p.party}`}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-3 py-2 text-gray-400 align-top">{p.country}</td>
                    <td className="px-3 py-2 text-gray-100 align-top">{p.party}</td>
                    <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{p.billCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{p.totalVotes.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{p.yes.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{p.no.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums align-top">{p.abstain.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{pct(p.yesPct, 1)}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{pct(p.noPct, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="border-t border-gray-800 pt-4 text-xs text-gray-600">
        Data:{" "}
        <Link href="/api/analysis/votes" className="text-gray-500 hover:text-gray-300 underline">
          /api/analysis/votes
        </Link>{" "}
        · Source: <span className="font-mono">LegislativeVote</span> records attached to bill sources
        ingested by <span className="font-mono">uk_legislation_v1</span>,{" "}
        <span className="font-mono">eu_parliament_v1</span>,{" "}
        <span className="font-mono">canada_bills_v1</span>, and{" "}
        <span className="font-mono">congress_v1</span>.
      </div>
    </div>
  );
}
