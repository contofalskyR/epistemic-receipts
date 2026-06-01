export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  buildVoteAnalysis,
  type BillRow,
  type GlobalRow,
  type PartyRow,
} from "@/lib/voteAnalysis";
import DecadeTrendChart from "./DecadeTrendChart";
import TopicHeatmap from "./TopicHeatmap";

const TOC = [
  { id: "chi-square", label: "Chi-square partisan test" },
  { id: "polarization", label: "Polarization score" },
  { id: "close-calls", label: "Close-call analysis" },
  { id: "decade-trend", label: "Decade trend" },
  { id: "topic-zscore", label: "Topic trajectory (z-scored)" },
  { id: "party-loyalty", label: "Party loyalty" },
  { id: "topic-party", label: "Topic × party matrix" },
  { id: "bayes-bf", label: "Bayesian partisan signal (BF₁₀)" },
];

function fmtNum(n: number | undefined | null, digits = 2): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtPVal(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) return "—";
  if (p < 0.0001) return "<0.0001";
  if (p < 0.001) return p.toFixed(4);
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(3);
}

function fmtBF(bf: number | undefined): string {
  if (bf === undefined || !Number.isFinite(bf)) return "—";
  if (bf >= 1e6) return bf.toExponential(2);
  if (bf >= 1000) return bf.toFixed(0);
  if (bf >= 10) return bf.toFixed(1);
  return bf.toFixed(2);
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

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
  const {
    meta,
    countries,
    globalContested,
    globalUnanimous,
    parties,
    topPartisan,
    topBipartisan,
    mostPolarized,
    closeCalls,
    decadeTrend,
    decadeTrendByBody,
    partyLoyalty,
    loyaltySummary,
    topicPartyMatrix,
    strongPartisanBF,
    topicZScores,
  } = data;

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

      {/* Table of contents */}
      <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-3">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">
          Advanced statistical sections
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {TOC.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {t.label}
            </a>
          ))}
        </div>
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

      {/* Plain-language summary */}
      {(() => {
        const sentences: ReactNode[] = [];

        sentences.push(
          <span key="overview">
            Across <span className="text-gray-100 tabular-nums">{meta.totalVotes.toLocaleString()}</span>{" "}
            recorded votes spanning {countries.length} legislative {countries.length === 1 ? "body" : "bodies"},{" "}
            <span className="text-gray-100 tabular-nums">{pct(overallContestedPct, 1)}</span> were contested
            and{" "}
            <span className="text-gray-100 tabular-nums">{pct(overallUnanimousPct, 1)}</span> passed unanimously.
          </span>
        );

        const topP = topPartisan[0];
        if (topP) {
          const billName = topP.sourceName ?? "an untitled bill";
          const chiP = topP.chiP;
          const chiPhrase =
            chiP !== undefined && Number.isFinite(chiP) && chiP < 0.0001
              ? "essentially zero probability the split happened by chance"
              : chiP !== undefined && Number.isFinite(chiP) && chiP < 0.001
                ? "less than a 0.1% chance the split happened by chance"
                : chiP !== undefined && Number.isFinite(chiP) && chiP < 0.01
                  ? "less than a 1% chance the split happened by chance"
                  : "a very low probability the split happened by chance";
          const chiVal =
            topP.chiSq !== undefined && Number.isFinite(topP.chiSq)
              ? `χ² = ${topP.chiSq.toFixed(1)}`
              : "the chi-square test";
          sentences.push(
            <span key="partisan">
              The single most partisan vote on record was{" "}
              <span className="text-gray-100">{billName}</span> ({topP.country}), where {chiVal} indicates{" "}
              {chiPhrase}.
            </span>
          );
        }

        const majorParties = [...loyaltySummary]
          .filter((s) => s.memberCount >= 10)
          .sort((a, b) => b.memberCount - a.memberCount)
          .slice(0, 2);
        if (majorParties.length >= 2) {
          sentences.push(
            <span key="loyalty">
              Individual members rarely break from their caucus: the two largest blocs in our data —{" "}
              <span className="text-gray-100">{majorParties[0].party}</span> ({majorParties[0].chamber}) and{" "}
              <span className="text-gray-100">{majorParties[1].party}</span> ({majorParties[1].chamber}) — voted with
              their party {majorParties[0].avgLoyalty.toFixed(0)}% and{" "}
              {majorParties[1].avgLoyalty.toFixed(0)}% of the time, respectively.
            </span>
          );
        } else if (majorParties.length === 1) {
          sentences.push(
            <span key="loyalty">
              Members of the largest party in our data —{" "}
              <span className="text-gray-100">{majorParties[0].party}</span> ({majorParties[0].chamber}) — voted with
              their caucus {majorParties[0].avgLoyalty.toFixed(0)}% of the time on average.
            </span>
          );
        }

        const topB = topBipartisan[0];
        if (topB) {
          const bName = topB.sourceName ?? "an untitled bill";
          sentences.push(
            <span key="bipartisan">
              Despite that polarization, some bills cleared with effectively no party split at all — for example{" "}
              <span className="text-gray-100">{bName}</span> ({topB.country}) passed with{" "}
              {pct(topB.ayePct, 0)} in favor and no detectable partisan signal.
            </span>
          );
        }

        const peakDecade = [...decadeTrend]
          .filter((d) => d.totalVotes >= 10)
          .sort((a, b) => b.contestedPct - a.contestedPct)[0];
        if (peakDecade) {
          sentences.push(
            <span key="trend">
              Voting was most contested in the{" "}
              <span className="text-gray-100">{peakDecade.decade}</span>, when{" "}
              <span className="tabular-nums">{pct(peakDecade.contestedPct, 1)}</span> of{" "}
              <span className="tabular-nums">{peakDecade.totalVotes.toLocaleString()}</span> recorded votes drew at
              least {pct(meta.contestedThreshold * 100)} opposition.
            </span>
          );
        }

        return (
          <details className="group rounded border border-gray-800 bg-gray-900/40">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm text-gray-200 hover:text-white transition-colors flex items-center gap-2">
              <span>What does this mean?</span>
              <span className="text-gray-500 group-open:rotate-90 transition-transform inline-block">▸</span>
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-2 text-sm text-gray-400 leading-relaxed max-w-3xl">
              {sentences.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
          </details>
        );
      })()}

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

      {/* === Section 1: Chi-square partisan independence === */}
      <section id="chi-square" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Chi-square partisan independence test</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Tests whether yes/no votes are independent of party. The test compares observed
            party-by-vote counts against expected counts under the null hypothesis of no
            party effect. A larger χ² and smaller p-value mean stronger evidence that party
            predicts the vote. Bills marked partisan have p &lt; 0.05.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Top 10 most partisan</h3>
          <div className="rounded border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Bill</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Body</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">χ²</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">df</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">p-value</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Aye %</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Nay %</th>
                </tr>
              </thead>
              <tbody>
                {topPartisan.map((r, i) => (
                  <tr
                    key={r.legislativeVoteId}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-3 py-2 align-top max-w-md"><BillCell row={r} /></td>
                    <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{r.country}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{fmtNum(r.chiSq, 1)}</td>
                    <td className="px-3 py-2 text-right text-gray-400 tabular-nums align-top">{r.chiDf ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{fmtPVal(r.chiP)}</td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{pct(r.ayePct, 1)}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{pct(r.nayPct, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Top 10 most bipartisan</h3>
          <p className="text-[11px] text-gray-600">Lowest χ², p &gt; 0.5, minimum 50 total votes.</p>
          <div className="rounded border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Bill</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Body</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">χ²</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">df</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">p-value</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {topBipartisan.map((r, i) => (
                  <tr
                    key={r.legislativeVoteId}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-3 py-2 align-top max-w-md"><BillCell row={r} /></td>
                    <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{r.country}</td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{fmtNum(r.chiSq, 2)}</td>
                    <td className="px-3 py-2 text-right text-gray-400 tabular-nums align-top">{r.chiDf ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{fmtPVal(r.chiP)}</td>
                    <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{r.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* === Section 2: Polarization === */}
      <section id="polarization" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Polarization score</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Standard deviation of per-party yes-share across parties (parties with at least
            5 yes+no votes), scaled 0–100. Higher = parties broke harder against each other.
            A score near 0 means parties voted alike; near 50 means the parties split.
          </p>
        </div>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Bill</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Body</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Chamber</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Polarization</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Aye %</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Nay %</th>
              </tr>
            </thead>
            <tbody>
              {mostPolarized.map((r, i) => (
                <tr
                  key={r.legislativeVoteId}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-3 py-2 align-top max-w-md"><BillCell row={r} /></td>
                  <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{r.country}</td>
                  <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{r.chamber}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{fmtNum(r.polarizationScore, 2)}</td>
                  <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{pct(r.ayePct, 1)}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{pct(r.nayPct, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* === Section 3: Close-call analysis === */}
      <section id="close-calls" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Close-call analysis</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Bills decided within 5 percentage points of a 50/50 split. Sorted by distance
            from 50% — narrowest margins first.
          </p>
        </div>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Bill</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Body</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Result</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Aye</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Nay</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Aye %</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Margin</th>
              </tr>
            </thead>
            <tbody>
              {closeCalls.map((r, i) => {
                const margin = Math.abs(r.ayePct - 50);
                const resultColor =
                  r.result === "passed" ? "text-green-300"
                  : r.result === "failed" ? "text-red-300"
                  : "text-gray-400";
                return (
                  <tr
                    key={r.legislativeVoteId}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-3 py-2 align-top max-w-md"><BillCell row={r} /></td>
                    <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{r.country}</td>
                    <td className={`px-3 py-2 align-top whitespace-nowrap ${resultColor}`}>{r.result ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{r.yesCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{r.noCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-200 tabular-nums align-top">{pct(r.ayePct, 1)}</td>
                    <td className="px-3 py-2 text-right text-yellow-300 tabular-nums align-top">±{margin.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* === Section 4: Decade trend === */}
      <section id="decade-trend" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Contested rate by decade</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Each decade from the 1780s through the 2020s, broken out by legislative body.
            Contested = more than {pct(meta.contestedThreshold * 100)} nays of recorded aye+nay.
            A body&apos;s line only shows points for decades where it recorded at least 10 votes.
          </p>
        </div>

        <DecadeTrendChart data={decadeTrendByBody} />

        <details className="group rounded border border-gray-800/60 bg-gray-900/20">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-2">
            <span>Pooled decade totals (all bodies combined)</span>
            <span className="text-gray-600 group-open:rotate-90 transition-transform inline-block">▸</span>
          </summary>
          <div className="border-t border-gray-800/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Decade</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Total votes</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Contested</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Contested %</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Unanimous %</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {decadeTrend.map((d, i) => (
                  <tr
                    key={d.decade}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-3 py-2 text-gray-100 align-top font-mono">{d.decade}</td>
                    <td className="px-3 py-2 text-right text-white tabular-nums align-top">{d.totalVotes.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{d.contestedVotes.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{pct(d.contestedPct, 1)}</td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{pct(d.unanimousPct, 1)}</td>
                    <td className="px-3 py-2 align-top">
                      <NayBar nayPct={d.contestedPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* === Section 4b: Topic trajectory (z-scored heatmap) === */}
      <section id="topic-zscore" className="space-y-3 scroll-mt-4">
        <h2 className="text-base font-semibold text-white">Topic trajectory (z-scored)</h2>
        <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
          Each topic standardized against its own historical mean. Red = decade was anomalously high for that topic; blue = anomalously low. Values are z-scores: ±1 = 1 standard deviation from that topic&apos;s norm.
        </p>
        <TopicHeatmap rows={topicZScores} decades={decadeTrend.map((d) => d.decade)} />
      </section>

      {/* === Section 5: Party loyalty === */}
      <section id="party-loyalty" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Party loyalty (individual members)</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            For each bill we compute the majority vote (yea/nay) within each party, then
            measure how often each member voted with their party majority. Loyalty % is the
            share of partisan votes matching majority; defections are the count that didn&apos;t.
            Members with fewer than 10 partisan votes are excluded. From{" "}
            {meta.memberVotesParsed.toLocaleString()} individual recorded member votes.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Loyalty summary by party / chamber</h3>
          <div className="rounded border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Party</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Chamber</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Members</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Avg loyalty %</th>
                </tr>
              </thead>
              <tbody>
                {loyaltySummary.map((s, i) => (
                  <tr
                    key={`${s.party}::${s.chamber}`}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-3 py-2 text-gray-100 align-top">{s.party}</td>
                    <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{s.chamber}</td>
                    <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{s.memberCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{pct(s.avgLoyalty, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Top 50 biggest defectors</h3>
          <div className="rounded border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Member</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Party</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Chamber</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Total votes</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Defections</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Loyalty %</th>
                </tr>
              </thead>
              <tbody>
                {partyLoyalty.map((m, i) => (
                  <tr
                    key={`${m.memberName}::${m.chamber}::${m.memberParty}::${i}`}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-3 py-2 text-gray-100 align-top">{m.memberName}</td>
                    <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{m.memberParty}</td>
                    <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{m.chamber}</td>
                    <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{m.totalVotes.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{m.defectionCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-yellow-300 tabular-nums align-top">{pct(m.loyaltyPct, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* === Section 6: Topic × party matrix === */}
      <section id="topic-party" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Topic × party matrix</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            For each topic with at least 3 bills, the aggregate yes / no totals contributed
            by each party (parties present in at least 2 bills on that topic). Top 15 topics
            by total bill count.
          </p>
        </div>
        <div className="space-y-4">
          {topicPartyMatrix.map((t) => (
            <div key={t.topic} className="rounded border border-gray-800 overflow-hidden">
              <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-800 flex justify-between items-baseline">
                <div className="text-gray-100 font-mono">{t.topic}</div>
                <div className="text-xs text-gray-500">{t.totalBills.toLocaleString()} bills</div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800/50">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Party</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Bills</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Yes</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">No</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Yes %</th>
                  </tr>
                </thead>
                <tbody>
                  {t.parties.map((p, i) => (
                    <tr
                      key={`${t.topic}::${p.party}`}
                      className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                    >
                      <td className="px-3 py-2 text-gray-100 align-top">{p.party}</td>
                      <td className="px-3 py-2 text-right text-gray-300 tabular-nums align-top">{p.billCount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{p.yes.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{p.no.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-200 tabular-nums align-top">{pct(p.yesPct, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* === Section 7: Bayes Factor partisan signal === */}
      <section id="bayes-bf" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Bayesian partisan signal (BF₁₀)</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            For each bill with two or more parties of at least 5 yes+no votes each, we
            compare a model where every party shares a single yes-rate (H<sub>0</sub>) against
            a model where each party has its own (H<sub>1</sub>). The marginal likelihoods come
            from conjugate Beta(1, 1) priors. The result is the Bayes Factor BF<sub>10</sub>.
          </p>
          <p className="text-[11px] text-gray-600 italic mt-1">
            BF<sub>10</sub> &gt; 3 = moderate partisan signal; &gt; 10 = strong;
            &lt; 1 = bipartisan tendency. Showing top 10 with BF<sub>10</sub> &gt; 3.
          </p>
        </div>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Bill</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Body</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">BF₁₀</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Aye %</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Nay %</th>
              </tr>
            </thead>
            <tbody>
              {strongPartisanBF.map((r, i) => (
                <tr
                  key={r.legislativeVoteId}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-3 py-2 align-top max-w-md"><BillCell row={r} /></td>
                  <td className="px-3 py-2 text-gray-400 align-top whitespace-nowrap">{r.country}</td>
                  <td className="px-3 py-2 text-gray-500 align-top whitespace-nowrap tabular-nums">{fmtDate(r.voteDate)}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{fmtBF(r.bayesPartisanBF)}</td>
                  <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">{pct(r.ayePct, 1)}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">{pct(r.nayPct, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
