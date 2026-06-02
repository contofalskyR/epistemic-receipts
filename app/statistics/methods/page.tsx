"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClaimHit = {
  id: string;
  text: string;
  verificationStatus: string | null;
  currentStatus: string;
};

type Section =
  | { kind: "para"; text: string }
  | { kind: "math"; tex: string; label?: string }
  | { kind: "list"; items: string[] };

type Method = {
  slug: string;
  name: string;
  shortName: string;
  family: string;
  familyColor: string;
  problem: string;
  howItWorks: Section[];
  workedExample: Section[];
  argumentsFor: string[];
  pitfalls: string[];
  figure: (props: { height: number }) => React.ReactNode;
  figureCaption: string;
};

// ─── Figures (inline SVG + Recharts) ─────────────────────────────────────────

function normalPdf(x: number, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function NormalCurveWithRejection({ height }: { height: number }) {
  const data = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let x = -4; x <= 4; x += 0.05) {
      out.push({ x: +x.toFixed(2), y: normalPdf(x) });
    }
    return out;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <Tooltip
          contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }}
          labelStyle={{ color: "#e5e7eb" }}
          formatter={(v) => (typeof v === "number" ? v.toFixed(4) : String(v))}
        />
        <Area type="monotone" dataKey="y" stroke="#60a5fa" fill="url(#pvFill)" strokeWidth={2} />
        <ReferenceArea x1={-4} x2={-1.96} fill="#ef4444" fillOpacity={0.25} />
        <ReferenceArea x1={1.96} x2={4} fill="#ef4444" fillOpacity={0.25} />
        <ReferenceLine x={-1.96} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "−1.96", fill: "#fca5a5", fontSize: 10, position: "top" }} />
        <ReferenceLine x={1.96} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "+1.96", fill: "#fca5a5", fontSize: 10, position: "top" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CIIntervals({ height }: { height: number }) {
  // 20 intervals around a true mean of 0, ~95% should cover.
  const data = useMemo(() => {
    const seed = 42;
    let s = seed;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const intervals: { idx: number; low: number; high: number; mean: number; covers: boolean }[] = [];
    for (let i = 0; i < 20; i++) {
      const m = (rand() - 0.5) * 1.6;
      const se = 0.5 + rand() * 0.2;
      const low = m - 1.96 * se / Math.sqrt(20);
      const high = m + 1.96 * se / Math.sqrt(20);
      intervals.push({ idx: i + 1, low, high, mean: m, covers: low <= 0 && high >= 0 });
    }
    return intervals;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" domain={[-1.5, 1.5]} />
        <YAxis type="category" dataKey="idx" tick={{ fill: "#9ca3af", fontSize: 10 }} stroke="#374151" width={20} />
        <ReferenceLine x={0} stroke="#9ca3af" strokeDasharray="4 2" label={{ value: "true μ = 0", fill: "#9ca3af", fontSize: 10, position: "top" }} />
        <Tooltip
          contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }}
          formatter={(_v, _n, p) => {
            const d = p.payload as { low: number; high: number; covers: boolean };
            return [`[${d.low.toFixed(2)}, ${d.high.toFixed(2)}] · covers=${d.covers}`, "95% CI"];
          }}
        />
        <Bar dataKey={(d: { high: number; low: number }) => d.high - d.low} stackId="a">
          {data.map((d) => (
            <Cell key={d.idx} fill={d.covers ? "#10b981" : "#ef4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EffectSizeOverlap({ height }: { height: number }) {
  const data = useMemo(() => {
    const out: { x: number; a: number; b: number }[] = [];
    for (let x = -4; x <= 6; x += 0.05) {
      out.push({ x: +x.toFixed(2), a: normalPdf(x, 0, 1), b: normalPdf(x, 0.8, 1) });
    }
    return out;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }} />
        <Area type="monotone" dataKey="a" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} strokeWidth={2} name="Group A (μ=0)" />
        <Area type="monotone" dataKey="b" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} strokeWidth={2} name="Group B (μ=0.8)" />
        <ReferenceLine x={0} stroke="#60a5fa" strokeDasharray="3 3" />
        <ReferenceLine x={0.8} stroke="#f59e0b" strokeDasharray="3 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CorrelationScatter({ height }: { height: number }) {
  const data = useMemo(() => {
    const seed = 77;
    let s = seed;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const x = rand() * 10;
      const noise = (rand() - 0.5) * 3;
      const y = 0.7 * x + 1 + noise;
      points.push({ x: +x.toFixed(2), y: +y.toFixed(2) });
    }
    return points;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="x" type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" name="X" />
        <YAxis dataKey="y" type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" name="Y" />
        <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }} cursor={{ stroke: "#374151" }} />
        <Scatter data={data} fill="#f97316" />
        {/* Approximate OLS line */}
        <Line
          type="linear"
          data={[{ x: 0, y: 1 }, { x: 10, y: 8 }]}
          dataKey="y"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          legendType="none"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function TwoByTwoTable({ height }: { height: number }) {
  // Static SVG 2x2 contingency
  return (
    <div className="flex justify-center items-center" style={{ height }}>
      <svg viewBox="0 0 360 200" className="w-full max-w-md">
        <g fontFamily="ui-monospace, monospace" fontSize="11" fill="#d1d5db">
          {/* Headers */}
          <text x="180" y="20" textAnchor="middle" fill="#9ca3af">Outcome</text>
          <text x="120" y="40" textAnchor="middle" fill="#9ca3af">Event</text>
          <text x="240" y="40" textAnchor="middle" fill="#9ca3af">No event</text>
          <text x="20" y="100" fill="#9ca3af">Exposed</text>
          <text x="20" y="150" fill="#9ca3af">Unexposed</text>
          {/* Cells */}
          <rect x="80" y="60" width="80" height="50" fill="#7f1d1d" fillOpacity="0.35" stroke="#374151" />
          <rect x="160" y="60" width="160" height="50" fill="#0f172a" stroke="#374151" />
          <rect x="80" y="110" width="80" height="50" fill="#0f172a" stroke="#374151" />
          <rect x="160" y="110" width="160" height="50" fill="#0f172a" stroke="#374151" />
          <text x="120" y="90" textAnchor="middle" fill="#fca5a5" fontSize="18" fontWeight="bold">a = 30</text>
          <text x="240" y="90" textAnchor="middle" fill="#e5e7eb" fontSize="18">b = 70</text>
          <text x="120" y="140" textAnchor="middle" fill="#e5e7eb" fontSize="18">c = 10</text>
          <text x="240" y="140" textAnchor="middle" fill="#e5e7eb" fontSize="18">d = 90</text>
          {/* Formula */}
          <text x="180" y="185" textAnchor="middle" fill="#9ca3af">OR = (a·d)/(b·c) = (30·90)/(70·10) = 3.86</text>
        </g>
      </svg>
    </div>
  );
}

function LogisticCurve({ height }: { height: number }) {
  const data = useMemo(() => {
    const out: { x: number; logistic: number; linear: number }[] = [];
    for (let x = -6; x <= 6; x += 0.2) {
      out.push({
        x: +x.toFixed(2),
        logistic: 1 / (1 + Math.exp(-x)),
        linear: 0.5 + x * 0.08,
      });
    }
    return out;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <YAxis domain={[0, 1]} tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }} />
        <ReferenceLine y={0.5} stroke="#374151" strokeDasharray="3 3" />
        <Line type="monotone" dataKey="logistic" stroke="#10b981" strokeWidth={2} dot={false} name="Logistic (binary outcome)" />
        <Line type="monotone" dataKey="linear" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Linear (continuous)" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ForestPlot({ height }: { height: number }) {
  const studies = useMemo(
    () => [
      { study: "Aspinall 2014",     est: 0.32, low: 0.10, high: 0.54, weight: 0.10 },
      { study: "Briggs 2016",       est: 0.45, low: 0.20, high: 0.70, weight: 0.12 },
      { study: "Chen 2017",         est: 0.10, low: -0.15, high: 0.35, weight: 0.08 },
      { study: "Donovan 2018",      est: 0.55, low: 0.30, high: 0.80, weight: 0.14 },
      { study: "Esposito 2019",     est: 0.28, low: 0.05, high: 0.51, weight: 0.18 },
      { study: "Fernández 2020",    est: 0.41, low: 0.18, high: 0.64, weight: 0.16 },
      { study: "Gupta 2021",        est: 0.36, low: 0.16, high: 0.56, weight: 0.22 },
      { study: "OVERALL (random)",  est: 0.36, low: 0.24, high: 0.48, weight: 1.0, summary: true },
    ],
    []
  );
  return (
    <div style={{ height }} className="w-full overflow-auto">
      <svg viewBox="0 0 540 260" className="w-full">
        <g fontFamily="ui-monospace, monospace" fontSize="11">
          {/* Axis */}
          <line x1="200" y1="240" x2="500" y2="240" stroke="#4b5563" />
          {[-0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8].map((v) => {
            const x = 200 + ((v + 0.4) / 1.2) * 300;
            return (
              <g key={v}>
                <line x1={x} y1="240" x2={x} y2="245" stroke="#4b5563" />
                <text x={x} y="256" textAnchor="middle" fill="#9ca3af">{v}</text>
              </g>
            );
          })}
          <line x1={200 + (0.4 / 1.2) * 300} y1="20" x2={200 + (0.4 / 1.2) * 300} y2="240" stroke="#374151" strokeDasharray="3 3" />
          {studies.map((s, i) => {
            const y = 30 + i * 26;
            const xEst = 200 + ((s.est + 0.4) / 1.2) * 300;
            const xLow = 200 + ((s.low + 0.4) / 1.2) * 300;
            const xHigh = 200 + ((s.high + 0.4) / 1.2) * 300;
            const size = 4 + s.weight * 14;
            if (s.summary) {
              return (
                <g key={s.study}>
                  <text x="10" y={y + 4} fill="#fef3c7" fontWeight="bold">{s.study}</text>
                  <polygon
                    points={`${xLow},${y} ${xEst},${y - 7} ${xHigh},${y} ${xEst},${y + 7}`}
                    fill="#fbbf24"
                    stroke="#f59e0b"
                  />
                  <text x="510" y={y + 4} fill="#fef3c7">{`${s.est.toFixed(2)} [${s.low.toFixed(2)}, ${s.high.toFixed(2)}]`}</text>
                </g>
              );
            }
            return (
              <g key={s.study}>
                <text x="10" y={y + 4} fill="#d1d5db">{s.study}</text>
                <line x1={xLow} y1={y} x2={xHigh} y2={y} stroke="#9ca3af" />
                <rect x={xEst - size / 2} y={y - size / 2} width={size} height={size} fill="#60a5fa" />
                <text x="510" y={y + 4} fill="#9ca3af">{`${s.est.toFixed(2)} [${s.low.toFixed(2)}, ${s.high.toFixed(2)}]`}</text>
              </g>
            );
          })}
          <text x="350" y="14" textAnchor="middle" fill="#9ca3af">Standardized mean difference (Cohen&apos;s d)</text>
        </g>
      </svg>
    </div>
  );
}

function PowerCurve({ height }: { height: number }) {
  // Power for two-sample t-test, effect size d=0.5, α=0.05, varying n per group.
  const data = useMemo(() => {
    const out: { n: number; d2: number; d5: number; d8: number }[] = [];
    const power = (n: number, d: number) => {
      // Approximation: noncentrality λ = d * sqrt(n/2), use normal approx for power.
      const lambda = d * Math.sqrt(n / 2);
      const z = 1.96 - lambda;
      // 1 - Φ(z)
      const phi = 0.5 * (1 + Math.tanh((z * Math.sqrt(2 / Math.PI)) * (1 + 0.044715 * z * z)));
      return Math.max(0, Math.min(1, 1 - phi));
    };
    for (let n = 5; n <= 200; n += 5) {
      out.push({ n, d2: power(n, 0.2), d5: power(n, 0.5), d8: power(n, 0.8) });
    }
    return out;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="n" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" label={{ value: "Sample size per group", fill: "#9ca3af", fontSize: 11, position: "insideBottom", offset: -4 }} />
        <YAxis domain={[0, 1]} tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }} />
        <ReferenceLine y={0.8} stroke="#9ca3af" strokeDasharray="4 2" label={{ value: "power = 0.80", fill: "#9ca3af", fontSize: 10 }} />
        <Line type="monotone" dataKey="d2" stroke="#94a3b8" strokeWidth={2} dot={false} name="d = 0.2 (small)" />
        <Line type="monotone" dataKey="d5" stroke="#60a5fa" strokeWidth={2} dot={false} name="d = 0.5 (medium)" />
        <Line type="monotone" dataKey="d8" stroke="#10b981" strokeWidth={2} dot={false} name="d = 0.8 (large)" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BayesianUpdate({ height }: { height: number }) {
  // Beta priors → posterior after 7/10 successes
  const data = useMemo(() => {
    const out: { x: number; prior: number; likelihood: number; posterior: number }[] = [];
    // Prior Beta(2, 2), Likelihood Binomial(7, 10), Posterior Beta(9, 5)
    const betaPdf = (x: number, a: number, b: number) => {
      if (x <= 0 || x >= 1) return 0;
      // unnormalized
      return Math.pow(x, a - 1) * Math.pow(1 - x, b - 1);
    };
    // Compute and normalize so peak is ~1.0 for plotting clarity
    const priorRaw: number[] = [];
    const postRaw: number[] = [];
    const likeRaw: number[] = [];
    const xs: number[] = [];
    for (let x = 0.01; x < 1; x += 0.01) {
      xs.push(x);
      priorRaw.push(betaPdf(x, 2, 2));
      postRaw.push(betaPdf(x, 9, 5));
      likeRaw.push(Math.pow(x, 7) * Math.pow(1 - x, 3));
    }
    const norm = (arr: number[]) => {
      const m = Math.max(...arr);
      return arr.map((v) => v / m);
    };
    const pN = norm(priorRaw);
    const lN = norm(likeRaw);
    const poN = norm(postRaw);
    for (let i = 0; i < xs.length; i++) {
      out.push({ x: +xs[i].toFixed(2), prior: pN[i], likelihood: lN[i], posterior: poN[i] });
    }
    return out;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" label={{ value: "θ (true rate)", fill: "#9ca3af", fontSize: 11, position: "insideBottom", offset: -4 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }} />
        <Line type="monotone" dataKey="prior" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 2" name="Prior Beta(2,2)" />
        <Line type="monotone" dataKey="likelihood" stroke="#f97316" strokeWidth={2} dot={false} name="Likelihood (7/10)" />
        <Line type="monotone" dataKey="posterior" stroke="#a78bfa" strokeWidth={2.5} dot={false} name="Posterior Beta(9,5)" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MultipleComparisons({ height }: { height: number }) {
  const data = useMemo(() => {
    const out: { k: number; familyWise: number; bonf: number }[] = [];
    for (let k = 1; k <= 50; k++) {
      out.push({
        k,
        familyWise: 1 - Math.pow(0.95, k),
        bonf: 0.05,
      });
    }
    return out;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="k" tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" label={{ value: "Number of independent tests (k)", fill: "#9ca3af", fontSize: 11, position: "insideBottom", offset: -4 }} />
        <YAxis domain={[0, 1]} tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#374151" />
        <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }} formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))} />
        <ReferenceLine y={0.05} stroke="#9ca3af" strokeDasharray="4 2" label={{ value: "nominal α=0.05", fill: "#9ca3af", fontSize: 10 }} />
        <Line type="monotone" dataKey="familyWise" stroke="#ef4444" strokeWidth={2.5} dot={false} name="P(≥1 false positive)" />
        <Line type="monotone" dataKey="bonf" stroke="#10b981" strokeWidth={2} dot={false} name="Bonferroni-corrected α/k" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Methods data ────────────────────────────────────────────────────────────

const METHODS: Method[] = [
  {
    slug: "p-value",
    name: "p-value & Null Hypothesis Significance Testing",
    shortName: "p-value / NHST",
    family: "Inferential (Frequentist)",
    familyColor: "blue",
    problem:
      "How likely is the pattern we just observed if, in truth, nothing is going on? NHST gives a yes/no answer to that question — at a pre-declared error rate — without ever telling you how big the effect is or how likely the theory is to be true.",
    howItWorks: [
      { kind: "para", text: "Assume a specific null hypothesis (H₀ — typically 'no effect' or 'no difference'). Pick a test statistic whose sampling distribution under H₀ you can compute (t, F, χ², z, …). Compute the observed value of that statistic from the data. The p-value is the probability — under H₀ — of observing a statistic at least as extreme as what you got. If p falls below the pre-chosen threshold α (conventionally 0.05), you reject H₀; otherwise you fail to reject it." },
      { kind: "math", tex: "p = P(|T| ≥ |t_obs| | H₀ true)", label: "two-sided" },
      { kind: "para", text: "α is the long-run false-positive rate: across many imagined repetitions of a true H₀, you would mistakenly reject it 100·α% of the time. The p-value is NOT P(H₀ | data); it is not the probability that the result was due to chance; and it is not 1 − P(theory)." },
    ],
    workedExample: [
      { kind: "para", text: "A two-sample t-test compares mean reaction times between a placebo group (n=50, M=420 ms, SD=80) and a treatment group (n=50, M=395 ms, SD=85). The t-statistic is t = (420 − 395) / √(80²/50 + 85²/50) ≈ 1.51 on 98 df, giving p ≈ 0.134. At α=0.05, we fail to reject H₀ — but we have NOT shown the drug is ineffective; we have shown that this sample does not provide strong evidence against the no-effect model." },
    ],
    argumentsFor: [
      "Familiar, well-defined long-run error control — α has a clean operational meaning under H₀.",
      "Cheap to compute and easy to pre-register: no priors required.",
      "Sensible default for clean, randomized, single-test designs (e.g. a single RCT primary endpoint).",
    ],
    pitfalls: [
      "Treating p < 0.05 as 'real' and p > 0.05 as 'no effect'. The threshold is a convention; nothing magical happens at 0.05.",
      "p-hacking: testing many specifications and reporting only the significant one inflates the actual false-positive rate far above α.",
      "Conflating statistical significance with practical importance. A trivial effect can be 'highly significant' at large n.",
      "Reporting p without an effect size or confidence interval — the headline number that often matters most.",
    ],
    figure: NormalCurveWithRejection,
    figureCaption:
      "Standard normal under H₀. Red shaded tails are the two-sided rejection region for α=0.05 (|z| > 1.96). The p-value is the area in the tail beyond the observed |z|.",
  },
  {
    slug: "confidence-interval",
    name: "Confidence Intervals",
    shortName: "Confidence intervals",
    family: "Inferential (Frequentist)",
    familyColor: "blue",
    problem:
      "We almost never just want a yes/no significance decision — we want a range of plausible values for the parameter. A confidence interval supplies that range with a long-run coverage guarantee.",
    howItWorks: [
      { kind: "para", text: "A 95% CI is constructed by a procedure that, across many imagined repetitions of the study, would contain the true parameter 95% of the time. For a sample mean of an approximately normal quantity:" },
      { kind: "math", tex: "CI₉₅ = x̄ ± 1.96 · (s / √n)" },
      { kind: "para", text: "Critically, a 95% CI does NOT mean 'there is a 95% probability the parameter lies in this specific interval.' The parameter is fixed; the interval is random. Once a particular CI is computed, the parameter is either in it or not — but the procedure produces an interval that covers the truth 95% of the time in the long run." },
    ],
    workedExample: [
      { kind: "para", text: "A trial reports a treatment effect of −5.2 points on a 0–100 symptom scale with 95% CI [−9.8, −0.6]. Interpretation: the data are consistent with effects anywhere from a clinically meaningful 9.8-point reduction to a barely-perceptible 0.6-point reduction. The interval excludes 0, so the result is 'statistically significant' at α=0.05 — but the CI also tells you the minimum reduction we cannot rule out is tiny. That's information a bare p-value would have hidden." },
    ],
    argumentsFor: [
      "Always more informative than a bare p-value — it shows magnitude and precision in one shot.",
      "Plays the role of significance testing for free: if 0 (or any reference value) is outside the 95% CI, the corresponding p < 0.05.",
      "Reveals when a 'null result' is actually inconclusive (very wide CI) vs. genuinely tight around zero.",
    ],
    pitfalls: [
      "The Bayesian-credible-interval interpretation. People keep saying 'I'm 95% sure the parameter is in here' — that's a credible interval, not a CI.",
      "Eyeballing overlap of two CIs to compare groups. Two CIs can overlap and the difference can still be statistically significant; the right test is on the difference itself.",
      "Treating the CI as the truth-bound. Misspecification, selection, and bias outside the model assumptions are not in the CI.",
    ],
    figure: CIIntervals,
    figureCaption:
      "20 simulated 95% confidence intervals around a true mean of 0. Green intervals cover μ=0; red ones miss it. Over many repetitions, ~95% should cover.",
  },
  {
    slug: "effect-size",
    name: "Effect Size",
    shortName: "Effect size",
    family: "Inferential (Frequentist)",
    familyColor: "amber",
    problem:
      "p-values answer 'is there an effect?' but not 'how big?'. Effect size puts magnitude on a common scale so studies, treatments, and entire literatures can be compared.",
    howItWorks: [
      { kind: "para", text: "Effect size is any standardized quantification of magnitude. The most common families:" },
      { kind: "list", items: [
        "Cohen's d — standardized mean difference: (μ₁ − μ₂) / σ_pooled. Conventions: 0.2 = small, 0.5 = medium, 0.8 = large.",
        "r — Pearson correlation, also Cohen-tagged 0.1 / 0.3 / 0.5.",
        "η² and partial η² — proportion of variance explained in ANOVA / GLM.",
        "Odds ratio, relative risk, risk difference — for binary outcomes.",
        "Number-needed-to-treat (NNT) — clinically interpretable; 1/(risk difference).",
      ]},
      { kind: "math", tex: "Cohen's d = (M₁ − M₂) / s_pooled" },
    ],
    workedExample: [
      { kind: "para", text: "A teaching-intervention study finds a mean test-score difference of 4.0 points between conditions (SD ≈ 8). Cohen's d = 4 / 8 = 0.5 — a medium effect. With n=400 per arm, this would be 'highly significant' (p < 0.0001), but reporting only the p-value would obscure that half of the standard deviation worth of effect is what showed up. By contrast, a literature averaging d ≈ 0.05 (e.g. some 'priming' effects) can also be highly significant at huge n but is practically zero." },
    ],
    argumentsFor: [
      "Scale-free — comparable across studies, instruments, and outcome measures.",
      "Required for meta-analysis: forest plots aggregate standardized effects, not p-values.",
      "Forces the analyst to distinguish 'detected an effect' from 'detected a useful effect'.",
    ],
    pitfalls: [
      "Treating Cohen's labels (small/medium/large) as universal. They're rough heuristics; a 'small' clinical effect can be vital, and a 'large' effect from a noisy proxy can be meaningless.",
      "Inflating effect sizes by computing them only on the studies that survived significance filtering ('winner's curse' / publication bias).",
      "Standardizing by an in-sample SD that is itself unstable in small samples — d can be wildly noisy at n < 30.",
    ],
    figure: EffectSizeOverlap,
    figureCaption:
      "Two normal distributions with σ=1 and means 0 vs 0.8. Cohen's d = 0.8 (large). The overlap region quantifies how distinguishable the two populations are at the individual level.",
  },
  {
    slug: "correlation",
    name: "Correlation (and the Causation Trap)",
    shortName: "Correlation",
    family: "Descriptive / Causal",
    familyColor: "orange",
    problem:
      "We want a single number that summarizes how tightly two variables move together. We almost always also want to know whether one causes the other — but correlation alone cannot answer that.",
    howItWorks: [
      { kind: "para", text: "Pearson's r measures linear association between two continuous variables, bounded by [−1, +1]:" },
      { kind: "math", tex: "r = Σ(xᵢ − x̄)(yᵢ − ȳ) / √[Σ(xᵢ − x̄)² · Σ(yᵢ − ȳ)²]" },
      { kind: "para", text: "Spearman's ρ uses ranks instead of raw values — robust to monotone transformations and outliers. Kendall's τ counts concordant vs. discordant pairs. All three give 0 under independence and ±1 under perfect monotone relationships." },
      { kind: "para", text: "None of them implies causation. A nonzero r between X and Y is consistent with: X → Y, Y → X, a common cause Z → (X, Y), selection on a common effect, or chance. Distinguishing these requires either (a) experimental intervention or (b) an explicit causal model + identification strategy (see Causal Inference)." },
    ],
    workedExample: [
      { kind: "para", text: "Ice-cream sales and drownings are strongly positively correlated across months (r ≈ 0.7). Neither causes the other; both are caused by hot weather. A naive ban on ice cream to prevent drownings would have no effect on the outcome but would correctly note that 'ice cream is statistically associated with mortality risk.' This is the canonical confounding example." },
    ],
    argumentsFor: [
      "Cheap, easy, and a useful first-pass diagnostic for linear association.",
      "Robust nonparametric variants (Spearman, Kendall) handle non-normal or ranked data.",
      "Foundation for downstream techniques: regression, PCA, factor analysis, MANOVA.",
    ],
    pitfalls: [
      "The headline pitfall: causal inference from observational correlation. Reporters and policymakers chronically do this.",
      "Anscombe's quartet: identical r values can hide wildly different relationships (linear, curved, single outlier driving it). Always plot the data.",
      "Restricted-range attenuation: r computed on a narrow slice of one variable can shrink toward 0 even when the underlying relationship is strong.",
      "Pearson's r misses monotone-but-nonlinear relationships entirely — always check Spearman's ρ as a sanity check.",
    ],
    figure: CorrelationScatter,
    figureCaption:
      "Scatter with simulated noise and a fitted least-squares line. The fitted slope captures the linear part; the residual spread tells you r ≈ 0.7. Causation here is artificial — the simulator literally generated y from x.",
  },
  {
    slug: "odds-ratio",
    name: "Odds Ratio & Relative Risk",
    shortName: "Odds ratio / RR",
    family: "Epidemiology / Categorical",
    familyColor: "rose",
    problem:
      "When the outcome is binary (sick / not sick, voted / didn't vote, default / didn't default), how do we summarize the effect of an exposure in a way that travels between studies, designs, and outcome base rates?",
    howItWorks: [
      { kind: "para", text: "Two-by-two contingency table with cells a, b (exposed: event, no event) and c, d (unexposed). Two summaries:" },
      { kind: "math", tex: "RR = [a/(a+b)] / [c/(c+d)]", label: "Relative Risk" },
      { kind: "math", tex: "OR = (a·d) / (b·c)", label: "Odds Ratio" },
      { kind: "para", text: "RR is the ratio of probabilities; OR is the ratio of odds. They are approximately equal when the outcome is rare (<10%); they diverge sharply when it's common. OR is symmetric in exposure↔outcome and is the natural output of logistic regression, but it overstates RR for common outcomes." },
    ],
    workedExample: [
      { kind: "para", text: "A retrospective study finds 30 of 100 exposed and 10 of 100 unexposed developed the outcome. RR = 0.30 / 0.10 = 3.0 — the exposed group's risk is 3× higher. OR = (30·90) / (70·10) = 3.86 — the odds ratio is larger because the outcome is not rare. Reporting only OR would lead a casual reader to overstate the actual risk increase." },
    ],
    argumentsFor: [
      "Robust to outcome base rate — useful for combining studies with different background prevalences.",
      "OR is the only one of the two estimable from case-control designs (where exposed/unexposed denominators aren't known).",
      "Logarithm of OR/RR is approximately normal, so confidence intervals and meta-analysis work cleanly on the log scale.",
    ],
    pitfalls: [
      "Reporting OR as if it were RR when the outcome is common (>10%) — the most prevalent epidemiologic misreport in pop-science writing.",
      "Misinterpreting a large RR for a tiny absolute baseline: 'doubles your risk!' of something that happens 1 in 10,000 means going from 1 to 2 in 10,000.",
      "Confounding: an OR/RR is only a causal effect if the exposed and unexposed groups are exchangeable. Otherwise it's a descriptive association.",
    ],
    figure: TwoByTwoTable,
    figureCaption:
      "Canonical 2×2 contingency table. The shaded cell is the exposed-event cell. OR = ad/bc; RR = [a/(a+b)] / [c/(c+d)]. Both reduce to 1 under independence.",
  },
  {
    slug: "regression",
    name: "Regression: Linear & Logistic",
    shortName: "Regression",
    family: "Inferential / Prediction",
    familyColor: "green",
    problem:
      "We want to predict (or explain) one outcome from one or more predictors, account for confounders, and quantify how much each predictor contributes — on a scale we can defend in a manuscript.",
    howItWorks: [
      { kind: "para", text: "Linear regression models a continuous outcome as a linear combination of predictors plus normally distributed noise:" },
      { kind: "math", tex: "yᵢ = β₀ + β₁xᵢ + … + εᵢ,  εᵢ ~ N(0, σ²)" },
      { kind: "para", text: "Estimation is by ordinary least squares (OLS) — find the βs that minimize Σ(yᵢ − ŷᵢ)². Each coefficient β_k is the average change in y per unit change in x_k, holding all other predictors fixed." },
      { kind: "para", text: "Logistic regression models a binary outcome through the log-odds (logit):" },
      { kind: "math", tex: "log[p / (1 − p)] = β₀ + β₁x₁ + …" },
      { kind: "para", text: "The exponentiated coefficient exp(β_k) is the odds ratio per unit change in x_k. Maximum likelihood replaces OLS; the link function is the logit and the family is binomial. Logistic is the canonical entry point to generalized linear models." },
    ],
    workedExample: [
      { kind: "para", text: "A health study regresses systolic blood pressure on age, BMI, and a smoking indicator. The fitted line is SBP = 90 + 0.5·age + 0.8·BMI + 6·smoker. Interpretation: holding age and BMI fixed, smokers average 6 mmHg higher. The 95% CI on the smoking coefficient is [3.5, 8.5]; we can rule out 0 effect at α=0.05 and the data are consistent with effects from 3.5 to 8.5 mmHg. For a binary outcome (e.g. hypertensive diagnosis), the same predictors fit by logistic regression report exp(β_smoke) = 2.3 — smokers have ~2.3× the odds of hypertension, adjusted for age and BMI." },
    ],
    argumentsFor: [
      "Coefficients give interpretable, per-unit causal-like statements (under the model assumptions).",
      "Handles multiple predictors simultaneously — the workhorse of confounder adjustment.",
      "Logistic regression extends naturally to categorical outcomes, survival (Cox), counts (Poisson), and clustered data (mixed-effects).",
    ],
    pitfalls: [
      "Treating β as causal when the design is observational and confounders are uncontrolled.",
      "Ignoring nonlinearity. A straight line through a curve gives a deceptively small slope and large residuals.",
      "Multicollinearity: tightly correlated predictors give unstable, sign-flipping coefficients.",
      "Logistic-regression overfitting in small samples — rule of thumb 10 events per predictor.",
      "Confusing significance of a coefficient with importance: a tiny but precisely estimated β can be 'p<0.001' yet practically irrelevant.",
    ],
    figure: LogisticCurve,
    figureCaption:
      "Logistic S-curve (green) bounds outcomes to [0,1]; the linear extrapolation (gray) breaks above 1 and below 0. Logistic regression is what you reach for when the outcome is binary.",
  },
  {
    slug: "meta-analysis",
    name: "Meta-analysis & Forest Plots",
    shortName: "Meta-analysis",
    family: "Synthesis",
    familyColor: "violet",
    problem:
      "No single study is the truth. How do we aggregate effect estimates across many studies — each with its own sample size, design, and noise — into a single, more precise summary?",
    howItWorks: [
      { kind: "para", text: "Meta-analysis weights each study's effect by the inverse of its variance and takes a (weighted) average. Two flavors:" },
      { kind: "list", items: [
        "Fixed-effect: assumes all studies estimate the same true effect; weights are 1/SEᵢ². Only sampling error varies.",
        "Random-effects: allows the true effect to vary across studies (e.g. by population). Weights are 1/(SEᵢ² + τ²), where τ² is the between-study variance.",
      ]},
      { kind: "math", tex: "θ̂_pooled = Σ wᵢ θ̂ᵢ / Σ wᵢ" },
      { kind: "para", text: "Forest plot: each study is one row, plotted as a point (effect estimate) with a horizontal CI bar. The summary diamond at the bottom shows the pooled effect and its CI. Heterogeneity is summarized by I² (% of variance due to between-study differences) and τ² (between-study standard deviation)." },
    ],
    workedExample: [
      { kind: "para", text: "Seven randomized trials of a cognitive-behavioral intervention report standardized mean differences ranging from d = 0.10 to d = 0.55. A random-effects meta-analysis yields a pooled d = 0.36, 95% CI [0.24, 0.48], I² = 31%. Interpretation: a small-to-medium effect that survives heterogeneity, but the 31% I² and the spread on the forest plot say to take a published 'd = 0.55' result with skepticism — most studies came in lower." },
    ],
    argumentsFor: [
      "Increases precision dramatically — total sample size = sum of study sample sizes.",
      "Reveals heterogeneity that no single study could detect, and motivates moderator analyses (subgroup, meta-regression).",
      "Forest plots make publication bias visible (funnel-plot asymmetry, small-study effects).",
    ],
    pitfalls: [
      "Garbage in, garbage out: pooling biased studies produces a biased pooled estimate, often with deceptively tight CIs.",
      "Publication bias: small null studies don't get published, so the published literature's mean overshoots the truth. Funnel plots and trim-and-fill help, imperfectly.",
      "Apples-and-oranges: pooling studies that operationalize the construct differently (different doses, different populations, different outcome scales) hides what the summary effect actually means.",
      "Treating high I² as just a number to report. High heterogeneity is the message — different populations behaved differently.",
    ],
    figure: ForestPlot,
    figureCaption:
      "Synthetic forest plot. Each blue square is a study effect (size ∝ weight) with a horizontal 95% CI; the gold diamond is the random-effects pooled estimate. The dashed vertical line is null (d=0); the diamond sits clearly to the right.",
  },
  {
    slug: "power",
    name: "Statistical Power & Sample Size",
    shortName: "Power",
    family: "Experimental Design",
    familyColor: "teal",
    problem:
      "If the effect we're looking for is real and has a particular size, what's the probability our study will actually detect it? Underpowered studies waste time and people — and when they do hit p<0.05, they overestimate the true effect.",
    howItWorks: [
      { kind: "para", text: "Power is 1 − β, where β is the probability of failing to reject H₀ when an alternative H_A is true (a Type II error). It depends on four things: the true effect size, the sample size, the α level, and the chosen test." },
      { kind: "math", tex: "Power = P(reject H₀ | H_A true)" },
      { kind: "para", text: "Convention is to aim for power = 0.80 at α = 0.05 for the smallest effect size you would care about detecting. Power analysis inverts the calculation: 'given a target effect d, α, and power, what n do I need?'" },
    ],
    workedExample: [
      { kind: "para", text: "A pilot suggests a treatment effect of d = 0.5 (Cohen's medium). To detect this in a two-sample t-test with α = 0.05 (two-sided) and 80% power, you need ~64 participants per arm (n ≈ 128 total). At d = 0.2 (small effect), the same setup demands ~393 per arm. At d = 0.8 (large), only ~26 per arm. Power scales steeply with the effect you're betting on — and many fields' replication crises trace back to chronically chasing d = 0.2 effects with n = 30." },
    ],
    argumentsFor: [
      "Pre-experiment power analysis is the only honest way to choose sample size.",
      "Reveals which effect sizes a planned study can realistically detect — and which it can't.",
      "Forces a quantitative judgment about the smallest effect size worth detecting (SESOI).",
    ],
    pitfalls: [
      "Post-hoc 'observed power' computed from the observed effect: mathematically equivalent to the p-value and tells you nothing new.",
      "Powering for an inflated effect from a small pilot — the pilot's d is biased upward and the resulting study is still underpowered.",
      "Underpowered studies that hit significance produce inflated effect estimates ('winner's curse') and are very poor predictors of replication.",
      "Ignoring power for secondary endpoints — if you didn't power for them, you don't get to claim them.",
    ],
    figure: PowerCurve,
    figureCaption:
      "Power as a function of per-group sample size for d = 0.2, 0.5, 0.8 (two-sample t, two-sided α = 0.05, normal approximation). The dashed horizontal line is the 0.80 convention.",
  },
  {
    slug: "bayesian",
    name: "Bayesian Inference",
    shortName: "Bayesian inference",
    family: "Bayesian",
    familyColor: "purple",
    problem:
      "Frequentist methods answer 'how surprised should I be by this data, given H₀?'. Bayesian methods answer the question most people actually want: 'given this data, what should I now believe about the parameter?'",
    howItWorks: [
      { kind: "para", text: "Treat the parameter θ as a random variable with a prior distribution p(θ) encoding pre-data belief. Multiply by the likelihood p(data|θ) and renormalize to get the posterior:" },
      { kind: "math", tex: "p(θ | data) ∝ p(data | θ) · p(θ)" },
      { kind: "para", text: "The posterior is a full probability distribution over θ — you can read off a point estimate (mean, median, MAP), a credible interval (95% mass), or compute P(θ > 0 | data) directly. Modern Bayesian work uses MCMC samplers (Stan, PyMC, JAGS) or variational inference to draw from posteriors that have no closed form." },
    ],
    workedExample: [
      { kind: "para", text: "Estimate a conversion rate θ for a new feature. Prior Beta(2,2) — weakly favoring 50% but open to anything. Observe 7 conversions in 10 visits. By conjugacy, the posterior is Beta(2+7, 2+3) = Beta(9, 5), with mean 9/14 ≈ 0.64 and a 95% credible interval of about [0.40, 0.85]. We can state directly: 'There's a 95% posterior probability that the true conversion rate is between 40% and 85%.' That's exactly the sentence frequentist CIs don't license." },
    ],
    argumentsFor: [
      "Posterior probability is the answer most people actually want — and the only one safe to read literally as 'how sure am I'.",
      "Cleanly incorporates prior knowledge — useful when sample sizes are small and external evidence is strong (rare-disease trials, physics constants).",
      "Hierarchical Bayes performs principled partial pooling — small-group estimates shrink toward the grand mean and stop overfitting noise.",
      "Updating is sequential and lossless: yesterday's posterior is tomorrow's prior.",
    ],
    pitfalls: [
      "Priors matter, and aren't always defensible to other readers. 'Where did 𝒩(0, 1) come from?' is a fair question.",
      "Computational cost: MCMC takes orders of magnitude longer than running a t-test, and diagnosing chain convergence is its own craft.",
      "Posteriors look certain even when the model is wrong. Bayesian intervals don't include model-misspecification error any more than CIs do.",
      "'Default' priors are often improper or sneakily informative on transformed scales (e.g. flat in log-odds is not flat in probability).",
    ],
    figure: BayesianUpdate,
    figureCaption:
      "Prior Beta(2,2) (gray dashed), likelihood after 7 of 10 successes (orange), and posterior Beta(9,5) (purple). The posterior is sharper than either input because data and prior have been combined.",
  },
  {
    slug: "multiple-comparisons",
    name: "Multiple Comparisons & Bonferroni Correction",
    shortName: "Multiple comparisons",
    family: "Inferential (Frequentist)",
    familyColor: "rose",
    problem:
      "Run 20 independent tests at α = 0.05 and you should expect roughly one false positive even when all 20 nulls are true. Run a genome-wide scan with 1,000,000 SNPs and you'll get 50,000 false positives. Without correction, large-scale testing produces guaranteed noise that looks like discoveries.",
    howItWorks: [
      { kind: "para", text: "Family-wise error rate (FWER) is the probability of at least one false positive across k tests. Under independence:" },
      { kind: "math", tex: "FWER = 1 − (1 − α)^k" },
      { kind: "para", text: "Bonferroni: test each at α/k. Conservative, guarantees FWER ≤ α regardless of independence. Holm's step-down is uniformly better and still controls FWER. Benjamini-Hochberg controls the false discovery rate (FDR) instead — the expected proportion of false positives among rejected nulls — and is much more powerful when many tests are truly non-null (genomics, neuroimaging)." },
    ],
    workedExample: [
      { kind: "para", text: "An fMRI study tests for activation in 100,000 voxels at α=0.05 uncorrected. By chance alone, ~5,000 voxels will 'light up'. Bonferroni demands α' = 0.05/100,000 = 5×10⁻⁷ — only voxels with extreme z-scores survive, almost certainly real, but most genuine but moderate signals are lost. BH-FDR at q=0.05 keeps the expected proportion of false discoveries at ≤5% among reported voxels — far more rejections, at the cost of permitting some false ones." },
    ],
    argumentsFor: [
      "Family-wise control is what you want when even one false positive is catastrophic (regulatory decisions, drug approvals).",
      "FDR control is the right balance when you're screening: large k, many real effects expected, false positives are tolerable in proportion.",
      "Pre-specifying the multiple-testing strategy short-circuits the temptation to keep testing until something works.",
    ],
    pitfalls: [
      "Bonferroni is too conservative when tests are correlated (genomics, neuroimaging) — it throws away real findings.",
      "'Garden of forking paths': informally hunting through analytic choices is itself multiple testing — corrections only help if every test is counted.",
      "Reporting only the corrected p without context: a p_corr = 0.04 with k = 100 tests is much weaker evidence than a p = 0.04 from a single pre-registered test.",
      "Correcting only the 'primary' test while running 20 unreported secondary tests still inflates the error rate of the whole project.",
    ],
    figure: MultipleComparisons,
    figureCaption:
      "Red: probability of ≥1 false positive across k independent tests at uncorrected α=0.05 — hits 0.64 by k=20. Green: Bonferroni-corrected per-test level α/k stays below 0.05.",
  },
];

// ─── Color tokens ─────────────────────────────────────────────────────────────

const COLOR_TOKENS: Record<string, { dot: string; chip: string; accent: string; ring: string }> = {
  blue:   { dot: "bg-blue-500",    chip: "bg-blue-950/50 text-blue-300 border-blue-900/60",       accent: "text-blue-300",    ring: "ring-blue-500/40"    },
  amber:  { dot: "bg-amber-500",   chip: "bg-amber-950/50 text-amber-300 border-amber-900/60",    accent: "text-amber-300",   ring: "ring-amber-500/40"   },
  orange: { dot: "bg-orange-500",  chip: "bg-orange-950/50 text-orange-300 border-orange-900/60", accent: "text-orange-300",  ring: "ring-orange-500/40"  },
  rose:   { dot: "bg-rose-500",    chip: "bg-rose-950/50 text-rose-300 border-rose-900/60",       accent: "text-rose-300",    ring: "ring-rose-500/40"    },
  green:  { dot: "bg-emerald-500", chip: "bg-emerald-950/50 text-emerald-300 border-emerald-900/60", accent: "text-emerald-300", ring: "ring-emerald-500/40" },
  violet: { dot: "bg-violet-500",  chip: "bg-violet-950/50 text-violet-300 border-violet-900/60", accent: "text-violet-300",  ring: "ring-violet-500/40"  },
  teal:   { dot: "bg-teal-500",    chip: "bg-teal-950/50 text-teal-300 border-teal-900/60",       accent: "text-teal-300",    ring: "ring-teal-500/40"    },
  purple: { dot: "bg-purple-500",  chip: "bg-purple-950/50 text-purple-300 border-purple-900/60", accent: "text-purple-300",  ring: "ring-purple-500/40"  },
};

// ─── Section renderer ────────────────────────────────────────────────────────

function SectionBlock({ section }: { section: Section }) {
  if (section.kind === "para") return <p className="text-sm text-gray-300 leading-relaxed">{section.text}</p>;
  if (section.kind === "list") {
    return (
      <ul className="list-disc list-outside ml-5 space-y-1 text-sm text-gray-300">
        {section.items.map((item, i) => (
          <li key={i} className="leading-relaxed">{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="my-2">
      <pre className="font-mono text-sm bg-gray-950/70 border border-gray-800 rounded px-4 py-3 overflow-x-auto text-gray-100">
        {section.tex}
      </pre>
      {section.label && (
        <p className="text-[10px] font-mono text-gray-600 mt-1 text-right">{section.label}</p>
      )}
    </div>
  );
}

// ─── Related claims block ────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT:      "bg-green-900/60 text-green-300",
  NEVER_RESOLVES: "bg-gray-700/60 text-gray-400",
  DISPUTED:       "bg-yellow-900/60 text-yellow-300",
};

const VS_STYLE: Record<string, string> = {
  VERIFIED:    "bg-blue-950 text-blue-400 border border-blue-800/50",
  PROVISIONAL: "bg-gray-800/60 text-gray-500 border border-gray-700/50",
  DISPUTED:    "bg-red-950 text-red-400 border border-red-800/50",
  DEPRECATED:  "bg-gray-900 text-gray-600 border border-gray-800",
};

function ClaimRow({ claim }: { claim: ClaimHit }) {
  const preview = claim.text.length > 220 ? claim.text.slice(0, 220) + "…" : claim.text;
  return (
    <Link
      href={`/claims/${claim.id}`}
      className="block rounded border border-gray-800 hover:border-gray-600 bg-gray-900/40 px-3 py-2 transition-colors"
    >
      <p className="text-xs text-gray-300 leading-snug">{preview}</p>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE[claim.currentStatus] ?? STATUS_STYLE.DISPUTED}`}>
          {claim.currentStatus}
        </span>
        {claim.verificationStatus && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${VS_STYLE[claim.verificationStatus] ?? "bg-gray-800 text-gray-600"}`}>
            {claim.verificationStatus}
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StatisticsMethodsPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(METHODS[0].slug);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(METHODS.map((m) => [m.slug, true]))
  );
  const [relatedByMethod, setRelatedByMethod] = useState<Record<string, ClaimHit[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/statistics/related-claims")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRelatedByMethod(d);
      })
      .catch(() => {
        if (!cancelled) setRelatedByMethod({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return METHODS;
    return METHODS.filter((m) => {
      if (m.name.toLowerCase().includes(q)) return true;
      if (m.shortName.toLowerCase().includes(q)) return true;
      if (m.family.toLowerCase().includes(q)) return true;
      if (m.problem.toLowerCase().includes(q)) return true;
      return [...m.howItWorks, ...m.workedExample].some(
        (s) => s.kind !== "math" && (s.kind === "para" ? s.text : s.items.join(" ")).toLowerCase().includes(q),
      );
    });
  }, [query]);

  const visibleSlugs = useMemo(() => new Set(filtered.map((m) => m.slug)), [filtered]);

  const scrollTo = (slug: string) => {
    setActive(slug);
    if (!expanded[slug]) setExpanded((e) => ({ ...e, [slug]: true }));
    requestAnimationFrame(() => {
      const el = document.getElementById(`method-${slug}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const allExpanded = METHODS.every((m) => expanded[m.slug]);
  const toggleAll = () =>
    setExpanded(Object.fromEntries(METHODS.map((m) => [m.slug, !allExpanded])));

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
          <Link href="/statistics" className="hover:text-gray-300">/statistics</Link>
          <span>/</span>
          <span className="text-gray-300">methods</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Statistics — A Working Reference</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A textbook-style guide to the statistical methods that appear in scientific claims on this site. Each entry
          leads with the <em>problem it was built to solve</em> — then walks through the mechanism, a worked example,
          a figure, the arguments for it, and the common ways it gets misused. Where possible, real Epistemic Receipts
          claims that invoke the method are linked at the bottom of the entry.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Link href="/statistics" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">
            ← back to the full taxonomy (117 methods)
          </Link>
          <Link href="/search" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">
            search claims
          </Link>
          <Link href="/glossary" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">
            glossary
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-56 lg:shrink-0">
          <div className="lg:sticky lg:top-4 space-y-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter methods…"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
            <button
              onClick={toggleAll}
              className="w-full text-xs text-gray-400 hover:text-gray-200 border border-gray-800 hover:border-gray-600 rounded px-3 py-1.5 transition-colors"
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
            <nav className="border-l border-gray-800 pl-3 space-y-0.5">
              {METHODS.map((m) => {
                const c = COLOR_TOKENS[m.familyColor] ?? COLOR_TOKENS.blue;
                const isActive = active === m.slug;
                const visible = visibleSlugs.has(m.slug);
                if (!visible) return null;
                return (
                  <button
                    key={m.slug}
                    onClick={() => scrollTo(m.slug)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      isActive ? "bg-gray-800/80 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/60"
                    }`}
                  >
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <span className="truncate">{m.shortName}</span>
                  </button>
                );
              })}
              {visibleSlugs.size === 0 && (
                <p className="text-xs text-gray-600 py-2">No methods match.</p>
              )}
            </nav>
            <p className="text-[10px] font-mono text-gray-700 pt-2 border-t border-gray-800/60">
              {filtered.length} of {METHODS.length} methods
            </p>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 space-y-8">
          {filtered.map((m) => {
            const c = COLOR_TOKENS[m.familyColor] ?? COLOR_TOKENS.blue;
            const isOpen = expanded[m.slug] ?? true;
            const related = relatedByMethod?.[m.slug];
            return (
              <article
                key={m.slug}
                id={`method-${m.slug}`}
                className={`rounded-lg border border-gray-800 bg-gray-900/30 scroll-mt-4 ${
                  active === m.slug ? `ring-1 ${c.ring}` : ""
                }`}
              >
                <button
                  onClick={() => {
                    setActive(m.slug);
                    setExpanded((e) => ({ ...e, [m.slug]: !isOpen }));
                  }}
                  className="w-full text-left px-5 py-3 flex items-baseline justify-between gap-4 border-b border-gray-800/70 hover:bg-gray-900/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`shrink-0 w-2 h-2 rounded-full ${c.dot} self-center`} />
                      <h2 className="text-base font-semibold text-white">{m.name}</h2>
                    </div>
                    <p className="mt-1 text-[11px] font-mono text-gray-600">{m.family}</p>
                  </div>
                  <span className={`text-xs ${c.accent} shrink-0`}>{isOpen ? "▾" : "▸"}</span>
                </button>

                {isOpen && (
                  <div className="px-5 py-5 space-y-6">
                    {/* Problem it solves */}
                    <section>
                      <h3 className={`text-[10px] font-mono uppercase tracking-widest ${c.accent} mb-2`}>
                        Problem it solves
                      </h3>
                      <p className="text-sm text-gray-200 leading-relaxed">{m.problem}</p>
                    </section>

                    {/* Figure */}
                    <section className={`rounded border ${c.chip.split(" ").filter((s) => s.startsWith("border-")).join(" ")} bg-gray-950/40 px-3 pt-3 pb-4`}>
                      <h3 className={`text-[10px] font-mono uppercase tracking-widest ${c.accent} mb-2`}>
                        Figure
                      </h3>
                      <div className="bg-gray-950/60 rounded p-2">
                        {m.figure({ height: 260 })}
                      </div>
                      <p className="mt-2 text-[11px] text-gray-500 leading-snug">{m.figureCaption}</p>
                    </section>

                    {/* How it works */}
                    <section>
                      <h3 className={`text-[10px] font-mono uppercase tracking-widest ${c.accent} mb-2`}>
                        How it works
                      </h3>
                      <div className="space-y-3">
                        {m.howItWorks.map((s, i) => (
                          <SectionBlock key={i} section={s} />
                        ))}
                      </div>
                    </section>

                    {/* Worked example */}
                    <section>
                      <h3 className={`text-[10px] font-mono uppercase tracking-widest ${c.accent} mb-2`}>
                        Worked example
                      </h3>
                      <div className="space-y-3 border-l-2 border-gray-800 pl-4">
                        {m.workedExample.map((s, i) => (
                          <SectionBlock key={i} section={s} />
                        ))}
                      </div>
                    </section>

                    {/* Arguments for + Pitfalls */}
                    <section className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 mb-2">
                          Arguments for using it
                        </h3>
                        <ul className="space-y-1.5 text-sm text-gray-300">
                          {m.argumentsFor.map((a, i) => (
                            <li key={i} className="flex gap-2 leading-snug">
                              <span className="text-emerald-500 shrink-0">+</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-[10px] font-mono uppercase tracking-widest text-rose-300 mb-2">
                          Common misuses & pitfalls
                        </h3>
                        <ul className="space-y-1.5 text-sm text-gray-300">
                          {m.pitfalls.map((p, i) => (
                            <li key={i} className="flex gap-2 leading-snug">
                              <span className="text-rose-500 shrink-0">−</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>

                    {/* Related claims */}
                    <section>
                      <h3 className={`text-[10px] font-mono uppercase tracking-widest ${c.accent} mb-2`}>
                        Related claims in the database
                      </h3>
                      {related === undefined ? (
                        <p className="text-xs text-gray-600">Loading…</p>
                      ) : related && related.length > 0 ? (
                        <div className="space-y-2">
                          {related.map((claim) => (
                            <ClaimRow key={claim.id} claim={claim} />
                          ))}
                          <Link
                            href={`/search?q=${encodeURIComponent(m.shortName)}`}
                            className="block text-xs text-gray-400 hover:text-gray-200 underline underline-offset-2 pt-1"
                          >
                            search for more claims mentioning &ldquo;{m.shortName}&rdquo; →
                          </Link>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
                          No claims yet mention this method by name in their text. Try{" "}
                          <Link
                            href={`/search?q=${encodeURIComponent(m.shortName)}`}
                            className="text-gray-300 hover:text-white underline underline-offset-2"
                          >
                            a free-text search
                          </Link>
                          .
                        </p>
                      )}
                    </section>
                  </div>
                )}
              </article>
            );
          })}
        </main>
      </div>

      <div className="border-t border-gray-800 pt-6 mt-10 space-y-2">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the related-claims block uses a free-text match between method
          keywords and claim text. A claim mentioning &ldquo;p-value&rdquo; is not necessarily <em>about</em> p-values,
          but it is at minimum a place where that method appears in the published wording.
        </p>
        <p className="text-xs font-mono text-gray-700">
          method content curated 2026-06-02 · figures rendered with Recharts + inline SVG
        </p>
      </div>
    </div>
  );
}
