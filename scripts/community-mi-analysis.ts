import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

// Mutual information between community stances + community ordering analysis
// on the settling-curve trajectory corpus.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/community-mi-analysis.ts
//
// Key computations:
//   1. MI between community pairs — which pairs share epistemic state coherently?
//   2. Community ordering — what's the canonical propagation sequence?
//   3. Cross-community SETTLED→SETTLED signal (re-ratification patterns)
//   4. Time-lag between communities (how many years does Expert→Institution take?)

type Hist = {
  claimId: string
  fromAxis: string | null
  toAxis: string
  community: string
  occurredAt: Date
}

function log2(x: number) { return Math.log(x) / Math.log(2) }

// Mutual information: I(X;Y) = sum_xy P(x,y) * log2( P(x,y) / (P(x)*P(y)) )
function mutualInformation(
  joint: Map<string, Map<string, number>>,
  total: number
): { mi: number; normalized: number; joint: Record<string, Record<string, number>> } {
  const px = new Map<string, number>()
  const py = new Map<string, number>()

  for (const [x, ys] of joint) {
    for (const [y, n] of ys) {
      px.set(x, (px.get(x) || 0) + n)
      py.set(y, (py.get(y) || 0) + n)
    }
  }

  let mi = 0
  for (const [x, ys] of joint) {
    for (const [y, n] of ys) {
      const pxy = n / total
      const pxMarg = (px.get(x) || 0) / total
      const pyMarg = (py.get(y) || 0) / total
      if (pxy > 0 && pxMarg > 0 && pyMarg > 0) {
        mi += pxy * log2(pxy / (pxMarg * pyMarg))
      }
    }
  }

  // Normalize: MI / min(H(X), H(Y)) — gives 0..1 range
  const hx = [...px.values()].reduce((h, n) => {
    const p = n / total; return p > 0 ? h - p * log2(p) : h
  }, 0)
  const hy = [...py.values()].reduce((h, n) => {
    const p = n / total; return p > 0 ? h - p * log2(p) : h
  }, 0)
  const normalized = Math.min(hx, hy) > 0 ? mi / Math.min(hx, hy) : 0

  const jointObj: Record<string, Record<string, number>> = {}
  for (const [x, ys] of joint) {
    jointObj[x] = {}
    for (const [y, n] of ys) jointObj[x][y] = n
  }

  return { mi: +mi.toFixed(4), normalized: +normalized.toFixed(4), joint: jointObj }
}

const COMMUNITIES = ['EXPERT_LITERATURE', 'INSTITUTIONAL', 'PUBLIC', 'JUDICIAL', 'MARKET']

async function main() {
  const p = new PrismaClient()

  // Pull trajectory claims
  const claims = await p.claim.findMany({
    where: { deleted: false, externalId: { startsWith: 'trajectory:' } },
    select: { id: true, externalId: true, epistemicAxis: true, claimEmergedAt: true },
  })
  const claimIds = claims.map((c) => c.id)
  const total = claims.length
  console.log(`Loaded ${total} trajectory claims`)

  // Pull status history (chunked)
  const history: Hist[] = []
  const CHUNK = 1000
  for (let i = 0; i < claimIds.length; i += CHUNK) {
    const batch = claimIds.slice(i, i + CHUNK)
    const rows = await p.claimStatusHistory.findMany({
      where: { claimId: { in: batch } },
      select: { claimId: true, fromAxis: true, toAxis: true, community: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    })
    history.push(...(rows as Hist[]))
  }
  console.log(`Loaded ${history.length} history rows`)

  // Group by claim, ordered by occurredAt
  const byClaim = new Map<string, Hist[]>()
  for (const h of history) {
    if (!byClaim.has(h.claimId)) byClaim.set(h.claimId, [])
    byClaim.get(h.claimId)!.push(h)
  }

  // ─── 1. Per-claim, per-community: what axis did each community ultimately ratify? ───
  // For each trajectory, record each community's final toAxis (last event for that community)
  // This gives us a per-trajectory community→stance matrix

  type TrajectoryStances = Record<string, string> // community → final axis
  const trajectoryStances: TrajectoryStances[] = []

  for (const [, events] of byClaim) {
    const byComm: Record<string, Hist[]> = {}
    for (const e of events) {
      byComm[e.community] = byComm[e.community] || []
      byComm[e.community].push(e)
    }
    const stances: TrajectoryStances = {}
    for (const comm of Object.keys(byComm)) {
      // Final event's toAxis = community's current position
      const sorted = byComm[comm].sort((a, b) => +a.occurredAt - +b.occurredAt)
      stances[comm] = sorted[sorted.length - 1].toAxis
    }
    trajectoryStances.push(stances)
  }

  // ─── 2. MI between every pair of communities ───
  const miResults: Record<string, {
    mi: number
    normalized_mi: number
    n_trajectories: number // trajectories where BOTH communities appear
    joint_distribution: Record<string, Record<string, number>>
  }> = {}

  for (let i = 0; i < COMMUNITIES.length; i++) {
    for (let j = i + 1; j < COMMUNITIES.length; j++) {
      const c1 = COMMUNITIES[i]
      const c2 = COMMUNITIES[j]
      const joint = new Map<string, Map<string, number>>()
      let n = 0

      for (const stances of trajectoryStances) {
        if (stances[c1] && stances[c2]) {
          const x = stances[c1], y = stances[c2]
          if (!joint.has(x)) joint.set(x, new Map())
          joint.get(x)!.set(y, (joint.get(x)!.get(y) || 0) + 1)
          n++
        }
      }

      if (n < 5) continue // too sparse for MI to be meaningful

      const { mi, normalized, joint: jointObj } = mutualInformation(joint, n)
      const key = `${c1}__${c2}`
      miResults[key] = {
        mi,
        normalized_mi: normalized,
        n_trajectories: n,
        joint_distribution: jointObj,
      }
    }
  }

  // Sort by normalized MI descending
  const miRanked = Object.entries(miResults)
    .sort((a, b) => b[1].normalized_mi - a[1].normalized_mi)
    .map(([pair, data]) => ({ pair, ...data }))

  // ─── 3. Community ordering analysis ───
  // For each trajectory that has multiple communities, what order did they fire?
  // Canonical hypothesis: EXPERT_LITERATURE → INSTITUTIONAL → JUDICIAL/PUBLIC → MARKET

  type OrderPattern = string // e.g. "EXPERT_LITERATURE→INSTITUTIONAL→PUBLIC"
  const orderPatterns: Record<OrderPattern, number> = {}

  // Per trajectory: communities ordered by their FIRST event's occurredAt
  for (const [, events] of byClaim) {
    const firstByComm: Record<string, Date> = {}
    for (const e of events) {
      if (!firstByComm[e.community] || e.occurredAt < firstByComm[e.community]) {
        firstByComm[e.community] = e.occurredAt
      }
    }
    const comms = Object.keys(firstByComm)
    if (comms.length < 2) continue
    const ordered = comms.sort((a, b) => +firstByComm[a] - +firstByComm[b])
    const pattern = ordered.join('→')
    orderPatterns[pattern] = (orderPatterns[pattern] || 0) + 1
  }

  // Top ordering patterns
  const topOrderings = Object.entries(orderPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([pattern, count]) => ({ pattern, count }))

  // ─── 4. Pairwise community lead/lag (which community typically fires first?) ───
  type LeadLag = { [pair: string]: { c1_first: number; c2_first: number; same: number; n: number; c1_lead_pct: number } }
  const leadLag: LeadLag = {}

  for (let i = 0; i < COMMUNITIES.length; i++) {
    for (let j = i + 1; j < COMMUNITIES.length; j++) {
      const c1 = COMMUNITIES[i], c2 = COMMUNITIES[j]
      let c1First = 0, c2First = 0, same = 0

      for (const [, events] of byClaim) {
        const firstByComm: Record<string, Date> = {}
        for (const e of events) {
          if (!firstByComm[e.community] || e.occurredAt < firstByComm[e.community]) {
            firstByComm[e.community] = e.occurredAt
          }
        }
        if (!firstByComm[c1] || !firstByComm[c2]) continue
        const diff = +firstByComm[c1] - +firstByComm[c2]
        if (diff < 0) c1First++
        else if (diff > 0) c2First++
        else same++
      }

      const n = c1First + c2First + same
      if (n < 3) continue

      leadLag[`${c1}__${c2}`] = {
        c1_first: c1First,
        c2_first: c2First,
        same,
        n,
        c1_lead_pct: +(c1First / n * 100).toFixed(1),
      }
    }
  }

  // ─── 5. Time-lag between communities (median years) ───
  // For each pair, how many years does C1→C2 typically take?
  const timeLag: Record<string, {
    median_years: number | null
    mean_years: number | null
    n: number
    direction: string
  }> = {}

  for (let i = 0; i < COMMUNITIES.length; i++) {
    for (let j = i + 1; j < COMMUNITIES.length; j++) {
      const c1 = COMMUNITIES[i], c2 = COMMUNITIES[j]
      const lags: number[] = []

      for (const [, events] of byClaim) {
        const firstByComm: Record<string, Date> = {}
        for (const e of events) {
          if (!firstByComm[e.community] || e.occurredAt < firstByComm[e.community]) {
            firstByComm[e.community] = e.occurredAt
          }
        }
        if (!firstByComm[c1] || !firstByComm[c2]) continue
        const lagMs = Math.abs(+firstByComm[c1] - +firstByComm[c2])
        lags.push(lagMs / (365.25 * 24 * 3600 * 1000))
      }

      if (lags.length === 0) continue

      const sorted = [...lags].sort((a, b) => a - b)
      const med = sorted.length % 2
        ? sorted[Math.floor(sorted.length / 2)]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
      const ll = leadLag[`${c1}__${c2}`]
      const direction = ll ? (ll.c1_lead_pct > 50 ? `${c1} leads` : `${c2} leads`) : 'unclear'

      timeLag[`${c1}__${c2}`] = {
        median_years: +med.toFixed(2),
        mean_years: +mean.toFixed(2),
        n: sorted.length,
        direction,
      }
    }
  }

  // ─── 6. Cross-community SETTLED→SETTLED signal ───
  // Identify trajectories where SETTLED appears multiple times (re-ratification)
  const multiSettled: { claimId: string; settle_events: { community: string; date: string }[] }[] = []
  for (const [claimId, events] of byClaim) {
    const settles = events
      .filter((e) => e.toAxis === 'SETTLED')
      .sort((a, b) => +a.occurredAt - +b.occurredAt)
    if (settles.length >= 2) {
      multiSettled.push({
        claimId,
        settle_events: settles.map((e) => ({
          community: e.community,
          date: e.occurredAt.toISOString().slice(0, 10),
        })),
      })
    }
  }

  // Community pairs that re-ratify together
  const reratifyPairs: Record<string, number> = {}
  for (const ms of multiSettled) {
    const comms = ms.settle_events.map((e) => e.community)
    for (let i = 0; i < comms.length - 1; i++) {
      for (let j = i + 1; j < comms.length; j++) {
        const key = [comms[i], comms[j]].sort().join('→')
        reratifyPairs[key] = (reratifyPairs[key] || 0) + 1
      }
    }
  }

  // ─── Summary: top MI finding → thesis parallel ───
  const topMiPair = miRanked[0]
  const topFindings: string[] = []

  if (topMiPair) {
    topFindings.push(
      `Highest MI pair: ${topMiPair.pair.replace('__', ' ↔ ')} — NMI=${topMiPair.normalized_mi} (n=${topMiPair.n_trajectories}). These communities share epistemic state coherently.`
    )
  }

  const expertInstitPair = miRanked.find((r) => r.pair === 'EXPERT_LITERATURE__INSTITUTIONAL' || r.pair === 'INSTITUTIONAL__EXPERT_LITERATURE')
  if (expertInstitPair) {
    topFindings.push(
      `Expert↔Institutional NMI=${expertInstitPair.normalized_mi} — this is the science-to-policy channel. Low NMI = systematic lag. High NMI = rapid institutional uptake.`
    )
  }

  const topOrder = topOrderings[0]
  if (topOrder) {
    topFindings.push(
      `Most common community ordering: "${topOrder.pattern}" (${topOrder.count} trajectories). This is the empirical propagation canon.`
    )
  }

  topFindings.push(
    `${multiSettled.length} trajectories show multi-community SETTLED (re-ratification). ${Object.keys(reratifyPairs).length} distinct community pairs appear in these chains.`
  )

  topFindings.push(
    `Thesis parallel: MI between features and categories ≡ MI between community stances. Low MI pairs = knowledge domains where communities don't track each other. High MI = epistemic coupling.`
  )

  const report = {
    generated: '2026-06-18',
    total_trajectories: total,
    mi_between_communities: miRanked,
    community_ordering: {
      top_patterns: topOrderings,
      total_multi_community_trajectories: [...byClaim.values()].filter((evs) => {
        const comms = new Set(evs.map((e) => e.community))
        return comms.size >= 2
      }).length,
    },
    lead_lag: leadLag,
    time_lag_between_communities: timeLag,
    multi_settled_trajectories: {
      count: multiSettled.length,
      reratify_pairs: Object.entries(reratifyPairs)
        .sort((a, b) => b[1] - a[1])
        .map(([pair, count]) => ({ pair, count })),
      sample: multiSettled.slice(0, 10),
    },
    top_findings: topFindings,
  }

  writeFileSync('logs/community-mi-report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log('\n--- written to logs/community-mi-report.json ---')

  await p.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
