import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isGenericQuery } from "@/lib/coverage-query"

export const revalidate = 300

const STATUS_LABELS: Record<string, string> = {
  "status-enacted": "Enacted",
  "status-passed-house": "Passed House",
  "status-passed-senate": "Passed Senate",
  "status-vetoed": "Vetoed",
  "status-failed": "Failed",
  "status-introduced": "Introduced",
  "status-in-progress": "In Progress",
}

const STATUS_PRIORITY: Record<string, number> = {
  "status-enacted": 0,
  "status-passed-senate": 1,
  "status-passed-house": 2,
  "status-vetoed": 3,
  "status-failed": 4,
  "status-in-progress": 5,
  "status-introduced": 6,
}

const BILL_TYPE_DISPLAY: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
}

function billTypeFromExternalId(externalId: string | null): string | null {
  if (!externalId) return null
  const m = externalId.match(/_(hr|s|hjres|sjres|hconres|sconres|hres|sres)_\d+$/)
  if (!m) return null
  return BILL_TYPE_DISPLAY[m[1]!] ?? m[1]!.toUpperCase()
}

function statusFromTopicSlugs(slugs: string[]): string {
  let best = "status-in-progress"
  let bestPri = Number.POSITIVE_INFINITY
  for (const s of slugs) {
    const pri = STATUS_PRIORITY[s]
    if (pri == null) continue
    if (pri < bestPri) { bestPri = pri; best = s }
  }
  return best
}

interface Headline { headline: string; url: string; date: string }

function coerceHeadlines(raw: unknown): Headline[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((h): Headline[] => {
    if (!h || typeof h !== "object") return []
    const o = h as Record<string, unknown>
    return [{
      headline: typeof o.headline === "string" ? o.headline : "(no headline)",
      url: typeof o.url === "string" ? o.url : "",
      date: typeof o.date === "string" ? o.date : "",
    }]
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get("sort") === "asc" ? "asc" : "desc"
  const status = searchParams.get("status") ?? "all"
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? 200)))
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0))

  const totalCovered = await prisma.billCoverage.count()
  if (totalCovered === 0) {
    return NextResponse.json({
      bills: [],
      stats: { total: 0, withCoverage: 0, zeroCoverage: 0, avgArticles: 0, lastRefreshed: null },
      note: "Coverage data not yet computed. Run scripts/populate-bill-coverage.ts to populate.",
    })
  }

  const rows = await prisma.billCoverage.findMany({
    orderBy: { articleCount: sort },
    take: limit,
    skip: offset,
    select: {
      id: true,
      claimId: true,
      articleCount: true,
      topHeadlines: true,
      searchQuery: true,
      lastChecked: true,
      claim: {
        select: {
          id: true,
          text: true,
          externalId: true,
          topics: { select: { topic: { select: { slug: true } } } },
        },
      },
    },
  })

  const bills = rows
    .filter(r => r.claim != null)
    .map(r => {
      const claim = r.claim!
      const topicSlugs = claim.topics.map(t => t.topic.slug)
      const statusSlug = statusFromTopicSlugs(topicSlugs)
      return {
        id: r.id,
        claimId: claim.id,
        title: claim.text,
        externalId: claim.externalId,
        billType: billTypeFromExternalId(claim.externalId),
        articleCount: r.articleCount,
        topHeadlines: coerceHeadlines(r.topHeadlines),
        searchQuery: r.searchQuery,
        // Existing cache rows built from boilerplate titles ("Recognizing",
        // "_______ Act") return NYT's 10,000-hit cap — flag them so the UI
        // can exclude them from coverage rankings.
        genericQuery: isGenericQuery(r.searchQuery),
        lastChecked: r.lastChecked.toISOString(),
        topics: topicSlugs,
        status: statusSlug,
        statusLabel: STATUS_LABELS[statusSlug] ?? statusSlug,
      }
    })
    .filter(b => {
      if (status === "all") return true
      if (status === "enacted") return b.status === "status-enacted"
      return b.topics.includes(`status-${status}`)
    })

  // Aggregate stats over the *full* coverage table, not the page slice.
  const agg = await prisma.billCoverage.aggregate({
    _avg: { articleCount: true },
    _max: { lastChecked: true },
    _count: { _all: true },
  })
  const zeroCoverage = await prisma.billCoverage.count({ where: { articleCount: 0 } })
  const withCoverage = (agg._count._all ?? 0) - zeroCoverage

  // Total 119th-congress bills tagged in DB (not necessarily covered yet).
  const totalBills = await prisma.claim.count({
    where: {
      deleted: false,
      topics: { some: { topic: { slug: "congress-119" } } },
      ingestedBy: { in: ["congress_bills_tracker_v1", "congress_v1"] },
    },
  })

  return NextResponse.json({
    bills,
    stats: {
      total: totalBills,
      analyzed: agg._count._all ?? 0,
      withCoverage,
      zeroCoverage,
      avgArticles: Number((agg._avg.articleCount ?? 0).toFixed(2)),
      lastRefreshed: agg._max.lastChecked ? agg._max.lastChecked.toISOString() : null,
    },
  })
}
