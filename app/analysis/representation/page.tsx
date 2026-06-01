import Link from "next/link";
import { buildRepresentationAnalysis } from "@/lib/representationGap";

export const revalidate = 600;

const TOC = [
  { id: "top-gaps", label: "Largest individual gaps" },
  { id: "by-state", label: "States with biggest gaps" },
  { id: "by-topic", label: "Topic-level gaps" },
  { id: "by-decade", label: "Decade trend" },
  { id: "by-party", label: "Party comparison" },
];

function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function GapBar({ gap, max = 100 }: { gap: number; max?: number }) {
  const intensity =
    gap >= 60 ? "bg-red-700"
    : gap >= 40 ? "bg-orange-600"
    : gap >= 25 ? "bg-yellow-700"
    : "bg-gray-700";
  return (
    <div className="w-24 h-1.5 rounded bg-gray-800 overflow-hidden">
      <div className={`h-full ${intensity}`} style={{ width: `${Math.min(100, (gap / max) * 100)}%` }} />
    </div>
  );
}

export default async function RepresentationPage() {
  const data = await buildRepresentationAnalysis();
  const { meta, topGapRows, topicSummaries, decadeSummaries, stateSummaries, partyComparison } = data;

  if (meta.matchedRowCount === 0) {
    return (
      <div className="space-y-4 text-sm text-gray-300">
        <div>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Analysis</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Representation gap (CCES)</h1>
          <p className="mt-2 text-gray-400 max-w-2xl leading-relaxed">
            No matched rows yet. Run <span className="font-mono">scripts/ingest-cces.ts --full</span>{" "}
            (with <span className="font-mono">ALLOW_EDITS=true</span>) to populate{" "}
            <span className="font-mono">ConstituentOpinion</span> from the Harvard Dataverse CES
            cumulative file, then revisit this page.
          </p>
        </div>
      </div>
    );
  }

  const [minYear, maxYear] = meta.yearRange ?? [0, 0];

  return (
    <div className="space-y-10 text-sm text-gray-300">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Analysis</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Representation gap (CCES vs Congress)</h1>
        <p className="mt-2 text-gray-400 max-w-3xl leading-relaxed">
          Where do US legislators vote against their constituents? For each
          (state, year, topic) we compute two numbers and take their absolute
          difference. <span className="text-gray-200">Delegation Yea %</span> is the
          share of that state&apos;s House/Senate delegation that voted Yea on
          bills tagged with that topic in that year (Voteview + Congress.gov data,
          ingested by{" "}
          <span className="font-mono">congress_v1</span> / <span className="font-mono">voteview_v1</span>).{" "}
          <span className="text-gray-200">Constituent support %</span> is the share of
          CCES respondents in that state-year on the liberal-coded direction for
          that topic (mapped from CCES <span className="font-mono">ideo5</span>,{" "}
          <span className="font-mono">pid3</span>, and policy-proxy demographics —{" "}
          <span className="font-mono">no_healthins</span> for health,{" "}
          <span className="font-mono">union</span> for labor, etc).
        </p>
        <p className="mt-2 text-xs text-gray-600 max-w-3xl leading-relaxed italic">
          Methodology caveat: the CCES cumulative file (
          <a
            href="https://doi.org/10.7910/DVN/II2DB6"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            doi:10.7910/DVN/II2DB6
          </a>
          , 2006–2024, 702k respondents) carries standardized demographics + ideology
          but not the year-specific policy yes/no items, so per-topic support is a
          direction-mapped proxy rather than a literal &ldquo;do you support bill X&rdquo;
          measure. The page is honest about that and links back to the underlying CCES
          aggregates.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Matched (state, year, topic) rows</div>
          <div className="text-xl font-semibold text-white tabular-nums">
            {meta.matchedRowCount.toLocaleString()}
          </div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">CCES aggregates</div>
          <div className="text-xl font-semibold text-white tabular-nums">
            {meta.constituentOpinionRows.toLocaleString()}
          </div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">US roll calls scanned</div>
          <div className="text-xl font-semibold text-white tabular-nums">
            {meta.legislativeVotesScanned.toLocaleString()}
          </div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Coverage</div>
          <div className="text-base font-semibold text-white tabular-nums">
            {meta.statesCovered} states · {minYear}–{maxYear} · {meta.topicsMatched} topics
          </div>
        </div>
      </div>

      {/* TOC */}
      <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-3">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Sections</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {TOC.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="text-blue-400 hover:text-blue-300 transition-colors">
              {t.label}
            </a>
          ))}
        </div>
      </div>

      {/* === Top individual gaps === */}
      <section id="top-gaps" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Largest individual gaps</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Top 50 (state, year, topic) rows where the delegation&apos;s Yea-share
            diverged most from the constituent direction-support share. Each row
            requires ≥3 recorded member votes in the state-topic-year.
          </p>
        </div>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">State</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Year</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Topic</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Bills</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Member votes</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Deleg. Yea %</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Constit. supp %</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">CCES n</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Gap</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {topGapRows.map((r, i) => (
                <tr
                  key={`${r.state}|${r.year}|${r.topicSlug}`}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-3 py-2 text-gray-100 align-top font-mono">{r.state}</td>
                  <td className="px-3 py-2 text-gray-300 align-top tabular-nums">{r.year}</td>
                  <td className="px-3 py-2 text-gray-200 align-top font-mono">{r.topicSlug}</td>
                  <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{r.billCount}</td>
                  <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{r.memberVoteCount}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{pct(r.delegationYeaPct)}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{pct(r.constituentSupportPct)}</td>
                  <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{r.sampleSize}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums">{pct(r.gap)}</td>
                  <td className="px-3 py-2 align-top"><GapBar gap={r.gap} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* === By state === */}
      <section id="by-state" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">States with biggest average gaps</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Top 25 states by average gap across all (year, topic) cells. Each
            state must contribute at least 3 matched rows. Dem gap uses CCES
            liberal-direction support as the Democratic baseline; Rep gap uses
            the inverse (conservative-direction support) as the Republican
            baseline.
          </p>
        </div>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">State</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Matched rows</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg gap</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Dem gap</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Rep gap</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Top topics</th>
              </tr>
            </thead>
            <tbody>
              {stateSummaries.map((s, i) => (
                <tr
                  key={s.state}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-3 py-2 text-gray-100 align-top font-mono">{s.state}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{s.matchedRowCount}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums">{pct(s.avgGap)}</td>
                  <td className="px-3 py-2 text-right text-blue-300 tabular-nums">{fmt(s.avgDemGap)}</td>
                  <td className="px-3 py-2 text-right text-orange-300 tabular-nums">{fmt(s.avgRepGap)}</td>
                  <td className="px-3 py-2 align-top text-[11px] text-gray-500">
                    {s.topTopics.map((t, j) => (
                      <span key={`${t.topicSlug}-${j}`} className="font-mono mr-2">
                        {t.topicSlug}:{t.gap.toFixed(0)}%
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* === By topic === */}
      <section id="by-topic" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Topic-level gaps</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            One row per LegislativeVote topic. <span className="font-mono">questionCode</span> is
            the CCES proxy used: <span className="font-mono">liberal</span> = % CCES
            respondents identifying as Liberal/Very Liberal,{" "}
            <span className="font-mono">dem</span> = % Democrat (pid3),{" "}
            <span className="font-mono">uninsured</span> = % uninsured (health proxy),{" "}
            <span className="font-mono">union</span> = % union members (labor proxy),{" "}
            <span className="font-mono">conservative</span> / <span className="font-mono">evangelical</span>
            for hawkish or socially-conservative topics.
          </p>
        </div>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Topic</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">CCES proxy</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Rows</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Yea %</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg support %</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg gap</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Dem gap</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Rep gap</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Worst cells</th>
              </tr>
            </thead>
            <tbody>
              {topicSummaries.map((t, i) => (
                <tr
                  key={t.topicSlug}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-3 py-2 text-gray-100 align-top font-mono">{t.topicSlug}</td>
                  <td className="px-3 py-2 text-gray-400 align-top font-mono text-[11px]">{t.questionCode}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{t.matchedRowCount}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{pct(t.avgDelegationYeaPct)}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{pct(t.avgConstituentSupportPct)}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums">{pct(t.avgGap)}</td>
                  <td className="px-3 py-2 text-right text-blue-300 tabular-nums">{fmt(t.avgDemGap)}</td>
                  <td className="px-3 py-2 text-right text-orange-300 tabular-nums">{fmt(t.avgRepGap)}</td>
                  <td className="px-3 py-2 align-top text-[11px] text-gray-500">
                    {t.topGapStates.map((s, j) => (
                      <span key={`${s.state}-${j}`} className="font-mono mr-2">
                        {s.state}&apos;{String(s.year).slice(-2)}:{s.gap.toFixed(0)}%
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* === By decade === */}
      <section id="by-decade" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Decade trend</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Average representation gap by decade. The CCES series begins in 2006,
            so the 2000s bin covers 2006–2009 only.
          </p>
        </div>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Decade</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Matched rows</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg gap</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Dem gap</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Rep gap</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {decadeSummaries.map((d, i) => (
                <tr
                  key={d.decade}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-3 py-2 text-gray-100 align-top font-mono">{d.decade}</td>
                  <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{d.matchedRowCount}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums">{pct(d.avgGap)}</td>
                  <td className="px-3 py-2 text-right text-blue-300 tabular-nums">{fmt(d.avgDemGap)}</td>
                  <td className="px-3 py-2 text-right text-orange-300 tabular-nums">{fmt(d.avgRepGap)}</td>
                  <td className="px-3 py-2 align-top"><GapBar gap={d.avgGap} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* === Party comparison === */}
      <section id="by-party" className="space-y-3 scroll-mt-4">
        <div>
          <h2 className="text-base font-semibold text-white">Party comparison — which side strays further from its base?</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            For each matched (state, year, topic), we restrict member votes to
            one party at a time, compute that party&apos;s Yea share, and compare
            it to the relevant constituent baseline: Democratic legislators are
            compared to liberal-direction support; Republican legislators are
            compared to its complement (conservative-direction support). A larger
            average gap means that party&apos;s state delegation diverged more from
            its in-state ideological base.
          </p>
        </div>
        {/* Within-subjects paired analysis (rows where both party gaps are known) */}
        <div className="rounded border border-gray-700 bg-gray-900/60 px-4 py-4">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">
            Paired analysis — within-subjects
          </div>
          <p className="text-base text-gray-100 leading-snug">
            On <span className="font-semibold tabular-nums">{partyComparison.pairedCount.toLocaleString()}</span>{" "}
            matched votes, Democrats diverged more in{" "}
            <span className="font-semibold tabular-nums">{partyComparison.pctPairsDemHigher.toFixed(0)}%</span> of cases.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-xs">
            <div>
              <div className="text-gray-500">Median gap difference</div>
              <div className="text-base text-gray-200 tabular-nums">
                {partyComparison.pairedMedianDiff >= 0 ? "+" : ""}
                {partyComparison.pairedMedianDiff.toFixed(1)} pp
              </div>
              <div className="text-[11px] text-gray-600">+ means Dem &gt; Rep</div>
            </div>
            <div>
              <div className="text-gray-500">Mean gap difference</div>
              <div className="text-base text-gray-200 tabular-nums">
                {partyComparison.pairedMeanDiff >= 0 ? "+" : ""}
                {partyComparison.pairedMeanDiff.toFixed(1)} pp
              </div>
              <div className="text-[11px] text-gray-600">Dem gap − Rep gap, per row</div>
            </div>
            <div>
              <div className="text-gray-500">Paired rows</div>
              <div className="text-base text-gray-200 tabular-nums">
                {partyComparison.pairedCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-600">both Dem and Rep gap known</div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-gray-500 leading-relaxed max-w-3xl">
            Each row contributes a single value (demGap − repGap) computed on the same
            (state, year, topic). This is the methodologically clean comparison: both numbers
            describe the same delegation, year, and bill bucket — so the comparison isolates
            the party effect rather than averaging across different row sets.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-blue-900/50 bg-blue-950/30 px-4 py-3">
            <div className="text-xs text-blue-400 mb-1">Democratic legislators — avg gap</div>
            <div className="text-2xl font-semibold text-blue-200 tabular-nums">
              {fmt(partyComparison.demAvgGap)}%
            </div>
            <div className="text-xs text-blue-500 mt-1">
              {partyComparison.demRowCount.toLocaleString()} matched (state, year, topic) rows
            </div>
          </div>
          <div className="rounded border border-orange-900/50 bg-orange-950/30 px-4 py-3">
            <div className="text-xs text-orange-400 mb-1">Republican legislators — avg gap</div>
            <div className="text-2xl font-semibold text-orange-200 tabular-nums">
              {fmt(partyComparison.repAvgGap)}%
            </div>
            <div className="text-xs text-orange-500 mt-1">
              {partyComparison.repRowCount.toLocaleString()} matched (state, year, topic) rows
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 italic max-w-3xl leading-relaxed">
          Note: the two aggregate averages above are <span className="text-gray-400">not</span> directly comparable —
          they count different row sets (any row with a known Dem gap vs. any row with a known
          Rep gap), so the means absorb composition differences between those sets. For an
          apples-to-apples read, use the paired analysis above.
        </p>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Topic</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Sample cells</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Dem avg gap</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Rep avg gap</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Paired diff</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Diverges more</th>
              </tr>
            </thead>
            <tbody>
              {partyComparison.topicBreakdown.map((t, i) => {
                const diverges =
                  t.demAvgGap === null || t.repAvgGap === null
                    ? "—"
                    : t.demAvgGap > t.repAvgGap
                      ? "Democrats"
                      : t.repAvgGap > t.demAvgGap
                        ? "Republicans"
                        : "tied";
                const pairedDiff =
                  t.demAvgGap === null || t.repAvgGap === null
                    ? null
                    : t.demAvgGap - t.repAvgGap;
                return (
                  <tr
                    key={t.topicSlug}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-3 py-2 text-gray-100 align-top font-mono">{t.topicSlug}</td>
                    <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{t.sampleCount}</td>
                    <td className="px-3 py-2 text-right text-blue-300 tabular-nums">{fmt(t.demAvgGap)}</td>
                    <td className="px-3 py-2 text-right text-orange-300 tabular-nums">{fmt(t.repAvgGap)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-300">
                      {pairedDiff === null
                        ? "—"
                        : `${pairedDiff >= 0 ? "+" : ""}${pairedDiff.toFixed(1)}`}
                    </td>
                    <td
                      className={`px-3 py-2 align-top ${
                        diverges === "Democrats" ? "text-blue-300" : diverges === "Republicans" ? "text-orange-300" : "text-gray-500"
                      }`}
                    >
                      {diverges}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="border-t border-gray-800 pt-4 text-xs text-gray-600">
        Data:{" "}
        <Link href="/api/analysis/representation" className="text-gray-500 hover:text-gray-300 underline">
          /api/analysis/representation
        </Link>{" "}
        · CCES Cumulative Common Content (
        <a
          href="https://doi.org/10.7910/DVN/II2DB6"
          target="_blank"
          rel="noreferrer"
          className="text-gray-500 hover:text-gray-300 underline"
        >
          doi:10.7910/DVN/II2DB6
        </a>
        ) joined to <span className="font-mono">MemberVote</span> rows from{" "}
        <span className="font-mono">congress_v1</span> and{" "}
        <span className="font-mono">voteview_v1</span>.
      </div>
    </div>
  );
}
