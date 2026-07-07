// Pilot pipeline 2: PacLII Pacific Island Legislation
// Archetype: Wayback/CDX enumeration + Wayback fetch (flaky-source, exercises retry + resume)
// Migrated from scripts/ingest-paclii.ts (now in scripts/legacy/)

import { definePipeline, type Adapter } from '@/lib/ingest/definePipeline'
import * as https from 'https'
import * as http from 'http'

const TAG = 'paclii_legislation_v1'
const CDX_API_BASE = 'http://web.archive.org/cdx/search/cdx'
const WAYBACK_BASE = 'https://web.archive.org/web'
const REQUEST_DELAY_MS = 1200
const CDX_DELAY_MS = 600

const COUNTRIES = [
  { code: 'fj', name: 'Fiji' },
  { code: 'sb', name: 'Solomon Islands' },
  { code: 'vu', name: 'Vanuatu' },
  { code: 'to', name: 'Tonga' },
  { code: 'ws', name: 'Samoa' },
  { code: 'ki', name: 'Kiribati' },
  { code: 'tv', name: 'Tuvalu' },
  { code: 'pg', name: 'Papua New Guinea' },
]

interface ActSlug {
  countryCode: string
  countryName: string
  slug: string
  timestamp: string
  originalUrl: string
}

interface FetchedAct extends ActSlug {
  title: string
  year: number | null
}

function parseCursor(cursor: string | null): number {
  if (!cursor) return 0
  const m = /^IDX:(\d+)$/.exec(cursor)
  return m ? parseInt(m[1]!) : 0
}

function encodeCursor(idx: number): string {
  return `IDX:${idx}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function anyGet(urlStr: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const lib = parsed.protocol === 'https:' ? https : http
    const port = parsed.protocol === 'https:' ? 443 : (parsed.port ? parseInt(parsed.port) : 80)
    const req = (lib as typeof https).request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'text/html,application/json,*/*',
          'Accept-Language': 'en',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          anyGet(new URL(res.headers.location as string, urlStr).toString(), timeoutMs).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${urlStr}`))
            return
          }
          resolve(Buffer.concat(chunks).toString('utf8'))
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timed out: ${urlStr}`)) })
    req.on('error', reject)
    req.end()
  })
}

async function getCdxSlugs(countryCode: string): Promise<ActSlug[]> {
  const country = COUNTRIES.find(c => c.code === countryCode)!
  const url = `${CDX_API_BASE}?url=www.paclii.org/${countryCode}/legis/consol_act/*&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=2000`
  let body: string
  try { body = await anyGet(url) } catch { return [] }

  let data: string[][]
  try { data = JSON.parse(body) as string[][] } catch { return [] }

  const slugRegex = new RegExp(`^https?://www\\.paclii\\.org(?::\\d+)?/${countryCode}/legis/consol_act/([^/?#.]+)/?$`)
  const seen = new Set<string>()
  const results: ActSlug[] = []

  for (const row of data.slice(1)) {
    const [originalUrl, timestamp] = row
    if (!originalUrl || !timestamp) continue
    const m = slugRegex.exec(originalUrl)
    if (!m) continue
    const slug = m[1]!
    if (!slug || slug === 'index' || seen.has(slug)) continue
    seen.add(slug)
    results.push({ countryCode, countryName: country.name, slug, timestamp, originalUrl })
  }
  return results
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  if (!m) return ''
  return m[1]!.trim().replace(/\s+/g, ' ')
}

function extractYear(html: string): number | null {
  const bodyStart = html.indexOf('<body')
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html
  const cleaned = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const matches = [...cleaned.matchAll(/\bof\s+(1[789]\d\d|20[012]\d)\b/g)]
  if (matches.length === 0) return null
  const years = matches.map(m => parseInt(m[1]!))
  const earliest = Math.min(...years)
  return earliest >= 1850 && earliest <= 2025 ? earliest : null
}

let slugCache: ActSlug[] | null = null

async function getAllSlugs(): Promise<ActSlug[]> {
  if (slugCache) return slugCache
  const all: ActSlug[] = []
  for (const country of COUNTRIES) {
    const slugs = await getCdxSlugs(country.code)
    all.push(...slugs)
    await sleep(CDX_DELAY_MS)
  }
  slugCache = all
  return all
}

const pacliiAdapter: Adapter<FetchedAct> = {
  async fetchBatch(cursor) {
    const startIdx = parseCursor(cursor)
    const allSlugs = await getAllSlugs()

    if (startIdx >= allSlugs.length) return { items: [], nextCursor: null }

    const slug = allSlugs[startIdx]!
    const waybackUrl = `${WAYBACK_BASE}/${slug.timestamp}/${slug.originalUrl}`
    let title = ''
    let year: number | null = null
    try {
      const body = await anyGet(waybackUrl)
      title = extractTitle(body)
      year = extractYear(body)
    } catch { /* failed fetch — validate() will reject */ }
    await sleep(REQUEST_DELAY_MS)

    const item: FetchedAct = { ...slug, title, year }
    const nextIdx = startIdx + 1
    const nextCursor = nextIdx < allSlugs.length ? encodeCursor(nextIdx) : null
    return { items: [item], nextCursor }
  },
}

function transform(raw: FetchedAct) {
  const externalId = `paclii_${raw.countryCode}_${raw.slug}`
  const claimEmergedAt = raw.year ? new Date(`${raw.year}-01-01T00:00:00Z`) : null
  const waybackUrl = `${WAYBACK_BASE}/${raw.timestamp}/${raw.originalUrl}`

  return {
    externalId,
    claim: {
      text: `${raw.countryName} enacted the ${raw.title}.`,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'PROVISIONAL',
      claimEmergedAt,
      claimEmergedPrecision: raw.year ? 'YEAR' : null,
      metadata: {
        dataset: TAG,
        countryCode: raw.countryCode,
        country: raw.countryName,
        slug: raw.slug,
        waybackTimestamp: raw.timestamp,
        source: 'paclii.org',
      },
    },
    sources: [{
      externalId: `src_${externalId}`,
      name: `PacLII — ${raw.countryName}: ${raw.title.slice(0, 120)}`,
      url: waybackUrl,
      publishedAt: claimEmergedAt,
      methodologyType: 'primary',
    }],
    edges: [{ sourceIndex: 0, type: 'CITES', evidenceType: 'EVIDENTIARY' }],
    topicSlugs: [`${raw.countryCode}-parliament`],
  }
}

function validate(t: ReturnType<typeof transform>): { ok: true } | { ok: false; reason: string } {
  if (!t.externalId) return { ok: false, reason: 'missing externalId' }
  if (!t.claim.text?.trim() || t.claim.text.includes('enacted the .')) {
    return { ok: false, reason: 'empty or missing title — Wayback fetch likely failed' }
  }
  if (!t.sources[0]?.url) return { ok: false, reason: 'missing source url' }
  return { ok: true }
}

export const pipeline = definePipeline({
  tag: TAG,
  adapter: pacliiAdapter,
  batchSize: 1,
  rateLimitMs: 0,
  autoApproved: true,
  transform,
  validate,
})
