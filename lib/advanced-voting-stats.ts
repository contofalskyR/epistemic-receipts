import { prisma } from "@/lib/prisma";
import {
  bayesFactorFromChiSq,
  chiSquarePValue,
  interpretBF,
} from "@/lib/voting-stats";

// ── Public types ─────────────────────────────────────────────────────────────

export type ChangePoint = {
  year: number;
  direction: "up" | "down";
  cusumValue: number;
  passRate: number;
};

export type CusumResult = {
  changePoints: ChangePoint[];
  yearlyRates: { year: number; passRate: number; total: number; cusum: number }[];
};

export type BimodalityResult = {
  n: number;
  mean: number;
  variance: number;
  skewness: number;
  excessKurtosis: number;
  bimodalityCoefficient: number;
  isBimodal: boolean;
  interpretation: string;
  histogram: { binMin: number; binMax: number; count: number }[];
};

export type RunsTestResult = {
  n1: number;
  n2: number;
  runs: number;
  expectedRuns: number;
  zStat: number;
  pValue: number;
  clustered: boolean;
  interpretation: string;
};

export type WarPeriodResult = {
  warVotes: number;
  warPassRate: number;
  peaceVotes: number;
  peacePassRate: number;
  chiSq: number;
  pValue: number;
  bf10: number;
  bfInterpretation: string;
  perWar: { name: string; total: number; passRate: number }[];
  interpretation: string;
};

// ── War period config ───────────────────────────────────────────────────────

const WAR_PERIODS = [
  { name: "War of 1812", start: "1812-06-18", end: "1815-02-17" },
  { name: "Mexican-American War", start: "1846-05-13", end: "1848-02-02" },
  { name: "Civil War", start: "1861-04-12", end: "1865-04-09" },
  { name: "Spanish-American War", start: "1898-04-25", end: "1898-12-10" },
  { name: "World War I", start: "1917-04-06", end: "1918-11-11" },
  { name: "World War II", start: "1941-12-08", end: "1945-09-02" },
  { name: "Korean War", start: "1950-06-27", end: "1953-07-27" },
  { name: "Vietnam War", start: "1964-08-07", end: "1975-04-30" },
  { name: "Gulf War", start: "1991-01-17", end: "1991-02-28" },
  { name: "Iraq War", start: "2003-03-20", end: "2011-12-15" },
  { name: "Afghanistan", start: "2001-10-07", end: "2021-08-30" },
] as const;

// Two-tailed normal SF, used by the runs test.
function normCDF(z: number): number {
  if (z < 0) return 1 - normCDF(-z);
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const t = 1 / (1 + p * z);
  const phi = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  const poly = b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5;
  return 1 - phi * poly;
}

function twoTailedNormalP(z: number): number {
  const az = Math.abs(z);
  return 2 * (1 - normCDF(az));
}

// ── 1. CUSUM change point detection ─────────────────────────────────────────

type YearAggRow = { year: number; passed: number; total: number };

export async function getCusumChangePoints(): Promise<CusumResult> {
  const rows = await prisma.$queryRaw<YearAggRow[]>`
    SELECT
      EXTRACT(YEAR FROM lv."voteDate")::int AS year,
      COALESCE(SUM(CASE WHEN lv.result = 'passed' THEN 1 ELSE 0 END), 0)::int AS passed,
      COUNT(*)::int AS total
    FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s."ingestedBy" = 'voteview_v1'
      AND lv.result IN ('passed', 'failed')
      AND lv."voteDate" IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM lv."voteDate")
    ORDER BY year ASC
  `;

  const filtered = rows.filter((r) => r.total >= 5);
  if (filtered.length === 0) {
    return { changePoints: [], yearlyRates: [] };
  }

  // Overall mean pass rate, weighted by vote count.
  const totalVotes = filtered.reduce((s, r) => s + r.total, 0);
  const totalPassed = filtered.reduce((s, r) => s + r.passed, 0);
  const mu = totalVotes > 0 ? totalPassed / totalVotes : 0;

  // CUSUM sequence.
  let c = 0;
  const yearly: { year: number; passRate: number; total: number; cusum: number }[] = [];
  for (const r of filtered) {
    const rate = r.passed / r.total;
    c += rate - mu;
    yearly.push({ year: r.year, passRate: rate, total: r.total, cusum: c });
  }

  // Std of CUSUM values.
  const cMean = yearly.reduce((s, y) => s + y.cusum, 0) / yearly.length;
  const cVar =
    yearly.reduce((s, y) => s + (y.cusum - cMean) ** 2, 0) / Math.max(1, yearly.length - 1);
  const cStd = Math.sqrt(cVar);
  const threshold = 1.5 * cStd;

  // Local extrema with |C[t]| > threshold.
  const candidates: ChangePoint[] = [];
  for (let i = 1; i < yearly.length - 1; i++) {
    const prev = yearly[i - 1]!.cusum;
    const cur = yearly[i]!.cusum;
    const next = yearly[i + 1]!.cusum;
    if (Math.abs(cur) <= threshold) continue;
    const isMax = cur > prev && cur > next;
    const isMin = cur < prev && cur < next;
    if (!isMax && !isMin) continue;
    candidates.push({
      year: yearly[i]!.year,
      // CUSUM rising = pass rate above the long-run mean → "shift up".
      direction: isMax ? "up" : "down",
      cusumValue: cur,
      passRate: yearly[i]!.passRate,
    });
  }

  candidates.sort((a, b) => Math.abs(b.cusumValue) - Math.abs(a.cusumValue));
  const changePoints = candidates.slice(0, 8).sort((a, b) => a.year - b.year);

  return { changePoints, yearlyRates: yearly };
}

// ── 2. Bimodality test ─────────────────────────────────────────────────────

type MarginRow = { yesCount: number; noCount: number };

export async function getBimodalityResult(): Promise<BimodalityResult> {
  const rows = await prisma.$queryRaw<MarginRow[]>`
    SELECT lv."yesCount" AS "yesCount", lv."noCount" AS "noCount"
    FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s."ingestedBy" = 'voteview_v1'
      AND lv."yesCount" IS NOT NULL
      AND lv."noCount" IS NOT NULL
      AND (lv."yesCount" + lv."noCount") >= 10
    LIMIT 50000
  `;

  const margins: number[] = [];
  for (const r of rows) {
    const total = r.yesCount + r.noCount;
    if (total <= 0) continue;
    margins.push(r.yesCount / total);
  }

  const n = margins.length;
  const emptyHist = Array.from({ length: 20 }, (_, i) => ({
    binMin: i * 0.05,
    binMax: (i + 1) * 0.05,
    count: 0,
  }));

  if (n < 4) {
    return {
      n,
      mean: 0,
      variance: 0,
      skewness: 0,
      excessKurtosis: 0,
      bimodalityCoefficient: 0,
      isBimodal: false,
      interpretation: "Insufficient data for bimodality test.",
      histogram: emptyHist,
    };
  }

  let sum = 0;
  for (const m of margins) sum += m;
  const mean = sum / n;

  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const m of margins) {
    const d = m - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
    m4 += d2 * d2;
  }
  m2 /= n;
  m3 /= n;
  m4 /= n;

  const variance = m2;
  const sd = Math.sqrt(m2);
  const skewness = sd > 0 ? m3 / (sd * sd * sd) : 0;
  const excessKurtosis = m2 > 0 ? m4 / (m2 * m2) - 3 : 0;

  const adjustment = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  const bc = (skewness * skewness + 1) / (excessKurtosis + adjustment);
  const isBimodal = bc > 0.555;

  let interpretation: string;
  if (bc > 0.7) {
    interpretation =
      "Strong bimodality — votes cluster at near-unanimous and highly contested outcomes, with few in between.";
  } else if (isBimodal) {
    interpretation =
      "Moderate bimodality — vote margins lean toward two peaks (consensus and contested) more than a unimodal distribution.";
  } else {
    interpretation =
      "No bimodality detected — vote margins are not split between consensus and contested peaks.";
  }

  // Histogram: 20 bins of width 0.05 spanning [0, 1].
  const histogram = emptyHist.map((b) => ({ ...b }));
  for (const m of margins) {
    let idx = Math.floor(m / 0.05);
    if (idx >= 20) idx = 19;
    if (idx < 0) idx = 0;
    histogram[idx]!.count++;
  }

  return {
    n,
    mean,
    variance,
    skewness,
    excessKurtosis,
    bimodalityCoefficient: bc,
    isBimodal,
    interpretation,
    histogram,
  };
}

// ── 3. Runs test on contentious votes ───────────────────────────────────────

type ContentiousRow = { yesCount: number; noCount: number };

export async function getRunsTestResult(): Promise<RunsTestResult> {
  const rows = await prisma.$queryRaw<ContentiousRow[]>`
    SELECT lv."yesCount" AS "yesCount", lv."noCount" AS "noCount"
    FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s."ingestedBy" = 'voteview_v1'
      AND lv."yesCount" IS NOT NULL
      AND lv."noCount" IS NOT NULL
      AND lv."voteDate" IS NOT NULL
      AND (lv."yesCount" + lv."noCount") > 0
    ORDER BY lv."voteDate" ASC, lv.id ASC
  `;

  const sequence: boolean[] = [];
  for (const r of rows) {
    const total = r.yesCount + r.noCount;
    if (total <= 0) continue;
    sequence.push(r.yesCount / total < 0.55);
  }

  const n = sequence.length;
  let n1 = 0;
  for (const v of sequence) if (v) n1++;
  const n2 = n - n1;

  if (n1 === 0 || n2 === 0 || n < 2) {
    return {
      n1,
      n2,
      runs: 0,
      expectedRuns: 0,
      zStat: 0,
      pValue: 1,
      clustered: false,
      interpretation: "Insufficient variation for a runs test.",
    };
  }

  let runs = 1;
  for (let i = 1; i < n; i++) {
    if (sequence[i] !== sequence[i - 1]) runs++;
  }

  const N = n1 + n2;
  const expectedRuns = 1 + (2 * n1 * n2) / N;
  const varNum = 2 * n1 * n2 * (2 * n1 * n2 - N);
  const varDen = N * N * (N - 1);
  const variance = varDen > 0 ? varNum / varDen : 0;
  const zStat = variance > 0 ? (runs - expectedRuns) / Math.sqrt(variance) : 0;
  const pValue = twoTailedNormalP(zStat);
  const clustered = zStat < 0 && pValue < 0.05;

  let interpretation: string;
  if (clustered) {
    const pStr = pValue < 0.001 ? "p < .001" : `p = ${pValue.toFixed(3)}`;
    interpretation = `Close votes cluster significantly (${pStr}, z = ${zStat.toFixed(
      1,
    )}) — periods of congressional gridlock bundle together rather than scatter randomly.`;
  } else if (zStat > 0 && pValue < 0.05) {
    interpretation =
      "Close votes alternate more than chance would predict — fewer streaks than expected.";
  } else {
    interpretation =
      "No significant clustering — close votes are distributed roughly as a random sequence.";
  }

  return {
    n1,
    n2,
    runs,
    expectedRuns,
    zStat,
    pValue,
    clustered,
    interpretation,
  };
}

// ── 4. War period effect ────────────────────────────────────────────────────

type PassFailRow = { passed: number; failed: number };

async function passFailInRange(start: Date, end: Date): Promise<PassFailRow> {
  const rows = await prisma.$queryRaw<PassFailRow[]>`
    SELECT
      COALESCE(SUM(CASE WHEN lv.result = 'passed' THEN 1 ELSE 0 END), 0)::int AS passed,
      COALESCE(SUM(CASE WHEN lv.result = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed
    FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s."ingestedBy" = 'voteview_v1'
      AND lv."voteDate" >= ${start}
      AND lv."voteDate" <= ${end}
  `;
  return rows[0] ?? { passed: 0, failed: 0 };
}

async function totalPassFail(): Promise<PassFailRow> {
  const rows = await prisma.$queryRaw<PassFailRow[]>`
    SELECT
      COALESCE(SUM(CASE WHEN lv.result = 'passed' THEN 1 ELSE 0 END), 0)::int AS passed,
      COALESCE(SUM(CASE WHEN lv.result = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed
    FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s."ingestedBy" = 'voteview_v1'
      AND lv.result IN ('passed', 'failed')
  `;
  return rows[0] ?? { passed: 0, failed: 0 };
}

export async function getWarPeriodEffect(): Promise<WarPeriodResult> {
  const perWarRaw = await Promise.all(
    WAR_PERIODS.map(async (w) => {
      const start = new Date(`${w.start}T00:00:00.000Z`);
      const end = new Date(`${w.end}T23:59:59.999Z`);
      const agg = await passFailInRange(start, end);
      return { name: w.name, start, end, ...agg };
    }),
  );

  // Combine war periods, deduplicating overlap via interval union on day grain.
  // Iraq War (2003–2011) and Afghanistan (2001–2021) overlap; we union the
  // *date intervals* before re-aggregating so a single vote isn't double-counted.
  type Interval = { start: number; end: number };
  const intervals: Interval[] = WAR_PERIODS.map((w) => ({
    start: new Date(`${w.start}T00:00:00.000Z`).getTime(),
    end: new Date(`${w.end}T23:59:59.999Z`).getTime(),
  })).sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }

  let warPassed = 0;
  let warFailed = 0;
  for (const iv of merged) {
    const agg = await passFailInRange(new Date(iv.start), new Date(iv.end));
    warPassed += agg.passed;
    warFailed += agg.failed;
  }

  const total = await totalPassFail();
  const peacePassed = Math.max(0, total.passed - warPassed);
  const peaceFailed = Math.max(0, total.failed - warFailed);

  const warVotes = warPassed + warFailed;
  const peaceVotes = peacePassed + peaceFailed;
  const warPassRate = warVotes > 0 ? warPassed / warVotes : 0;
  const peacePassRate = peaceVotes > 0 ? peacePassed / peaceVotes : 0;

  // Chi-square on 2×2.
  const N = warVotes + peaceVotes;
  const colPassed = warPassed + peacePassed;
  const colFailed = warFailed + peaceFailed;
  let chiSq = 0;
  if (N > 0 && warVotes > 0 && peaceVotes > 0 && colPassed > 0 && colFailed > 0) {
    const eWP = (warVotes * colPassed) / N;
    const eWF = (warVotes * colFailed) / N;
    const ePP = (peaceVotes * colPassed) / N;
    const ePF = (peaceVotes * colFailed) / N;
    chiSq =
      (warPassed - eWP) ** 2 / eWP +
      (warFailed - eWF) ** 2 / eWF +
      (peacePassed - ePP) ** 2 / ePP +
      (peaceFailed - ePF) ** 2 / ePF;
  }

  const pValue = chiSquarePValue(chiSq, 1);
  const bf = bayesFactorFromChiSq(chiSq, 1, N);
  const bfInterpretation = interpretBF(bf.bf);

  // Per-war stats for the 3 largest wars (by vote total).
  const perWar = perWarRaw
    .map((w) => ({
      name: w.name,
      total: w.passed + w.failed,
      passRate: w.passed + w.failed > 0 ? w.passed / (w.passed + w.failed) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  let interpretation: string;
  if (warVotes === 0 || peaceVotes === 0) {
    interpretation = "Insufficient data to compare wartime and peacetime pass rates.";
  } else {
    const direction = warPassRate > peacePassRate ? "higher" : "lower";
    const diff = Math.abs(warPassRate - peacePassRate) * 100;
    const pStr = pValue < 0.001 ? "p < .001" : `p = ${pValue.toFixed(3)}`;
    interpretation = `Wartime pass rate is ${diff.toFixed(
      1,
    )}pp ${direction} than peacetime (χ²(1) = ${chiSq.toFixed(
      1,
    )}, ${pStr}); ${bfInterpretation.toLowerCase()}.`;
  }

  return {
    warVotes,
    warPassRate,
    peaceVotes,
    peacePassRate,
    chiSq,
    pValue,
    bf10: bf.bf,
    bfInterpretation,
    perWar,
    interpretation,
  };
}
