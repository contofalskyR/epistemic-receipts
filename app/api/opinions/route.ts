import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Anonymous visits to /opinions must not reach Postgres on every request
// (STATUS.md Phase 5): the whole page payload is cached for an hour per
// (court, dateFrom, dateTo, page, limit) — a bounded key space — and the CDN
// absorbs repeats on top of that.
const CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400'

const COURT_PIPELINE_MAP: Record<string, string[]> = {
  scotus: ['courtlistener_scotus_v1'],
  circuits: ['courtlistener_circuits_v1'],
  state: ['courtlistener_state_supreme_v1'],
  other: ['courtlistener_bia_v1', 'courtlistener_tax_v1'],
}

const COURT_LABEL_MAP: Record<string, string> = {
  courtlistener_scotus_v1: 'SCOTUS',
  courtlistener_circuits_v1: 'Circuit',
  courtlistener_state_supreme_v1: 'State',
  courtlistener_bia_v1: 'BIA',
  courtlistener_tax_v1: 'Tax',
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

const loadOpinions = unstable_cache(
  async (courtFilter: string, dateFromIso: string | null, dateToIso: string | null, pageParam: number, limitParam: number) => {
    const dateFrom = dateFromIso ? new Date(dateFromIso) : null
    const dateTo = dateToIso ? new Date(dateToIso) : null
    const offset = (pageParam - 1) * limitParam

    const pipelines =
      courtFilter !== 'all' && COURT_PIPELINE_MAP[courtFilter]
        ? COURT_PIPELINE_MAP[courtFilter]
        : Object.values(COURT_PIPELINE_MAP).flat()

    const where = {
      ingestedBy: { in: pipelines },
      deleted: false,
      ...(dateFrom || dateTo
        ? {
            claimEmergedAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    }

    const [total, claims] = await Promise.all([
      prisma.claim.count({ where }),
      prisma.claim.findMany({
        where,
        select: {
          id: true,
          text: true,
          ingestedBy: true,
          claimEmergedAt: true,
          epistemicAxis: true,
          externalId: true,
          edges: {
            select: { source: { select: { url: true, name: true } } },
            take: 1,
            where: { deleted: false },
          },
          _count: {
            select: {
              relationsFrom: true,
            },
          },
        },
        orderBy: { claimEmergedAt: 'desc' },
        skip: offset,
        take: limitParam,
      }),
    ])

    const results = claims.map(c => {
      const sourceName = c.edges[0]?.source?.name ?? ''
      const sourceUrl = c.edges[0]?.source?.url ?? null
      const court = COURT_LABEL_MAP[c.ingestedBy ?? ''] ?? c.ingestedBy

      // Extract case name from source name "{case}, {citation} — {court} ({year})"
      const caseNameFromSource = sourceName.split(' — ')[0] ?? ''
      const caseName = caseNameFromSource || c.text.replace(/^The .+? in /, '').replace(/ issued.*$/, '')

      return {
        id: c.id,
        caseName: caseName.trim(),
        court,
        pipeline: c.ingestedBy,
        date: c.claimEmergedAt?.toISOString().slice(0, 10) ?? null,
        epistemicAxis: c.epistemicAxis,
        sourceUrl,
        linkedLegislation: c._count.relationsFrom,
      }
    })

    return {
      total,
      page: pageParam,
      limit: limitParam,
      pages: Math.ceil(total / limitParam),
      results,
    }
  },
  ['api-opinions'],
  { revalidate: 3600 },
)

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const courtFilter = sp.get('court') ?? 'all'
    const dateFrom = parseDate(sp.get('dateFrom'))
    const dateTo = parseDate(sp.get('dateTo'))
    const pageParam = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
    const limitParam = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50', 10) || 50))

    const payload = await loadOpinions(
      courtFilter,
      dateFrom ? dateFrom.toISOString() : null,
      dateTo ? dateTo.toISOString() : null,
      pageParam,
      limitParam,
    )
    return NextResponse.json(payload, { headers: { 'Cache-Control': CACHE_CONTROL } })
  } catch (err) {
    console.error('[/api/opinions] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
