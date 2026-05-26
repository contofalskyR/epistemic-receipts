import { prisma } from '@/lib/prisma'

export async function getPassRateByLegislature(): Promise<
  { legislature: string; passRate: number; total: number }[]
> {
  const rows = await prisma.legislativeVote.findMany({
    where: { result: { not: null } },
    select: {
      result: true,
      source: { select: { ingestedBy: true } },
    },
    take: 50000,
  })

  const byLeg = new Map<string, { passed: number; total: number }>()
  for (const row of rows) {
    const leg = row.source?.ingestedBy ?? 'unknown'
    const acc = byLeg.get(leg) ?? { passed: 0, total: 0 }
    acc.total++
    if (row.result === 'passed') acc.passed++
    byLeg.set(leg, acc)
  }

  return Array.from(byLeg.entries())
    .map(([legislature, { passed, total }]) => ({
      legislature,
      passRate: total > 0 ? passed / total : 0,
      total,
    }))
    .sort((a, b) => b.total - a.total)
}

export async function getTopTopicsByLegislature(): Promise<
  { legislature: string; topics: { topic: string; count: number }[] }[]
> {
  const rows = await prisma.legislativeVote.findMany({
    where: { topics: { not: null } },
    select: {
      topics: true,
      source: { select: { ingestedBy: true } },
    },
    take: 50000,
  })

  const byLeg = new Map<string, Map<string, number>>()
  for (const row of rows) {
    if (!row.topics) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(row.topics)
    } catch {
      continue
    }
    if (!Array.isArray(parsed)) continue
    const leg = row.source?.ingestedBy ?? 'unknown'
    const topicMap = byLeg.get(leg) ?? new Map<string, number>()
    for (const topic of parsed as string[]) {
      if (typeof topic !== 'string') continue
      topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1)
    }
    byLeg.set(leg, topicMap)
  }

  return Array.from(byLeg.entries()).map(([legislature, topicMap]) => ({
    legislature,
    topics: Array.from(topicMap.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  }))
}

export async function getPassRateByTopic(): Promise<
  { topic: string; passCount: number; failCount: number; total: number; passRate: number }[]
> {
  const rows = await prisma.legislativeVote.findMany({
    where: { topics: { not: null }, result: { in: ['passed', 'failed'] } },
    select: { topics: true, result: true },
    take: 50000,
  })

  const byTopic = new Map<string, { passed: number; failed: number }>()
  for (const row of rows) {
    if (!row.topics || !row.result) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(row.topics)
    } catch {
      continue
    }
    if (!Array.isArray(parsed)) continue
    for (const topic of parsed as string[]) {
      if (typeof topic !== 'string') continue
      const acc = byTopic.get(topic) ?? { passed: 0, failed: 0 }
      if (row.result === 'passed') acc.passed++
      else acc.failed++
      byTopic.set(topic, acc)
    }
  }

  return Array.from(byTopic.entries())
    .map(([topic, { passed, failed }]) => ({
      topic,
      passCount: passed,
      failCount: failed,
      total: passed + failed,
      passRate: passed + failed > 0 ? passed / (passed + failed) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export type CongressVoteRow = {
  id: string
  chamber: string
  yesCount: number
  noCount: number
  result: string
  topics: string[] | null
  margin: number
  sourceName: string | null
  sourceUrl: string | null
}

export async function getCongressStats(): Promise<{
  votes: CongressVoteRow[]
  chamberStats: { chamber: string; total: number; passed: number; avgNayPct: number }[]
  marginBuckets: { label: string; count: number }[]
  topicContest: { topic: string; avgNayPct: number; count: number }[]
}> {
  const raw = await prisma.legislativeVote.findMany({
    where: {
      source: { ingestedBy: 'congress_v1' },
      yesCount: { not: null },
      noCount: { not: null },
    },
    select: {
      id: true,
      chamber: true,
      yesCount: true,
      noCount: true,
      result: true,
      topics: true,
      source: { select: { name: true, url: true } },
    },
    take: 50000,
  })

  const votes: CongressVoteRow[] = []
  for (const v of raw) {
    const yes = v.yesCount ?? 0
    const no = v.noCount ?? 0
    const total = yes + no
    if (total < 10) continue
    let topics: string[] | null = null
    if (v.topics) {
      try { topics = JSON.parse(v.topics) } catch { /* ignore */ }
    }
    votes.push({
      id: v.id,
      chamber: v.chamber,
      yesCount: yes,
      noCount: no,
      result: v.result ?? 'unknown',
      topics,
      margin: Math.abs(yes - no) / total,
      sourceName: v.source?.name ?? null,
      sourceUrl: v.source?.url ?? null,
    })
  }

  // Chamber stats
  const chambers = new Map<string, { total: number; passed: number; naySum: number }>()
  for (const v of votes) {
    const acc = chambers.get(v.chamber) ?? { total: 0, passed: 0, naySum: 0 }
    acc.total++
    if (v.result === 'passed') acc.passed++
    acc.naySum += (v.noCount / (v.yesCount + v.noCount)) * 100
    chambers.set(v.chamber, acc)
  }
  const chamberStats = Array.from(chambers.entries()).map(([chamber, s]) => ({
    chamber,
    total: s.total,
    passed: s.passed,
    avgNayPct: s.naySum / s.total,
  })).sort((a, b) => b.total - a.total)

  // Margin buckets
  const buckets = [
    { label: 'Razor thin (<5%)', min: 0, max: 0.05 },
    { label: 'Contested (5–15%)', min: 0.05, max: 0.15 },
    { label: 'Clear (15–30%)', min: 0.15, max: 0.30 },
    { label: 'Decisive (>30%)', min: 0.30, max: 1 },
  ]
  const marginBuckets = buckets.map(b => ({
    label: b.label,
    count: votes.filter(v => v.margin >= b.min && v.margin < b.max).length,
  }))

  // Topic contest (avg nay % per topic, US only)
  const topicMap = new Map<string, { naySum: number; count: number }>()
  for (const v of votes) {
    if (!v.topics) continue
    const nayPct = (v.noCount / (v.yesCount + v.noCount)) * 100
    for (const t of v.topics) {
      const acc = topicMap.get(t) ?? { naySum: 0, count: 0 }
      acc.naySum += nayPct
      acc.count++
      topicMap.set(t, acc)
    }
  }
  const topicContest = Array.from(topicMap.entries())
    .map(([topic, { naySum, count }]) => ({ topic, avgNayPct: naySum / count, count }))
    .sort((a, b) => b.avgNayPct - a.avgNayPct)

  return { votes, chamberStats, marginBuckets, topicContest }
}

// ── US Congress party-line / bipartisan analysis ──────────────────────────────
// Sources its data from LegislativeVote.byPartyJson populated by
// scripts/backfill-congress-party-votes.ts. Until that backfill runs, every
// row returns 0 — the stats page should hide its party section in that case.

export type PartyVoteSplit = {
  id: string
  chamber: string
  yesCount: number
  noCount: number
  result: string
  sourceName: string | null
  sourceUrl: string | null
  demYesPct: number
  repYesPct: number
  demTotal: number
  repTotal: number
  spread: number // |demYesPct − repYesPct|
}

export type CongressPartyStats = {
  partyLineVotes: PartyVoteSplit[]
  bipartisanVotes: PartyVoteSplit[]
  topDemRepSplits: PartyVoteSplit[]
  partyLineCount: number
  bipartisanCount: number
  totalWithPartyData: number
}

type PartyTally = { yes: number; no: number; abstain: number }

function matchPartyKey(parties: Record<string, PartyTally>, prefixes: string[]): string | null {
  // byPartyJson keys come from Congress.gov labels: 'Democrat', 'Republican',
  // 'Independent'. Match defensively (case + prefix) so 'Democratic' or 'Dem'
  // is also recognized.
  for (const key of Object.keys(parties)) {
    const lower = key.toLowerCase()
    if (prefixes.some((p) => lower.startsWith(p))) return key
  }
  return null
}

function parsePartyJson(raw: string): Record<string, PartyTally> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const out: Record<string, PartyTally> = {}
  for (const [party, counts] of Object.entries(parsed as Record<string, unknown>)) {
    if (!counts || typeof counts !== 'object') continue
    const c = counts as Record<string, unknown>
    const yes = Number(c.yes ?? 0)
    const no = Number(c.no ?? 0)
    const abstain = Number(c.abstain ?? 0)
    if (!Number.isFinite(yes) || !Number.isFinite(no) || !Number.isFinite(abstain)) continue
    if (yes + no + abstain === 0) continue
    out[party] = { yes, no, abstain }
  }
  return Object.keys(out).length > 0 ? out : null
}

export async function getCongressPartyStats(): Promise<CongressPartyStats> {
  const rows = await prisma.legislativeVote.findMany({
    where: {
      source: { ingestedBy: 'congress_v1' },
      byPartyJson: { not: null },
    },
    select: {
      id: true,
      chamber: true,
      yesCount: true,
      noCount: true,
      result: true,
      byPartyJson: true,
      source: { select: { name: true, url: true } },
    },
    take: 50000,
  })

  const splits: PartyVoteSplit[] = []
  for (const r of rows) {
    if (!r.byPartyJson) continue
    const parties = parsePartyJson(r.byPartyJson)
    if (!parties) continue
    const demKey = matchPartyKey(parties, ['democrat', 'dem'])
    const repKey = matchPartyKey(parties, ['republican', 'rep'])
    if (!demKey || !repKey) continue
    const dem = parties[demKey]!
    const rep = parties[repKey]!
    const demTotal = dem.yes + dem.no
    const repTotal = rep.yes + rep.no
    if (demTotal === 0 || repTotal === 0) continue
    const demYesPct = (dem.yes / demTotal) * 100
    const repYesPct = (rep.yes / repTotal) * 100
    splits.push({
      id: r.id,
      chamber: r.chamber,
      yesCount: r.yesCount ?? 0,
      noCount: r.noCount ?? 0,
      result: r.result ?? 'unknown',
      sourceName: r.source?.name ?? null,
      sourceUrl: r.source?.url ?? null,
      demYesPct,
      repYesPct,
      demTotal,
      repTotal,
      spread: Math.abs(demYesPct - repYesPct),
    })
  }

  // Party-line: at least one major party is >80% on one side (yes ≥ 80% OR ≤ 20%).
  const isPartyLine = (s: PartyVoteSplit): boolean => {
    const demExtreme = s.demYesPct >= 80 || s.demYesPct <= 20
    const repExtreme = s.repYesPct >= 80 || s.repYesPct <= 20
    return demExtreme || repExtreme
  }

  // Bipartisan: both parties >60% on the same side.
  const isBipartisan = (s: PartyVoteSplit): boolean => {
    return (s.demYesPct > 60 && s.repYesPct > 60) || (s.demYesPct < 40 && s.repYesPct < 40)
  }

  const partyLineVotes = splits.filter(isPartyLine)
  const bipartisanVotes = splits.filter(isBipartisan)
  const topDemRepSplits = [...splits].sort((a, b) => b.spread - a.spread).slice(0, 10)

  return {
    partyLineVotes,
    bipartisanVotes,
    topDemRepSplits,
    partyLineCount: partyLineVotes.length,
    bipartisanCount: bipartisanVotes.length,
    totalWithPartyData: splits.length,
  }
}

export async function getCrossCountryTopicComparison(
  topic: string
): Promise<{ legislature: string; count: number }[]> {
  const rows = await prisma.legislativeVote.findMany({
    where: { topics: { contains: topic } },
    select: {
      topics: true,
      source: { select: { ingestedBy: true } },
    },
    take: 50000,
  })

  const byLeg = new Map<string, number>()
  for (const row of rows) {
    if (!row.topics) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(row.topics)
    } catch {
      continue
    }
    if (!Array.isArray(parsed)) continue
    // Exact topic match (contains filter is broad; this is the authoritative check)
    if (!(parsed as string[]).includes(topic)) continue
    const leg = row.source?.ingestedBy ?? 'unknown'
    byLeg.set(leg, (byLeg.get(leg) ?? 0) + 1)
  }

  return Array.from(byLeg.entries())
    .map(([legislature, count]) => ({ legislature, count }))
    .sort((a, b) => b.count - a.count)
}
