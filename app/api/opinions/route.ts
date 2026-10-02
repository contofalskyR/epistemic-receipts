import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Anonymous visits to /opinions must not reach Postgres on every request
// (STATUS.md Phase 5): the count and each page are cached for an hour and the
// CDN absorbs repeats on top. The keys are bounded (phase 6): court is
// whitelisted (own keys only — court=constructor used to reach
// Object.prototype), limit is 25/50/100, and page is clamped to the real page
// count from the cached count. Dates are normalised to YYYY-MM-DD, but even
// valid days are ~146k values each, so date-filtered views skip the data cache
// (CDN only). Bump the keyParts when a cached return shape changes.
const CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400'

const COURT_PIPELINE_MAP: Record<string, string[]> = {
  scotus: ['courtlistener_scotus_v1'],
  circuits: ['courtlistener_circuits_v1'],
  state: ['courtlistener_state_supreme_v1'],
  other: ['courtlistener_bia_v1', 'courtlistener_tax_v1'],
}
const ALL_PIPELINES = Object.values(COURT_PIPELINE_MAP).flat()

const COURT_LABEL_MAP: Record<string, string> = {
  courtlistener_scotus_v1: 'SCOTUS',
  courtlistener_circuits_v1: 'Circuit',
  courtlistener_state_supreme_v1: 'State',
  courtlistener_bia_v1: 'BIA',
  courtlistener_tax_v1: 'Tax',
}

const LIMITS = [25, 50, 100]
const MIN_DAY = '1700-01-01' // opinions start 1803; the clamp changes no result
const MAX_DAY = '2100-12-31'

/** A real calendar day as `YYYY-MM-DD` (what <input type="date"> sends),
 *  clamped to [MIN_DAY, MAX_DAY]; anything else is no filter. The isNaN check
 *  comes first: toISOString() throws on 2024-13-01. */
function normDay(raw: string | null): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return null
  return raw < MIN_DAY ? MIN_DAY : raw > MAX_DAY ? MAX_DAY : raw
}

/** Both bounds at UTC midnight, as `new Date('YYYY-MM-DD')` gave before. */
function opinionsWhere(court: string, from: string | null, to: string | null) {
  return {
    ingestedBy: { in: court === 'all' ? ALL_PIPELINES : COURT_PIPELINE_MAP[court] },
    deleted: false,
    ...(from || to
      ? {
          claimEmergedAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}),
          },
        }
      : {}),
  }
}

async function countOpinions(court: string, from: string | null, to: string | null): Promise<number> {
  return prisma.claim.count({ where: opinionsWhere(court, from, to) })
}

async function loadOpinionsPage(court: string, from: string | null, to: string | null, page: number, limit: number) {
  const claims = await prisma.claim.findMany({
    where: opinionsWhere(court, from, to),
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
    skip: (page - 1) * limit,
    take: limit,
  })

  // Plain JSON (ISO day strings, no Dates): a cache hit returns JSON.parse(body).
  return claims.map(c => {
    const sourceName = c.edges[0]?.source?.name ?? ''
    const sourceUrl = c.edges[0]?.source?.url ?? null
    const courtLabel = COURT_LABEL_MAP[c.ingestedBy ?? ''] ?? c.ingestedBy

    // Extract case name from source name "{case}, {citation} — {court} ({year})"
    const caseNameFromSource = sourceName.split(' — ')[0] ?? ''
    const caseName = caseNameFromSource || c.text.replace(/^The .+? in /, '').replace(/ issued.*$/, '')

    return {
      id: c.id,
      caseName: caseName.trim(),
      court: courtLabel,
      pipeline: c.ingestedBy,
      date: c.claimEmergedAt?.toISOString().slice(0, 10) ?? null,
      epistemicAxis: c.epistemicAxis,
      sourceUrl,
      linkedLegislation: c._count.relationsFrom,
    }
  })
}

// The named functions themselves, so a change to their body changes the key.
const countOpinionsCached = unstable_cache(countOpinions, ['api-opinions-count'], { revalidate: 3600 })
const loadOpinionsPageCached = unstable_cache(loadOpinionsPage, ['api-opinions-page'], { revalidate: 3600 })

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const rawCourt = sp.get('court')
    const court = rawCourt !== null && Object.hasOwn(COURT_PIPELINE_MAP, rawCourt) ? rawCourt : 'all'
    const from = normDay(sp.get('dateFrom'))
    const to = normDay(sp.get('dateTo'))
    const n = parseInt(sp.get('limit') ?? '50', 10)
    const limit = LIMITS.includes(n) ? n : 50

    const dated = from !== null || to !== null
    const count = dated ? countOpinions : countOpinionsCached
    const loadPage = dated ? loadOpinionsPage : loadOpinionsPageCached

    // allTotal: every opinion, whatever the filter — the /opinions header.
    const [total, allTotal] =
      court === 'all' && !dated
        ? await countOpinionsCached('all', null, null).then((t) => [t, t])
        : await Promise.all([count(court, from, to), countOpinionsCached('all', null, null)])
    const pages = Math.max(1, Math.ceil(total / limit))
    const page = Math.min(pages, Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1))
    const results = await loadPage(court, from, to, page, limit)

    return NextResponse.json(
      { total, allTotal, page, limit, pages, results },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    )
  } catch (err) {
    console.error('[/api/opinions] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
