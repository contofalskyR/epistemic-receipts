import { prisma } from "@/lib/prisma";
import { ERAS } from "@/lib/us-presidents";

// ── Statistical helpers ──────────────────────────────────────────────────────

// Standard normal CDF — Abramowitz & Stegun 26.2.17, error < 7.5e-8.
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

function normSF(z: number): number {
  return 1 - normCDF(z);
}

// P(X > chiSq) for X ~ χ²(df).
// For df = 1, χ²(1) ≡ Z² so the result is exact via the normal SF.
// For df ≥ 2, use the Wilson-Hilferty cube-root approximation.
function chiSquarePValue(chiSq: number, df: number): number {
  if (!Number.isFinite(chiSq) || chiSq <= 0 || df < 1) return 1;
  if (df === 1) return 2 * normSF(Math.sqrt(chiSq));
  const z =
    (Math.cbrt(chiSq / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return normSF(z);
}

// BIC approximation (Wagenmakers 2007): BF₁₀ = exp((χ² − df·ln n) / 2).
// log10 of the BF is returned alongside so callers can render extreme values
// without serializing Infinity (which JSON.stringify turns into null).
function bayesFactorFromChiSq(
  chiSq: number,
  df: number,
  n: number,
): { bf: number; log10Bf: number } {
  if (n <= 1 || df <= 0 || !Number.isFinite(chiSq)) return { bf: 1, log10Bf: 0 };
  const lnBf = (chiSq - df * Math.log(n)) / 2;
  const log10Bf = lnBf / Math.LN10;
  // Number.MAX_VALUE ≈ 1.8e308; cap to avoid Infinity serializing as null.
  const bf = lnBf > 700 ? Number.MAX_VALUE : Math.exp(lnBf);
  return { bf, log10Bf };
}

// Jeffreys' scale, collapsed to 4 levels per direction.
function interpretBF(bf10: number): string {
  if (Number.isNaN(bf10) || bf10 < 0) return "Undefined";
  if (!Number.isFinite(bf10)) return "Decisive for H₁";
  if (bf10 === 0) return "Decisive for H₀";
  if (bf10 >= 100) return "Decisive for H₁";
  if (bf10 >= 10) return "Strong for H₁";
  if (bf10 >= 3) return "Moderate for H₁";
  if (bf10 >= 1) return "Anecdotal for H₁";
  if (bf10 >= 1 / 3) return "Anecdotal for H₀";
  if (bf10 >= 1 / 10) return "Moderate for H₀";
  if (bf10 >= 1 / 100) return "Strong for H₀";
  return "Decisive for H₀";
}

function cramersV(chiSq: number, n: number, minDim: number): number {
  if (n <= 0 || minDim <= 1 || !Number.isFinite(chiSq) || chiSq < 0) return 0;
  return Math.sqrt(chiSq / (n * (minDim - 1)));
}

function interpretCohensH(h: number): string {
  const a = Math.abs(h);
  if (a < 0.2) return "Small";
  if (a < 0.5) return "Medium";
  return "Large";
}

function interpretCramersV(v: number): string {
  if (v < 0.1) return "Small";
  if (v < 0.3) return "Medium";
  return "Large";
}

function linearRegression(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number; rSquared: number; tStat: number; pValue: number } {
  const n = xs.length;
  if (n < 3) return { slope: 0, intercept: 0, rSquared: 0, tStat: 0, pValue: 1 };
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
  }
  const xMean = sx / n;
  const yMean = sy / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - xMean;
    const dy = ys[i]! - yMean;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return { slope: 0, intercept: yMean, rSquared: 0, tStat: 0, pValue: 1 };
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const rSquared = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const yHat = intercept + slope * xs[i]!;
    const resid = ys[i]! - yHat;
    sse += resid * resid;
  }
  const mse = sse / (n - 2);
  const seSlope = mse > 0 ? Math.sqrt(mse / sxx) : 0;
  const tStat = seSlope > 0 ? slope / seSlope : 0;
  // Normal approximation for large df (n − 2). Voteview yields tens of thousands of rows,
  // so the t-distribution is indistinguishable from N(0,1) in the tails we care about.
  const pValue = 2 * normSF(Math.abs(tStat));
  return { slope, intercept, rSquared, tStat, pValue };
}

// ── Public types ─────────────────────────────────────────────────────────────

export type VotingInferenceResult = {
  chamberTest: {
    housePassRate: number;
    houseTotal: number;
    senatePassRate: number;
    senateTotal: number;
    chiSq: number;
    df: 1;
    pValue: number;
    cohensH: number;
    cohensHInterpretation: string;
    bf10: number;
    log10Bf10: number;
    bfInterpretation: string;
  };
  eraTest: {
    chiSq: number;
    df: number;
    pValue: number;
    cramersV: number;
    cramersVInterpretation: string;
    bf10: number;
    log10Bf10: number;
    bfInterpretation: string;
    eras: { label: string; total: number; passRate: number; zScore: number }[];
  };
  polarizationTrend: {
    slopePerDecade: number;
    intercept: number;
    rSquared: number;
    pValue: number;
    sampleSize: number;
    interpretation: string;
  };
};

// ── DB row shapes ────────────────────────────────────────────────────────────

type ChamberAggRow = { passed: number; failed: number };
type EraAggRow = { passed: number; failed: number };
type PolarizationRow = { yesCount: number; noCount: number; voteDate: Date };

// ── Main entry point ─────────────────────────────────────────────────────────

export async function getVotingInferenceStats(): Promise<VotingInferenceResult> {
  // Chamber pass/fail counts (Voteview only).
  const [houseRows, senateRows] = await Promise.all([
    prisma.$queryRaw<ChamberAggRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN lv.result = 'passed' THEN 1 ELSE 0 END), 0)::int AS passed,
        COALESCE(SUM(CASE WHEN lv.result = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed
      FROM "LegislativeVote" lv
      JOIN "Source" s ON s.id = lv."sourceId"
      WHERE s."ingestedBy" = 'voteview_v1'
        AND lv.chamber = 'House of Representatives'
    `,
    prisma.$queryRaw<ChamberAggRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN lv.result = 'passed' THEN 1 ELSE 0 END), 0)::int AS passed,
        COALESCE(SUM(CASE WHEN lv.result = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed
      FROM "LegislativeVote" lv
      JOIN "Source" s ON s.id = lv."sourceId"
      WHERE s."ingestedBy" = 'voteview_v1'
        AND lv.chamber = 'Senate'
    `,
  ]);
  const house = houseRows[0] ?? { passed: 0, failed: 0 };
  const senate = senateRows[0] ?? { passed: 0, failed: 0 };

  // Chamber chi-square (2×2).
  const a = house.passed;
  const b = house.failed;
  const c = senate.passed;
  const d = senate.failed;
  const houseTotal = a + b;
  const senateTotal = c + d;
  const chamberN = houseTotal + senateTotal;
  const totalPassed = a + c;
  const totalFailed = b + d;

  let chamberChiSq = 0;
  if (
    chamberN > 0 &&
    houseTotal > 0 &&
    senateTotal > 0 &&
    totalPassed > 0 &&
    totalFailed > 0
  ) {
    const eHP = (houseTotal * totalPassed) / chamberN;
    const eHF = (houseTotal * totalFailed) / chamberN;
    const eSP = (senateTotal * totalPassed) / chamberN;
    const eSF = (senateTotal * totalFailed) / chamberN;
    chamberChiSq =
      (a - eHP) ** 2 / eHP +
      (b - eHF) ** 2 / eHF +
      (c - eSP) ** 2 / eSP +
      (d - eSF) ** 2 / eSF;
  }

  const housePassRate = houseTotal > 0 ? a / houseTotal : 0;
  const senatePassRate = senateTotal > 0 ? c / senateTotal : 0;
  const cohensH =
    2 * (Math.asin(Math.sqrt(housePassRate)) - Math.asin(Math.sqrt(senatePassRate)));
  const chamberPValue = chiSquarePValue(chamberChiSq, 1);
  const chamberBF = bayesFactorFromChiSq(chamberChiSq, 1, chamberN);
  const chamberBfInterp = interpretBF(chamberBF.bf);

  // Era counts (k × 2).
  const eraResults = await Promise.all(
    ERAS.map(async (era) => {
      const start = new Date(`${era.start}T00:00:00.000Z`);
      const end = new Date(`${era.end}T23:59:59.999Z`);
      const rows = await prisma.$queryRaw<EraAggRow[]>`
        SELECT
          COALESCE(SUM(CASE WHEN lv.result = 'passed' THEN 1 ELSE 0 END), 0)::int AS passed,
          COALESCE(SUM(CASE WHEN lv.result = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed
        FROM "LegislativeVote" lv
        JOIN "Source" s ON s.id = lv."sourceId"
        WHERE s."ingestedBy" = 'voteview_v1'
          AND lv."voteDate" >= ${start}
          AND lv."voteDate" <= ${end}
      `;
      const r = rows[0] ?? { passed: 0, failed: 0 };
      return { label: era.label, passed: r.passed, failed: r.failed };
    }),
  );

  const eraActive = eraResults.filter((e) => e.passed + e.failed > 0);
  let eraChiSq = 0;
  let eraDf = 0;
  let eraN = 0;

  if (eraActive.length >= 2) {
    const eraTotalPassed = eraActive.reduce((s, e) => s + e.passed, 0);
    const eraTotalFailed = eraActive.reduce((s, e) => s + e.failed, 0);
    eraN = eraTotalPassed + eraTotalFailed;
    if (eraN > 0 && eraTotalPassed > 0 && eraTotalFailed > 0) {
      for (const e of eraActive) {
        const rowTotal = e.passed + e.failed;
        const expPassed = (rowTotal * eraTotalPassed) / eraN;
        const expFailed = (rowTotal * eraTotalFailed) / eraN;
        if (expPassed > 0) eraChiSq += (e.passed - expPassed) ** 2 / expPassed;
        if (expFailed > 0) eraChiSq += (e.failed - expFailed) ** 2 / expFailed;
      }
      eraDf = eraActive.length - 1;
    }
  }

  const eraPValue = eraDf > 0 ? chiSquarePValue(eraChiSq, eraDf) : 1;
  const eraV = cramersV(eraChiSq, eraN, 2);
  const eraBF =
    eraDf > 0
      ? bayesFactorFromChiSq(eraChiSq, eraDf, eraN)
      : { bf: 1, log10Bf: 0 };
  const eraBfInterp = interpretBF(eraBF.bf);

  // Per-era pass rates with z-score against between-era SD.
  const eraRates = eraActive.map((e) => ({
    label: e.label,
    total: e.passed + e.failed,
    passRate: e.passed / (e.passed + e.failed),
  }));
  const overallPassed = eraActive.reduce((s, e) => s + e.passed, 0);
  const overallN = eraActive.reduce((s, e) => s + e.passed + e.failed, 0);
  const overallMean = overallN > 0 ? overallPassed / overallN : 0;
  let varAcc = 0;
  for (const e of eraRates) varAcc += (e.passRate - overallMean) ** 2;
  const eraSD = eraRates.length > 1 ? Math.sqrt(varAcc / (eraRates.length - 1)) : 0;
  const erasOut = eraRates.map((e) => ({
    label: e.label,
    total: e.total,
    passRate: e.passRate,
    zScore: eraSD > 0 ? (e.passRate - overallMean) / eraSD : 0,
  }));

  // Polarization regression: yes-share vs year, for votes with ≥10 ayes+nays.
  const polarizationRows = await prisma.$queryRaw<PolarizationRow[]>`
    SELECT
      lv."yesCount" AS "yesCount",
      lv."noCount" AS "noCount",
      lv."voteDate" AS "voteDate"
    FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s."ingestedBy" = 'voteview_v1'
      AND lv."yesCount" IS NOT NULL
      AND lv."noCount" IS NOT NULL
      AND lv."voteDate" IS NOT NULL
      AND lv.result IN ('passed', 'failed')
    ORDER BY lv."voteDate" ASC
    LIMIT 50000
  `;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of polarizationRows) {
    const yes = row.yesCount;
    const no = row.noCount;
    const total = yes + no;
    if (total < 10) continue;
    const date = row.voteDate;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) continue;
    const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
    xs.push(year);
    ys.push(yes / total);
  }
  const reg = linearRegression(xs, ys);
  const slopePerDecade = reg.slope * 10;

  let polInterpretation: string;
  if (xs.length < 3) {
    polInterpretation = "Insufficient data for regression.";
  } else {
    const direction = slopePerDecade < 0 ? "narrowed" : "widened";
    const ppPerDecade = Math.abs(slopePerDecade * 100).toFixed(2);
    const pStr = reg.pValue < 0.001 ? "p<.001" : `p=${reg.pValue.toFixed(3)}`;
    const trend =
      slopePerDecade < 0 ? "increasing polarization" : "decreasing polarization";
    polInterpretation = `Yes-share margins have ${direction} by ${ppPerDecade}pp/decade (R²=${reg.rSquared.toFixed(3)}, ${pStr}) — consistent with ${trend}.`;
  }

  return {
    chamberTest: {
      housePassRate,
      houseTotal,
      senatePassRate,
      senateTotal,
      chiSq: chamberChiSq,
      df: 1,
      pValue: chamberPValue,
      cohensH,
      cohensHInterpretation: interpretCohensH(cohensH),
      bf10: chamberBF.bf,
      log10Bf10: chamberBF.log10Bf,
      bfInterpretation: chamberBfInterp,
    },
    eraTest: {
      chiSq: eraChiSq,
      df: eraDf,
      pValue: eraPValue,
      cramersV: eraV,
      cramersVInterpretation: interpretCramersV(eraV),
      bf10: eraBF.bf,
      log10Bf10: eraBF.log10Bf,
      bfInterpretation: eraBfInterp,
      eras: erasOut,
    },
    polarizationTrend: {
      slopePerDecade,
      intercept: reg.intercept,
      rSquared: reg.rSquared,
      pValue: reg.pValue,
      sampleSize: xs.length,
      interpretation: polInterpretation,
    },
  };
}
