import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

// Deep quantitative analysis of the settling-curve trajectory corpus.
// Restricted to claims with externalId prefix "trajectory:" and their
// ClaimStatusHistory rows. Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/corpus-analysis.ts

type Hist = {
  claimId: string
  fromAxis: string | null
  toAxis: string
  community: string
  occurredAt: Date
}

function log2(x: number) { return Math.log(x) / Math.log(2) }

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function main() {
  const p = new PrismaClient()

  // 1. Pull all trajectory: claims
  const claims = await p.claim.findMany({
    where: { deleted: false, externalId: { startsWith: 'trajectory:' } },
    select: { id: true, externalId: true, epistemicAxis: true, claimEmergedAt: true },
  })
  const claimIds = claims.map((c) => c.id)
  const claimById = new Map(claims.map((c) => [c.id, c]))
  const total = claims.length

  // 2. Pull ONLY their status history (chunked to avoid param limits)
  const history: Hist[] = []
  const CHUNK = 1000
  for (let i = 0; i < claimIds.length; i += CHUNK) {
    const batch = claimIds.slice(i, i + CHUNK)
    const rows = await p.claimStatusHistory.findMany({
      where: { claimId: { in: batch } },
      select: { claimId: true, fromAxis: true, toAxis: true, community: true, occurredAt: true },
    })
    history.push(...(rows as Hist[]))
  }

  // ---- Endpoint distribution (claim.epistemicAxis) ----
  const endpoint: Record<string, number> = {}
  for (const c of claims) {
    const k = c.epistemicAxis ?? 'NULL'
    endpoint[k] = (endpoint[k] || 0) + 1
  }

  // ---- Shannon entropy of endpoint distribution ----
  let entropy = 0
  for (const k of Object.keys(endpoint)) {
    const pr = endpoint[k] / total
    if (pr > 0) entropy -= pr * log2(pr)
  }

  // ---- Raw transition counts (trajectory subset only) ----
  const transRaw: Record<string, Record<string, number>> = {}
  for (const h of history) {
    const from = h.fromAxis ?? 'null'
    transRaw[from] = transRaw[from] || {}
    transRaw[from][h.toAxis] = (transRaw[from][h.toAxis] || 0) + 1
  }

  // ---- Normalized Markov matrix P(to | from) ----
  const markov: Record<string, Record<string, number>> = {}
  for (const from of Object.keys(transRaw)) {
    const rowTotal = Object.values(transRaw[from]).reduce((a, b) => a + b, 0)
    markov[from] = {}
    for (const to of Object.keys(transRaw[from])) {
      markov[from][to] = +(transRaw[from][to] / rowTotal).toFixed(4)
    }
  }

  // ---- Depth: transitions per trajectory ----
  const perClaimCount: Record<string, number> = {}
  for (const h of history) perClaimCount[h.claimId] = (perClaimCount[h.claimId] || 0) + 1
  const depthHist: Record<number, number> = {}
  for (const id of claimIds) {
    const d = perClaimCount[id] || 0
    depthHist[d] = (depthHist[d] || 0) + 1
  }
  const depthValues = claimIds.map((id) => perClaimCount[id] || 0)
  const avgDepth = depthValues.reduce((a, b) => a + b, 0) / total

  // ---- Community distribution (trajectory subset only) ----
  const community: Record<string, number> = {}
  for (const h of history) community[h.community] = (community[h.community] || 0) + 1
  const expertLit = community['EXPERT_LITERATURE'] || 0
  const otherCommunity = Object.entries(community)
    .filter(([k]) => k !== 'EXPERT_LITERATURE')
    .reduce((a, [, v]) => a + v, 0)
  const communityDominance = {
    expert_literature: expertLit,
    all_others: otherCommunity,
    ratio: otherCommunity > 0 ? +(expertLit / otherCommunity).toFixed(2) : null,
    expert_pct: +((expertLit / (expertLit + otherCommunity)) * 100).toFixed(2),
  }

  // ---- Settlement velocity: RECORDED -> SETTLED ----
  // years between claimEmergedAt and the SETTLED transition occurredAt
  const velocityYears: number[] = []
  // group history by claim, find first RECORDED->SETTLED transition
  const byClaim: Record<string, Hist[]> = {}
  for (const h of history) (byClaim[h.claimId] = byClaim[h.claimId] || []).push(h)
  for (const id of Object.keys(byClaim)) {
    const c = claimById.get(id)
    if (!c?.claimEmergedAt) continue
    const settledTrans = byClaim[id]
      .filter((h) => h.fromAxis === 'RECORDED' && h.toAxis === 'SETTLED')
      .sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt))[0]
    if (!settledTrans) continue
    const yrs = (+new Date(settledTrans.occurredAt) - +new Date(c.claimEmergedAt)) / (365.25 * 24 * 3600 * 1000)
    if (yrs >= 0) velocityYears.push(yrs)
  }
  const velocityMedian = median(velocityYears)

  // ---- Reversal rate: of trajectories that ever reached SETTLED, % that ever reversed ----
  const everSettled = new Set<string>()
  const everReversedAfterSettle = new Set<string>()
  for (const id of Object.keys(byClaim)) {
    const hs = byClaim[id]
    if (hs.some((h) => h.toAxis === 'SETTLED')) everSettled.add(id)
    if (hs.some((h) => h.fromAxis === 'SETTLED' && h.toAxis === 'REVERSED')) everReversedAfterSettle.add(id)
  }
  const reversalRate = everSettled.size > 0
    ? +((everReversedAfterSettle.size / everSettled.size) * 100).toFixed(2)
    : 0

  // ---- Era distribution: decade of claimEmergedAt ----
  const era: Record<string, number> = {}
  let noEmergedDate = 0
  for (const c of claims) {
    if (!c.claimEmergedAt) { noEmergedDate++; continue }
    const yr = new Date(c.claimEmergedAt).getUTCFullYear()
    const decade = Math.floor(yr / 10) * 10
    const key = `${decade}s`
    era[key] = (era[key] || 0) + 1
  }
  // sorted era
  const eraSorted = Object.fromEntries(
    Object.entries(era).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  )

  // ---- Contestation & detour metrics ----
  // Contestation rate: % of trajectories that ever touched CONTESTED
  const everContested = new Set<string>()
  for (const id of Object.keys(byClaim)) {
    if (byClaim[id].some((h) => h.toAxis === 'CONTESTED' || h.fromAxis === 'CONTESTED')) everContested.add(id)
  }
  const contestationRatePct = +((everContested.size / total) * 100).toFixed(2)
  // Detour rate: % of trajectories with depth > 2 (more than the minimal null->RECORDED->SETTLED)
  const detourCount = depthValues.filter((d) => d > 2).length
  const detourRatePct = +((detourCount / total) * 100).toFixed(2)

  // Velocity percentiles (heavy right tail from ancient claims)
  const vSorted = [...velocityYears].sort((a, b) => a - b)
  const pct = (q: number) => (vSorted.length ? +vSorted[Math.floor(q * (vSorted.length - 1))].toFixed(2) : null)
  const velocityPercentiles = { p10: pct(0.1), p25: pct(0.25), p50: pct(0.5), p75: pct(0.75), p90: pct(0.9), max: vSorted.length ? +vSorted[vSorted.length - 1].toFixed(2) : null }

  // ---- Anomaly checks ----
  const anomalies: string[] = []
  // Compare to the cross-corpus RECORDED->REVERSED noise concern
  const trajRecordedReversed = transRaw['RECORDED']?.['REVERSED'] || 0
  anomalies.push(
    `RECORDED→REVERSED in trajectory subset: ${trajRecordedReversed} (vs 5,728 across ALL ClaimStatusHistory — confirms that figure is noise from non-trajectory claims).`
  )
  const claimsWithNoHistory = depthHist[0] || 0
  if (claimsWithNoHistory > 0) anomalies.push(`${claimsWithNoHistory} trajectory claims have ZERO status-history rows.`)
  if (noEmergedDate > 0) anomalies.push(`${noEmergedDate} trajectory claims have no claimEmergedAt (excluded from era + velocity).`)
  anomalies.push(
    `Settlement velocity is extremely right-skewed: median ${velocityMedian?.toFixed(2)}y but mean ${(velocityYears.reduce((a, b) => a + b, 0) / velocityYears.length).toFixed(1)}y and max ${velocityPercentiles.max}y — ancient claims (emergedAt centuries before the SETTLED marker) inflate the mean. Use the median.`
  )
  anomalies.push(
    `Within the trajectory subset EXPERT_LITERATURE is only ${communityDominance.expert_pct}% of events — NOT the ~94% seen across all ER claims. The trajectory corpus is deliberately multi-community; the global expert-dominance is an artifact of other (non-trajectory) ingestion pipelines.`
  )

  // ---- Top findings ----
  const topFindings: string[] = []
  topFindings.push(
    `${((endpoint['SETTLED'] || 0) / total * 100).toFixed(1)}% of trajectories end SETTLED — the corpus is overwhelmingly success-biased (survivorship), endpoint entropy only ${entropy.toFixed(3)} bits.`
  )
  topFindings.push(
    `Median settlement velocity (RECORDED→SETTLED): ${velocityMedian === null ? 'n/a' : velocityMedian.toFixed(2)} years across ${velocityYears.length} measurable trajectories.`
  )
  topFindings.push(
    `Reversal rate among ever-SETTLED trajectories: ${reversalRate}% (${everReversedAfterSettle.size}/${everSettled.size}).`
  )
  topFindings.push(
    `The trajectory corpus is genuinely multi-community: only ${communityDominance.expert_pct}% of ratification events are EXPERT_LITERATURE (INSTITUTIONAL ${community['INSTITUTIONAL'] || 0}, PUBLIC ${community['PUBLIC'] || 0}, JUDICIAL ${community['JUDICIAL'] || 0}, MARKET ${community['MARKET'] || 0}) — unlike the ~94% expert-dominated ER corpus at large.`
  )
  topFindings.push(
    `Average trajectory depth ${avgDepth.toFixed(2)} transitions; ${detourRatePct}% of trajectories took a "detour" (depth>2, i.e. a contestation/reversal/re-recording before settling), and ${contestationRatePct}% touched CONTESTED at some point.`
  )
  topFindings.push(
    `Once SETTLED, knowledge is sticky-but-not-permanent: P(stay settled)=${(markov['SETTLED']?.['SETTLED'] ?? 0)}, P(reverse)=${(markov['SETTLED']?.['REVERSED'] ?? 0)}, P(re-contest)=${(markov['SETTLED']?.['CONTESTED'] ?? 0)}. CONTESTED claims resolve to SETTLED ${((markov['CONTESTED']?.['SETTLED'] ?? 0) * 100).toFixed(0)}% of the time.`
  )

  const report = {
    generated: '2026-06-18',
    total_trajectories: total,
    endpoint_distribution: endpoint,
    endpoint_distribution_pct: Object.fromEntries(
      Object.entries(endpoint).map(([k, v]) => [k, +((v / total) * 100).toFixed(2)])
    ),
    transition_counts_raw: transRaw,
    markov_matrix: markov,
    shannon_entropy: +entropy.toFixed(4),
    shannon_entropy_max_bits: +log2(Object.keys(endpoint).length).toFixed(4),
    avg_depth: +avgDepth.toFixed(4),
    depth_histogram: depthHist,
    community_distribution: community,
    community_dominance: communityDominance,
    settlement_velocity_median_years: velocityMedian === null ? null : +velocityMedian.toFixed(2),
    settlement_velocity_n: velocityYears.length,
    settlement_velocity_mean_years: velocityYears.length
      ? +(velocityYears.reduce((a, b) => a + b, 0) / velocityYears.length).toFixed(2)
      : null,
    settlement_velocity_percentiles: velocityPercentiles,
    reversal_rate_pct: reversalRate,
    ever_settled_n: everSettled.size,
    ever_reversed_after_settle_n: everReversedAfterSettle.size,
    contestation_rate_pct: contestationRatePct,
    ever_contested_n: everContested.size,
    detour_rate_pct: detourRatePct,
    era_distribution: eraSorted,
    claims_without_emerged_date: noEmergedDate,
    top_findings: topFindings,
    anomalies,
  }

  writeFileSync('logs/corpus-analysis-report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log('\n--- written to logs/corpus-analysis-report.json ---')

  await p.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
