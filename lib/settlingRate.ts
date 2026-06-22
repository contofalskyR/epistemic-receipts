import "server-only";
import { prisma } from "@/lib/prisma";

// Macro settling-curve analysis over the trajectory corpus
// (claims with externalId prefix "trajectory:"). Mirrors
// scripts/macro-settling-curve.ts so the live page and the paper figure
// report the same numbers.

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export interface SurvivalPoint {
  yearsAfterEmergence: number;
  pctUnsettled: number;
}
export interface DecadeStat {
  decade: string;
  decadeStart: number;
  n: number;
  pctSettled: number;
  medianYears: number | null;
  reversalRate: number;
}
export interface FrontierPoint {
  year: number;
  cumulativeSettled: number;
}
export interface SettlingRateData {
  totalTrajectories: number;
  medianVelocityYears: number | null;
  meanVelocityYears: number | null;
  kmMedianYears: number | null;
  eventualSettleFraction: number;
  reversalRate: number;
  survivalCurve: SurvivalPoint[];
  decadeStats: DecadeStat[];
  cumulativeFrontier: FrontierPoint[];
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export async function buildSettlingRateAnalysis(): Promise<SettlingRateData> {
  const claims = await prisma.claim.findMany({
    where: { deleted: false, externalId: { startsWith: "trajectory:" } },
    select: { id: true, claimEmergedAt: true },
  });
  const claimIds = claims.map((c) => c.id);
  const total = claims.length;

  type Hist = {
    claimId: string;
    fromAxis: string | null;
    toAxis: string;
    occurredAt: Date;
  };
  const history: Hist[] = [];
  const CHUNK = 1000;
  for (let i = 0; i < claimIds.length; i += CHUNK) {
    const rows = await prisma.claimStatusHistory.findMany({
      where: { claimId: { in: claimIds.slice(i, i + CHUNK) } },
      select: { claimId: true, fromAxis: true, toAxis: true, occurredAt: true },
    });
    history.push(...(rows as Hist[]));
  }
  const byClaim: Record<string, Hist[]> = {};
  for (const h of history) (byClaim[h.claimId] = byClaim[h.claimId] || []).push(h);
  for (const id of Object.keys(byClaim))
    byClaim[id].sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));

  type Derived = {
    emergedYear: number;
    yearsToSettle: number | null; // first SETTLED − emergence (survival curve)
    recordedToSettle: number | null; // RECORDED→SETTLED (canonical velocity)
    firstSettledYear: number | null;
    reversed: boolean;
    settled: boolean;
  };
  const derived: Derived[] = [];
  for (const c of claims) {
    if (!c.claimEmergedAt) continue;
    const hs = byClaim[c.id] || [];
    const settledRow = hs.find((h) => h.toAxis === "SETTLED");
    const rtsRow = hs.find((h) => h.fromAxis === "RECORDED" && h.toAxis === "SETTLED");
    const reversed = hs.some((h) => h.toAxis === "REVERSED" || h.toAxis === "ABANDONED");
    const emergedMs = +new Date(c.claimEmergedAt);
    let yearsToSettle: number | null = null;
    let firstSettledYear: number | null = null;
    if (settledRow) {
      const d = new Date(settledRow.occurredAt);
      firstSettledYear = d.getUTCFullYear();
      const yrs = (+d - emergedMs) / YEAR_MS;
      yearsToSettle = yrs >= 0 ? yrs : 0;
    }
    let recordedToSettle: number | null = null;
    if (rtsRow) {
      const yrs = (+new Date(rtsRow.occurredAt) - emergedMs) / YEAR_MS;
      if (yrs >= 0) recordedToSettle = yrs;
    }
    derived.push({
      emergedYear: new Date(c.claimEmergedAt).getUTCFullYear(),
      yearsToSettle,
      recordedToSettle,
      firstSettledYear,
      reversed,
      settled: !!settledRow,
    });
  }
  const nEmerged = derived.length;

  // velocity (canonical RECORDED→SETTLED) + survival basis (first SETTLED)
  const rtsYears = derived
    .filter((d) => d.recordedToSettle !== null)
    .map((d) => d.recordedToSettle as number);
  const settledYears = derived
    .filter((d) => d.yearsToSettle !== null)
    .map((d) => d.yearsToSettle as number);
  const medianVelocity = median(rtsYears);
  const meanVelocity = mean(rtsYears);
  const eventualSettleFraction = nEmerged ? (settledYears.length / nEmerged) * 100 : 0;
  const reversalRate = nEmerged
    ? (derived.filter((d) => d.reversed).length / nEmerged) * 100
    : 0;

  // ── A. survival curve ──
  const grid: number[] = [];
  for (let t = 0; t <= 5; t += 0.25) grid.push(t);
  for (let t = 6; t <= 30; t += 1) grid.push(t);
  for (let t = 35; t <= 100; t += 5) grid.push(t);
  for (let t = 120; t <= 500; t += 20) grid.push(t);
  const survivalCurve: SurvivalPoint[] = grid.map((t) => {
    const stillUnsettled = derived.filter(
      (d) => d.yearsToSettle === null || (d.yearsToSettle as number) > t
    ).length;
    return {
      yearsAfterEmergence: +t.toFixed(2),
      pctUnsettled: nEmerged ? +((stillUnsettled / nEmerged) * 100).toFixed(2) : 0,
    };
  });
  const kmCross = survivalCurve.find((p) => p.pctUnsettled <= 50);
  const kmMedianYears = kmCross ? kmCross.yearsAfterEmergence : null;

  // ── B. decade settling rate ──
  type DecadeAgg = { settledYrs: number[]; nSettled: number; nReversed: number; n: number };
  const decades: Record<number, DecadeAgg> = {};
  for (const d of derived) {
    const dec = Math.floor(d.emergedYear / 10) * 10;
    const agg = (decades[dec] = decades[dec] || {
      settledYrs: [],
      nSettled: 0,
      nReversed: 0,
      n: 0,
    });
    agg.n++;
    if (d.settled) {
      agg.nSettled++;
      if (d.yearsToSettle !== null) agg.settledYrs.push(d.yearsToSettle);
    }
    if (d.reversed) agg.nReversed++;
  }
  const decadeLabel = (dec: number) => (dec < 0 ? `${Math.abs(dec)}s BCE` : `${dec}s`);
  const decadeStats: DecadeStat[] = Object.keys(decades)
    .map(Number)
    .sort((a, b) => a - b)
    .map((dec) => {
      const a = decades[dec];
      const m = median(a.settledYrs);
      return {
        decade: decadeLabel(dec),
        decadeStart: dec,
        n: a.n,
        pctSettled: +((a.nSettled / a.n) * 100).toFixed(1),
        medianYears: m !== null ? +m.toFixed(2) : null,
        reversalRate: +((a.nReversed / a.n) * 100).toFixed(1),
      };
    });

  // ── C. cumulative frontier ──
  const settledYearsList = derived
    .filter((d) => d.firstSettledYear !== null)
    .map((d) => d.firstSettledYear as number)
    .sort((a, b) => a - b);
  const cumulativeFrontier: FrontierPoint[] = [];
  let ptr = 0;
  let cum = 0;
  for (let year = -500; year <= 2025; year++) {
    while (ptr < settledYearsList.length && settledYearsList[ptr] <= year) {
      cum++;
      ptr++;
    }
    if (
      cumulativeFrontier.length === 0 ||
      cum !== cumulativeFrontier[cumulativeFrontier.length - 1].cumulativeSettled ||
      year >= 1500
    ) {
      cumulativeFrontier.push({ year, cumulativeSettled: cum });
    }
  }

  return {
    totalTrajectories: total,
    medianVelocityYears: medianVelocity !== null ? +medianVelocity.toFixed(2) : null,
    meanVelocityYears: meanVelocity !== null ? +meanVelocity.toFixed(2) : null,
    kmMedianYears,
    eventualSettleFraction: +eventualSettleFraction.toFixed(2),
    reversalRate: +reversalRate.toFixed(2),
    survivalCurve,
    decadeStats,
    cumulativeFrontier,
  };
}
