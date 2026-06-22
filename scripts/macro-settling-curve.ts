import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'fs'

/**
 * Macro settling-curve analysis for the trajectory corpus.
 *
 * Restricted to claims with externalId prefix "trajectory:" and their
 * ClaimStatusHistory rows. Produces three aggregate views:
 *
 *   A. Survival curve      — Kaplan-Meier-style S(t): % of claims still
 *                            unsettled t years after emergence.
 *   B. Decade settling rate — by decade of claimEmergedAt: % eventually
 *                            settled, median years-to-settle, reversal rate.
 *   C. Cumulative frontier  — claims settled by each calendar year, showing
 *                            when knowledge settled fastest.
 *
 * Output: logs/macro-settling-curve-data.json
 *
 * Run:
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/macro-settling-curve.ts
 */

const YEAR_MS = 365.25 * 24 * 3600 * 1000

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
function mean(xs: number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

type Hist = { claimId: string; fromAxis: string | null; toAxis: string; occurredAt: Date }

async function main() {
  const prisma = new PrismaClient()

  // ── 1. trajectory claims ──
  const claims = await prisma.claim.findMany({
    where: { deleted: false, externalId: { startsWith: 'trajectory:' } },
    select: { id: true, epistemicAxis: true, claimEmergedAt: true },
  })
  const claimById = new Map(claims.map((c) => [c.id, c]))
  const claimIds = claims.map((c) => c.id)
  const total = claims.length

  // ── 2. their status history (chunked IN) ──
  const history: Hist[] = []
  const CHUNK = 1000
  for (let i = 0; i < claimIds.length; i += CHUNK) {
    const rows = await prisma.claimStatusHistory.findMany({
      where: { claimId: { in: claimIds.slice(i, i + CHUNK) } },
      select: { claimId: true, fromAxis: true, toAxis: true, occurredAt: true },
    })
    history.push(...(rows as Hist[]))
  }
  const byClaim: Record<string, Hist[]> = {}
  for (const h of history) (byClaim[h.claimId] = byClaim[h.claimId] || []).push(h)
  for (const id of Object.keys(byClaim))
    byClaim[id].sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt))

  // ── per-claim derived metrics ──
  // firstSettledAt: occurredAt of the first SETTLED transition (null if never settled)
  // yearsToSettle:  (firstSettledAt - claimEmergedAt) in years (null if never / negative)
  // reversed:       any transition with toAxis REVERSED or ABANDONED
  type Derived = {
    id: string
    emergedYear: number
    yearsToSettle: number | null
    firstSettledYear: number | null
    reversed: boolean
    settled: boolean
  }
  // Two velocity conventions:
  //   yearsToSettle    — first SETTLED transition minus emergence (inclusive; drives survival curve A)
  //   recordedToSettle — first RECORDED→SETTLED edge (canonical "settlement velocity", matches the
  //                      paper's 5.95-yr median across measurable trajectories)
  const derived: (Derived & { recordedToSettle: number | null })[] = []
  for (const c of claims) {
    if (!c.claimEmergedAt) continue
    const hs = byClaim[c.id] || []
    const settledRow = hs.find((h) => h.toAxis === 'SETTLED')
    const rtsRow = hs.find((h) => h.fromAxis === 'RECORDED' && h.toAxis === 'SETTLED')
    const reversed = hs.some((h) => h.toAxis === 'REVERSED' || h.toAxis === 'ABANDONED')
    const emergedMs = +new Date(c.claimEmergedAt)
    let yearsToSettle: number | null = null
    let firstSettledYear: number | null = null
    if (settledRow) {
      const d = new Date(settledRow.occurredAt)
      firstSettledYear = d.getUTCFullYear()
      const yrs = (+d - emergedMs) / YEAR_MS
      yearsToSettle = yrs >= 0 ? yrs : 0 // clamp tiny negatives (precision noise) to 0
    }
    let recordedToSettle: number | null = null
    if (rtsRow) {
      const yrs = (+new Date(rtsRow.occurredAt) - emergedMs) / YEAR_MS
      if (yrs >= 0) recordedToSettle = yrs
    }
    derived.push({
      id: c.id,
      emergedYear: new Date(c.claimEmergedAt).getUTCFullYear(),
      yearsToSettle,
      firstSettledYear,
      recordedToSettle,
      reversed,
      settled: !!settledRow,
    })
  }

  // ══════════════════ A. SURVIVAL CURVE ══════════════════
  // Empirical S(t) over claims that emerged. A claim that never settles stays
  // "unsettled" forever, so the curve asymptotes at (1 - eventualSettleFraction).
  const emerged = derived // all have claimEmergedAt by construction
  const nEmerged = emerged.length
  const settledYears = emerged
    .filter((d) => d.yearsToSettle !== null)
    .map((d) => d.yearsToSettle as number)
  const eventualSettleFraction = settledYears.length / nEmerged
  const medianYearsToSettleFirst = median(settledYears) // inclusive first-SETTLED median

  // canonical settlement velocity (RECORDED→SETTLED) — matches paper headline (5.95 yr)
  const rtsYears = emerged
    .filter((d) => d.recordedToSettle !== null)
    .map((d) => d.recordedToSettle as number)
  const medianVelocity = median(rtsYears)
  const meanVelocity = mean(rtsYears)

  // grid of year offsets — dense early, sparse late
  const grid: number[] = []
  for (let t = 0; t <= 5; t += 0.25) grid.push(t)
  for (let t = 6; t <= 30; t += 1) grid.push(t)
  for (let t = 35; t <= 100; t += 5) grid.push(t)
  for (let t = 120; t <= 500; t += 20) grid.push(t)
  const survivalCurve = grid.map((t) => {
    // unsettled at offset t = never-settled  +  settled-after-t
    const stillUnsettled = emerged.filter(
      (d) => d.yearsToSettle === null || (d.yearsToSettle as number) > t
    ).length
    return {
      yearsAfterEmergence: +t.toFixed(2),
      pctUnsettled: +((stillUnsettled / nEmerged) * 100).toFixed(2),
    }
  })
  // KM-style median: smallest t where the survival curve drops to/below 50% unsettled
  const kmCross = survivalCurve.find((p) => p.pctUnsettled <= 50)
  const kmMedianYears = kmCross ? kmCross.yearsAfterEmergence : null

  // ══════════════════ B. DECADE SETTLING RATE ══════════════════
  type DecadeAgg = { settledYrs: number[]; nSettled: number; nReversed: number; n: number }
  const decades: Record<number, DecadeAgg> = {}
  for (const d of emerged) {
    const dec = Math.floor(d.emergedYear / 10) * 10
    const agg = (decades[dec] = decades[dec] || { settledYrs: [], nSettled: 0, nReversed: 0, n: 0 })
    agg.n++
    if (d.settled) {
      agg.nSettled++
      if (d.yearsToSettle !== null) agg.settledYrs.push(d.yearsToSettle)
    }
    if (d.reversed) agg.nReversed++
  }
  const decadeLabel = (dec: number) => (dec < 0 ? `${Math.abs(dec)}s BCE` : `${dec}s`)
  const decadeStats = Object.keys(decades)
    .map(Number)
    .sort((a, b) => a - b)
    .map((dec) => {
      const a = decades[dec]
      return {
        decade: decadeLabel(dec),
        decadeStart: dec,
        n: a.n,
        pctSettled: +((a.nSettled / a.n) * 100).toFixed(1),
        medianYears: a.settledYrs.length ? +(median(a.settledYrs) as number).toFixed(2) : null,
        reversalRate: +((a.nReversed / a.n) * 100).toFixed(1),
      }
    })

  // ══════════════════ C. CUMULATIVE FRONTIER ══════════════════
  // For each calendar year, how many claims had their first SETTLED on/before it.
  const settledYearsList = emerged
    .filter((d) => d.firstSettledYear !== null)
    .map((d) => d.firstSettledYear as number)
    .sort((a, b) => a - b)
  const cumulativeFrontier: { year: number; cumulativeSettled: number }[] = []
  let ptr = 0
  let cum = 0
  for (let year = -500; year <= 2025; year++) {
    while (ptr < settledYearsList.length && settledYearsList[ptr] <= year) {
      cum++
      ptr++
    }
    // record every year, but to keep the JSON compact only emit when it changes
    // pre-0 (sparse) plus a yearly series from 1500 onward
    if (
      cumulativeFrontier.length === 0 ||
      cum !== cumulativeFrontier[cumulativeFrontier.length - 1].cumulativeSettled ||
      year >= 1500
    ) {
      cumulativeFrontier.push({ year, cumulativeSettled: cum })
    }
  }

  // overall reversal rate
  const reversalRate = +((emerged.filter((d) => d.reversed).length / nEmerged) * 100).toFixed(2)

  // ── endpoint distribution (context) ──
  const endpoint: Record<string, number> = {}
  for (const c of claims) {
    const k = c.epistemicAxis ?? 'NULL'
    endpoint[k] = (endpoint[k] || 0) + 1
  }

  const out = {
    generatedAt: new Date().toISOString(),
    totalTrajectories: total,
    nWithEmergence: nEmerged,
    eventualSettleFraction: +(eventualSettleFraction * 100).toFixed(2),
    // headline velocity = canonical RECORDED→SETTLED (matches paper, ~5.95 yr)
    medianVelocityYears: medianVelocity !== null ? +medianVelocity.toFixed(2) : null,
    meanVelocityYears: meanVelocity !== null ? +meanVelocity.toFixed(2) : null,
    velocityN: rtsYears.length,
    // inclusive first-SETTLED stats (basis of the survival curve)
    medianYearsToSettleFirst:
      medianYearsToSettleFirst !== null ? +medianYearsToSettleFirst.toFixed(2) : null,
    kmMedianYears, // years until 50% of emerged claims have settled (survival curve crossing)
    reversalRate,
    endpointDistribution: endpoint,
    survivalCurve,
    decadeStats,
    cumulativeFrontier,
  }

  mkdirSync('logs', { recursive: true })
  writeFileSync('logs/macro-settling-curve-data.json', JSON.stringify(out, null, 2))

  // ── console summary ──
  console.log('═══ MACRO SETTLING CURVE ═══')
  console.log(`trajectories: ${total} (all with claimEmergedAt: ${nEmerged})`)
  console.log(`eventually settled: ${out.eventualSettleFraction}%`)
  console.log(
    `median velocity (RECORDED→SETTLED): ${out.medianVelocityYears}yr  mean: ${out.meanVelocityYears}yr  (n=${out.velocityN})`
  )
  console.log(
    `median first-SETTLED: ${out.medianYearsToSettleFirst}yr  KM-median (S=50%): ${out.kmMedianYears}yr`
  )
  console.log(`overall reversal rate: ${reversalRate}%`)
  console.log('\nsurvival curve (sample):')
  for (const t of [0, 1, 2, 5, 10, 25, 50, 100]) {
    const pt = survivalCurve.reduce((best, p) =>
      Math.abs(p.yearsAfterEmergence - t) < Math.abs(best.yearsAfterEmergence - t) ? p : best
    )
    console.log(`  t=${t}yr: ${pt.pctUnsettled}% unsettled`)
  }
  console.log('\ndecade settling rate (1600s+):')
  for (const d of decadeStats.filter((d) => d.decadeStart >= 1600))
    console.log(
      `  ${d.decade.padStart(7)}: n=${String(d.n).padStart(4)}  settled=${d.pctSettled}%  median=${d.medianYears}yr  reversal=${d.reversalRate}%`
    )
  console.log('\ncumulative frontier milestones:')
  for (const yr of [1, 1000, 1500, 1700, 1800, 1900, 1950, 2000, 2025]) {
    const pt = cumulativeFrontier.filter((p) => p.year <= yr).pop()
    if (pt) console.log(`  by ${yr}: ${pt.cumulativeSettled} claims settled`)
  }
  console.log('\nwrote logs/macro-settling-curve-data.json')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
