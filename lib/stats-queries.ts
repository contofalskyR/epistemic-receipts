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

export async function getCrossCountryTopicComparison(
  topic: string
): Promise<{ legislature: string; count: number }[]> {
  const rows = await prisma.legislativeVote.findMany({
    where: { topics: { contains: topic } },
    select: {
      topics: true,
      source: { select: { ingestedBy: true } },
    },
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
