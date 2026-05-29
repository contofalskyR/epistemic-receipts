import { getVotingInferenceStats } from "@/lib/voting-stats";

function fmtP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "p < .001";
  return `p = ${p.toFixed(3)}`;
}

function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

// Renders the BF compactly. Falls back to log₁₀-scale notation when the value
// has overflowed double precision (BIC BFs explode quickly with large χ²).
function fmtBF(bf: number, log10Bf?: number): string {
  if (Number.isNaN(bf)) return "—";
  if (log10Bf !== undefined && Math.abs(log10Bf) >= 6) {
    if (log10Bf > 0) return `10^${log10Bf.toFixed(0)}`;
    return `10^${log10Bf.toFixed(0)}`;
  }
  if (!Number.isFinite(bf) || bf <= 0) {
    if (log10Bf !== undefined) return `10^${log10Bf.toFixed(0)}`;
    return "—";
  }
  if (bf >= 1) {
    if (bf >= 1e6) return bf.toExponential(2);
    if (bf >= 1000) return bf.toFixed(0);
    if (bf >= 10) return bf.toFixed(1);
    return bf.toFixed(2);
  }
  const inv = 1 / bf;
  if (inv >= 1e6) return `1 / ${inv.toExponential(2)}`;
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
  return (
    <span className="text-[10px] uppercase tracking-wider text-zinc-500">{children}</span>
  );
}

export default async function VotingInferenceSection() {
  const stats = await getVotingInferenceStats();
  const { chamberTest, eraTest, polarizationTrend } = stats;

  return (
    <section className="space-y-4 pt-6 border-t border-zinc-800">
      <header>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Inference</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          Statistical Analysis of Congressional Voting
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Chi-square tests, Bayes factors, and regression across 113k+ roll calls (1789–2026).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Card 1: Chamber comparison ───────────────────────────────────── */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">House vs. Senate Pass Rates</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Independence of chamber and outcome on every Voteview roll call.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <StatLabel>House</StatLabel>
              <p className="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">
                {fmtPct(chamberTest.housePassRate)}
              </p>
              <p className="text-[11px] text-zinc-500 tabular-nums">
                {chamberTest.houseTotal.toLocaleString()} votes
              </p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <StatLabel>Senate</StatLabel>
              <p className="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">
                {fmtPct(chamberTest.senatePassRate)}
              </p>
              <p className="text-[11px] text-zinc-500 tabular-nums">
                {chamberTest.senateTotal.toLocaleString()} votes
              </p>
            </div>
          </div>

          <div className="space-y-1 text-[11px] text-zinc-400 tabular-nums">
            <div>
              χ²(1) = {fmtChi(chamberTest.chiSq)}, {fmtP(chamberTest.pValue)}
            </div>
            <div>
              Cohen&apos;s h = {chamberTest.cohensH.toFixed(3)}{" "}
              <span className="text-zinc-500">({chamberTest.cohensHInterpretation})</span>
            </div>
          </div>

          <div
            className={`inline-block rounded border px-2 py-1 text-[11px] font-medium ${bfChipClass(
              chamberTest.bfInterpretation,
            )}`}
          >
            BF₁₀ = {fmtBF(chamberTest.bf10, chamberTest.log10Bf10)} — {chamberTest.bfInterpretation}
          </div>

          <p className="text-[11px] text-zinc-500">
            {chamberTest.bf10 >= 10
              ? "Pass rates differ between chambers more than chance would predict."
              : chamberTest.bf10 <= 0.1
                ? "Pass rates are statistically indistinguishable between chambers."
                : "Evidence is inconclusive at conventional thresholds."}
          </p>
        </div>

        {/* ── Card 2: Era variation ────────────────────────────────────────── */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Pass Rate Varies Across Historical Eras</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Outcome distribution across {eraTest.eras.length} eras of US legislative history.
            </p>
          </div>

          <div className="overflow-hidden rounded border border-zinc-800">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950">
                  <th className="px-2 py-1.5 text-left font-medium text-zinc-500">Era</th>
                  <th className="px-2 py-1.5 text-right font-medium text-zinc-500">N</th>
                  <th className="px-2 py-1.5 text-right font-medium text-zinc-500">Pass</th>
                  <th className="px-2 py-1.5 text-right font-medium text-zinc-500">z</th>
                </tr>
              </thead>
              <tbody>
                {eraTest.eras.map((e) => {
                  const flagged = Math.abs(e.zScore) > 1.5;
                  return (
                    <tr key={e.label} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-2 py-1.5 text-zinc-300">{e.label}</td>
                      <td className="px-2 py-1.5 text-right text-zinc-400 tabular-nums">
                        {e.total.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right text-zinc-300 tabular-nums">
                        {fmtPct(e.passRate)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right tabular-nums ${
                          flagged
                            ? e.zScore > 0
                              ? "text-emerald-300 font-medium"
                              : "text-red-300 font-medium"
                            : "text-zinc-500"
                        }`}
                      >
                        {e.zScore.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 text-[11px] text-zinc-400 tabular-nums">
            <div>
              χ²({eraTest.df}) = {fmtChi(eraTest.chiSq)}, {fmtP(eraTest.pValue)}
            </div>
            <div>
              V = {eraTest.cramersV.toFixed(3)}{" "}
              <span className="text-zinc-500">({eraTest.cramersVInterpretation})</span>
            </div>
          </div>

          <div
            className={`inline-block rounded border px-2 py-1 text-[11px] font-medium ${bfChipClass(
              eraTest.bfInterpretation,
            )}`}
          >
            BF₁₀ = {fmtBF(eraTest.bf10, eraTest.log10Bf10)} — {eraTest.bfInterpretation}
          </div>
        </div>

        {/* ── Card 3: Polarization regression ──────────────────────────────── */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Congressional Polarization Over Time
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              OLS regression of yes-share on year for contested roll calls.
            </p>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <StatLabel>
              {polarizationTrend.slopePerDecade < 0
                ? "Margins have narrowed"
                : "Margins have widened"}
            </StatLabel>
            <p className="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">
              {polarizationTrend.slopePerDecade >= 0 ? "+" : "−"}
              {Math.abs(polarizationTrend.slopePerDecade * 100).toFixed(2)}pp
              <span className="ml-1 text-sm font-normal text-zinc-500">/ decade</span>
            </p>
          </div>

          <div className="space-y-1 text-[11px] text-zinc-400 tabular-nums">
            <div>
              β = {polarizationTrend.slopePerDecade !== 0
                ? (polarizationTrend.slopePerDecade / 10).toFixed(5)
                : "0.00000"}
              /year
            </div>
            <div>R² = {polarizationTrend.rSquared.toFixed(4)}</div>
            <div>{fmtP(polarizationTrend.pValue)}</div>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {polarizationTrend.interpretation}
          </p>

          <p className="text-[10px] text-zinc-600">
            Based on {polarizationTrend.sampleSize.toLocaleString()} votes with non-null vote counts (yes+no ≥ 10).
          </p>
        </div>
      </div>
    </section>
  );
}
