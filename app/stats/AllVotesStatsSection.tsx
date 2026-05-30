import {
  getAllVotesGlobalStats,
  getVoteviewDecadeStats,
  getVoteviewChamberBreakdown,
  getAllVotesTopTopics,
  getPartyLineTrendByDecade,
} from "@/lib/stats-queries";

const PIPELINE_LABELS: Record<string, string> = {
  voteview_v1: "US Congress (Voteview, 1789–2026)",
  congress_v1: "US Congress (Congress.gov)",
  eu_parliament_v1: "EU Parliament",
  canada_bills_v1: "Canada Parliament",
  uk_legislation_v1: "UK Parliament",
};

const TOPIC_LABELS: Record<string, string> = {
  defense: "Defense",
  health: "Health",
  economy: "Economy",
  environment: "Environment",
  justice: "Justice",
  immigration: "Immigration",
  education: "Education",
  infrastructure: "Infrastructure",
  foreign_policy: "Foreign Policy",
  social: "Social",
  taxation: "Taxation",
  trade: "Trade",
  agriculture: "Agriculture",
  energy: "Energy",
  labor: "Labor",
  housing: "Housing",
  technology: "Technology",
  veterans: "Veterans",
  budget: "Budget",
  civil_rights: "Civil Rights",
};

function pct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function pipelineLabel(ingestedBy: string): string {
  return PIPELINE_LABELS[ingestedBy] ?? ingestedBy;
}

function topicLabel(topic: string): string {
  return TOPIC_LABELS[topic] ?? topic.replace(/_/g, " ");
}

export default async function AllVotesStatsSection() {
  const [globalStats, decadeStats, chamberSplit, topTopics, partyLineTrend] =
    await Promise.all([
      getAllVotesGlobalStats(),
      getVoteviewDecadeStats(),
      getVoteviewChamberBreakdown(),
      getAllVotesTopTopics(20),
      getPartyLineTrendByDecade(),
    ]);

  const maxPipelineCount = Math.max(
    1,
    ...globalStats.byPipeline.map((p) => p.count),
  );
  const maxDecadeTotal = Math.max(1, ...decadeStats.map((d) => d.total));
  const maxChamberCount = Math.max(
    1,
    ...globalStats.byChamber.map((c) => c.count),
  );
  const maxTopicCount = Math.max(1, ...topTopics.map((t) => t.count));

  return (
    <section className="space-y-8">
      <header>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
          Overview
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          All Legislative Votes
        </h2>
        <p className="mt-2 text-zinc-400">
          {fmtNum(globalStats.totalVotes)} roll-call votes ·{" "}
          {fmtNum(globalStats.totalMemberVotes)} member-level votes ·{" "}
          {globalStats.pipelinesCount} pipelines · 1789–present.
        </p>
      </header>

      {/* Headline KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
            Total roll calls
          </p>
          <p className="mt-1 text-2xl font-semibold text-white tabular-nums">
            {fmtNum(globalStats.totalVotes)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            across {globalStats.pipelinesCount} legislatures / pipelines
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
            Member-level votes
          </p>
          <p className="mt-1 text-2xl font-semibold text-white tabular-nums">
            {fmtNum(globalStats.totalMemberVotes)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            individual Yea / Nay / Present records
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
            Voteview corpus
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300 tabular-nums">
            {fmtNum(
              globalStats.byPipeline.find((p) => p.ingestedBy === "voteview_v1")
                ?.count ?? 0,
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Congressional roll calls, 1st–119th Congress
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
            Decades covered
          </p>
          <p className="mt-1 text-2xl font-semibold text-white tabular-nums">
            {decadeStats.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {decadeStats.length > 0
              ? `${decadeStats[0]!.decade}s – ${decadeStats[decadeStats.length - 1]!.decade}s`
              : "no date data"}
          </p>
        </div>
      </div>

      {/* Votes by pipeline */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            Votes by Pipeline
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Roll-call counts and pass rates across every ingest pipeline that
            populates LegislativeVote. Pass rate uses {`"`}result{`"`} field
            (passed / failed only).
          </p>
        </div>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">
                  Pipeline
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Votes
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Passed
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Failed
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Pass rate
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {globalStats.byPipeline.map((p, i) => {
                const widthPct = (p.count / maxPipelineCount) * 100;
                return (
                  <tr
                    key={p.ingestedBy}
                    className={`border-b border-zinc-800/50 last:border-0 ${
                      i % 2 === 0 ? "" : "bg-zinc-900/20"
                    }`}
                  >
                    <td className="px-3 py-2 align-top">
                      <span className="text-zinc-100">
                        {pipelineLabel(p.ingestedBy)}
                      </span>
                      <span className="ml-2 text-[10px] text-zinc-600 font-mono">
                        {p.ingestedBy}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-200 tabular-nums align-top">
                      {fmtNum(p.count)}
                    </td>
                    <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">
                      {fmtNum(p.passedCount)}
                    </td>
                    <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">
                      {fmtNum(p.failedCount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums align-top">
                      {p.passRate === null ? (
                        <span className="text-zinc-600">—</span>
                      ) : (
                        <span className="text-green-300">
                          {pct(p.passRate * 100)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle min-w-[120px]">
                      <div className="h-2 rounded-sm bg-zinc-900 overflow-hidden">
                        <div
                          className="h-full bg-blue-700/70"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* By chamber */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            By Chamber / Body
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            All LegislativeVote rows grouped by chamber. Avg nay % only counts
            votes with recorded yes+no totals.
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3">
          {globalStats.byChamber.map((c) => {
            const widthPct = (c.count / maxChamberCount) * 100;
            return (
              <div key={c.chamber} className="space-y-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-zinc-100">{c.chamber}</span>
                  <div className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                    {fmtNum(c.count)} votes
                    {c.passRate !== null && (
                      <>
                        {" · "}
                        <span className="text-green-300">
                          {pct(c.passRate * 100)}
                        </span>{" "}
                        pass
                      </>
                    )}
                    {c.avgNayPct !== null && (
                      <>
                        {" · avg "}
                        <span className="text-red-300">
                          {pct(c.avgNayPct)}
                        </span>{" "}
                        nay
                      </>
                    )}
                  </div>
                </div>
                <div className="h-2 rounded-sm bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-blue-700/70"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Voteview by decade */}
      {decadeStats.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Voteview Roll Calls by Decade
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Congressional roll-call volume by decade, 1st Congress through
              today. House / Senate split, pass rate, and avg nay % per decade.
            </p>
          </div>
          <div className="rounded border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">
                    Decade
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
                    Total
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
                    House
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
                    Senate
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
                    Pass rate
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
                    Avg nay %
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">
                    Volume
                  </th>
                </tr>
              </thead>
              <tbody>
                {decadeStats.map((d, i) => {
                  const widthPct = (d.total / maxDecadeTotal) * 100;
                  return (
                    <tr
                      key={d.decade}
                      className={`border-b border-zinc-800/50 last:border-0 ${
                        i % 2 === 0 ? "" : "bg-zinc-900/20"
                      }`}
                    >
                      <td className="px-3 py-2 text-zinc-200 font-mono tabular-nums align-top">
                        {d.decade}s
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-200 tabular-nums align-top">
                        {fmtNum(d.total)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400 tabular-nums align-top">
                        {fmtNum(d.houseTotal)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400 tabular-nums align-top">
                        {fmtNum(d.senateTotal)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums align-top">
                        {d.passRate === null ? (
                          <span className="text-zinc-600">—</span>
                        ) : (
                          <span className="text-green-300">
                            {pct(d.passRate * 100)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums align-top">
                        {d.avgNayPct === null ? (
                          <span className="text-zinc-600">—</span>
                        ) : (
                          <span className="text-red-300">
                            {pct(d.avgNayPct)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle min-w-[120px]">
                        <div className="h-2 rounded-sm bg-zinc-900 overflow-hidden">
                          <div
                            className="h-full bg-amber-600/70"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Voteview House vs Senate */}
      {chamberSplit.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Voteview: House vs Senate
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Aggregate pass rate and avg nay % per chamber across the full
              Voteview corpus.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {chamberSplit.map((c) => (
              <div
                key={c.chamber}
                className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    {c.chamber}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {fmtNum(c.total)} roll calls
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Pass rate</span>
                    <span className="text-green-300 tabular-nums">
                      {c.passRate === null ? "—" : pct(c.passRate * 100)}
                    </span>
                  </div>
                  <div className="h-2 rounded-sm bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-green-700/70"
                      style={{
                        width: `${c.passRate === null ? 0 : c.passRate * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Avg opposition</span>
                    <span className="text-red-300 tabular-nums">
                      {c.avgNayPct === null ? "—" : pct(c.avgNayPct)}
                    </span>
                  </div>
                  <div className="h-2 rounded-sm bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-red-700/70"
                      style={{
                        width: `${c.avgNayPct === null ? 0 : c.avgNayPct}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Party-line trend over time */}
      {partyLineTrend.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Party-Line vs Bipartisan, by Decade
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Across every vote with a D/R breakdown in{" "}
              <span className="font-mono">byPartyJson</span>. Party-line: one
              major party ≥80% on one side. Bipartisan: both major parties
              &gt;60% on the same side.
            </p>
          </div>
          <div className="rounded border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">
                    Decade
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
                    Votes
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
                    Party-line
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
                    Bipartisan
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">
                    Mix (party-line / bipartisan)
                  </th>
                </tr>
              </thead>
              <tbody>
                {partyLineTrend.map((d, i) => {
                  const partyPct =
                    d.partyLineRate === null ? 0 : d.partyLineRate * 100;
                  const bipartisanPct =
                    d.bipartisanRate === null ? 0 : d.bipartisanRate * 100;
                  return (
                    <tr
                      key={d.decade}
                      className={`border-b border-zinc-800/50 last:border-0 ${
                        i % 2 === 0 ? "" : "bg-zinc-900/20"
                      }`}
                    >
                      <td className="px-3 py-2 text-zinc-200 font-mono tabular-nums align-top">
                        {d.decade}s
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-300 tabular-nums align-top">
                        {fmtNum(d.totalWithPartyData)}
                      </td>
                      <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">
                        {fmtNum(d.partyLineCount)}{" "}
                        <span className="text-zinc-500">
                          ({pct(partyPct)})
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">
                        {fmtNum(d.bipartisanCount)}{" "}
                        <span className="text-zinc-500">
                          ({pct(bipartisanPct)})
                        </span>
                      </td>
                      <td className="px-3 py-2 align-middle min-w-[160px]">
                        <div className="flex h-2 rounded-sm bg-zinc-900 overflow-hidden">
                          <div
                            className="h-full bg-red-700/70"
                            style={{ width: `${partyPct}%` }}
                          />
                          <div
                            className="h-full bg-green-700/70"
                            style={{ width: `${bipartisanPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top topics across all votes */}
      {topTopics.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Top {topTopics.length} Topics (All Votes)
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Most frequent topic tags across every LegislativeVote with a
              parsed{" "}
              <span className="font-mono">topics</span> array. Includes pass
              rate per topic.
            </p>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3">
            {topTopics.map((t) => {
              const widthPct = (t.count / maxTopicCount) * 100;
              return (
                <div key={t.topic} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-zinc-100">{topicLabel(t.topic)}</span>
                    <div className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                      {fmtNum(t.count)} votes
                      {t.passRate !== null && (
                        <>
                          {" · "}
                          <span className="text-green-300">
                            {pct(t.passRate * 100)}
                          </span>{" "}
                          pass
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-sm bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-blue-700/70"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
