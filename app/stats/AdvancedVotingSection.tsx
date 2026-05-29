import {
  getCusumChangePoints,
  getBimodalityResult,
  getRunsTestResult,
  getWarPeriodEffect,
} from "@/lib/advanced-voting-stats";

function fmtP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "p < .001";
  return `p = ${p.toFixed(3)}`;
}

function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

function fmtBF(bf: number): string {
  if (!Number.isFinite(bf) || Number.isNaN(bf)) return "—";
  if (bf >= 1) {
    if (bf >= 1e6) return bf.toExponential(2);
    if (bf >= 1000) return bf.toFixed(0);
    if (bf >= 10) return bf.toFixed(1);
    return bf.toFixed(2);
  }
  const inv = 1 / bf;
  if (inv >= 1000) return `1 / ${inv.toFixed(0)}`;
  return `1 / ${inv.toFixed(1)}`;
}

function fmtChi(chi: number): string {
  if (!Number.isFinite(chi)) return "—";
  if (chi >= 1000) return chi.toFixed(0);
  return chi.toFixed(2);
}

function bfChipClass(label: string): string {
  if (label.includes("Decisive for H₁")) return "bg-emerald-900/40 text-emerald-200 border-emerald-700/60";
  if (label.includes("Strong for H₁")) return "bg-emerald-900/30 text-emerald-200 border-emerald-800/60";
  if (label.includes("Moderate for H₁")) return "bg-amber-900/30 text-amber-200 border-amber-800/60";
  if (label.includes("Anecdotal for H₁")) return "bg-amber-900/20 text-amber-300/80 border-amber-900/40";
  if (label.includes("Anecdotal for H₀")) return "bg-zinc-800/60 text-zinc-300 border-zinc-700/60";
  if (label.includes("Moderate for H₀")) return "bg-zinc-800/60 text-zinc-300 border-zinc-700/60";
  if (label.includes("Strong for H₀")) return "bg-zinc-800/80 text-zinc-200 border-zinc-700";
  if (label.includes("Decisive for H₀")) return "bg-zinc-800 text-zinc-100 border-zinc-700";
  return "bg-zinc-800 text-zinc-300 border-zinc-700";
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-wider text-zinc-500">{children}</span>;
}

export default async function AdvancedVotingSection() {
  const [cusum, bimodal, runs, war] = await Promise.all([
    getCusumChangePoints(),
    getBimodalityResult(),
    getRunsTestResult(),
    getWarPeriodEffect(),
  ]);

  const maxBin = Math.max(1, ...bimodal.histogram.map((b) => b.count));

  return (
    <section className="space-y-4 pt-6 border-t border-zinc-800">
      <header>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Advanced</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Structural Patterns in Congressional Voting</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Change-point detection, bimodality, time clustering, and war-period effect across 113k+ roll calls.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Card 1: CUSUM change points ────────────────────────────────── */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">When Did Congressional Behavior Shift?</h3>
            <p className="mt-1 text-xs text-zinc-500">
              CUSUM change points — years where the running pass rate broke from its long-run mean.
            </p>
          </div>

          {cusum.changePoints.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No change points detected.</p>
          ) : (
            <ol className="space-y-1.5">
              {cusum.changePoints.map((cp) => (
                <li key={cp.year} className="flex items-baseline gap-3 text-[11px]">
                  <span className="font-mono tabular-nums text-zinc-300 w-12">{cp.year}</span>
                  <span
                    className={`font-semibold ${
                      cp.direction === "up" ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {cp.direction === "up" ? "↑" : "↓"}
                  </span>
                  <span className="text-zinc-400">
                    {cp.direction === "up" ? "shift up" : "shift down"} — pass rate{" "}
                    <span className="text-zinc-200 tabular-nums">{fmtPct(cp.passRate)}</span>
                  </span>
                  <span className="ml-auto text-[10px] text-zinc-600 tabular-nums">
                    C = {cp.cusumValue.toFixed(2)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <p className="text-[10px] text-zinc-600">
            From {cusum.yearlyRates.length.toLocaleString()} year-buckets (≥5 votes each). Threshold = 1.5σ of the CUSUM series.
          </p>
        </div>

        {/* ── Card 2: Bimodality ─────────────────────────────────────────── */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Are Congressional Votes Bimodal?</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Distribution of yes-share margins across {bimodal.n.toLocaleString()} contested votes.
            </p>
          </div>

          <div className="flex h-24 items-end gap-px rounded bg-zinc-950 p-2">
            {bimodal.histogram.map((b) => {
              const h = (b.count / maxBin) * 100;
              const isExtreme = b.binMax <= 0.2 || b.binMin >= 0.8;
              return (
                <div
                  key={b.binMin}
                  className={`flex-1 ${isExtreme ? "bg-emerald-700/70" : "bg-amber-600/70"}`}
                  style={{ height: `${Math.max(h, 1)}%` }}
                  title={`${fmtPct(b.binMin, 0)}–${fmtPct(b.binMax, 0)}: ${b.count.toLocaleString()}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 tabular-nums">
            <span>0%</span>
            <span>50%</span>
            <span>100% yes-share</span>
          </div>

          <div className="space-y-1 text-[11px] text-zinc-400 tabular-nums">
            <div>
              BC = <span className="text-zinc-100">{bimodal.bimodalityCoefficient.toFixed(3)}</span>{" "}
              <span className="text-zinc-500">(threshold 0.555)</span>
            </div>
            <div>
              skewness = {bimodal.skewness.toFixed(3)}, excess kurtosis ={" "}
              {bimodal.excessKurtosis.toFixed(3)}
            </div>
          </div>

          <div
            className={`inline-block rounded border px-2 py-1 text-[11px] font-medium ${
              bimodal.isBimodal
                ? "bg-emerald-900/30 text-emerald-200 border-emerald-800/60"
                : "bg-zinc-800/60 text-zinc-300 border-zinc-700/60"
            }`}
          >
            {bimodal.isBimodal ? "Bimodal" : "Not bimodal"}
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">{bimodal.interpretation}</p>
        </div>

        {/* ── Card 3: Runs test ───────────────────────────────────────────── */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Do Contentious Votes Cluster in Time?</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Wald-Wolfowitz runs test: are close votes (&lt; 55% yea) bundled or random over history?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <StatLabel>Contentious</StatLabel>
              <p className="mt-1 text-xl font-semibold text-red-300 tabular-nums">
                {runs.n1.toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-500">votes &lt; 55% yea</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <StatLabel>Lopsided</StatLabel>
              <p className="mt-1 text-xl font-semibold text-emerald-300 tabular-nums">
                {runs.n2.toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-500">votes ≥ 55% yea</p>
            </div>
          </div>

          <div className="space-y-1 text-[11px] text-zinc-400 tabular-nums">
            <div>
              runs = <span className="text-zinc-100">{runs.runs.toLocaleString()}</span> · expected ={" "}
              {runs.expectedRuns.toFixed(0)}
            </div>
            <div>
              z = {runs.zStat.toFixed(2)}, {fmtP(runs.pValue)}
            </div>
          </div>

          <div
            className={`inline-block rounded border px-2 py-1 text-[11px] font-medium ${
              runs.clustered
                ? "bg-amber-900/30 text-amber-200 border-amber-800/60"
                : "bg-zinc-800/60 text-zinc-300 border-zinc-700/60"
            }`}
          >
            {runs.clustered ? "Clustered" : "Not clustered"}
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">{runs.interpretation}</p>
        </div>

        {/* ── Card 4: War period effect ──────────────────────────────────── */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Does War Affect Pass Rates?</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Chi-square test on Voteview pass rates during 11 declared US wars vs. peacetime.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <StatLabel>Wartime</StatLabel>
              <p className="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">
                {fmtPct(war.warPassRate)}
              </p>
              <p className="text-[10px] text-zinc-500 tabular-nums">
                {war.warVotes.toLocaleString()} votes
              </p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <StatLabel>Peacetime</StatLabel>
              <p className="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">
                {fmtPct(war.peacePassRate)}
              </p>
              <p className="text-[10px] text-zinc-500 tabular-nums">
                {war.peaceVotes.toLocaleString()} votes
              </p>
            </div>
          </div>

          <div className="space-y-1 text-[11px] text-zinc-400 tabular-nums">
            <div>
              χ²(1) = {fmtChi(war.chiSq)}, {fmtP(war.pValue)}
            </div>
          </div>

          <div
            className={`inline-block rounded border px-2 py-1 text-[11px] font-medium ${bfChipClass(
              war.bfInterpretation,
            )}`}
          >
            BF₁₀ = {fmtBF(war.bf10)} — {war.bfInterpretation}
          </div>

          {war.perWar.length > 0 && (
            <div className="overflow-hidden rounded border border-zinc-800">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950">
                    <th className="px-2 py-1.5 text-left font-medium text-zinc-500">War</th>
                    <th className="px-2 py-1.5 text-right font-medium text-zinc-500">N</th>
                    <th className="px-2 py-1.5 text-right font-medium text-zinc-500">Pass</th>
                  </tr>
                </thead>
                <tbody>
                  {war.perWar.map((w) => (
                    <tr key={w.name} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-2 py-1.5 text-zinc-300">{w.name}</td>
                      <td className="px-2 py-1.5 text-right text-zinc-400 tabular-nums">
                        {w.total.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right text-zinc-300 tabular-nums">
                        {fmtPct(w.passRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-zinc-400 leading-relaxed">{war.interpretation}</p>
        </div>
      </div>
    </section>
  );
}
