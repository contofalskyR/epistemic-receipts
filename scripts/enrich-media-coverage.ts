// Enrichment: Media Coverage for Congress Bill Claims
// Searches NYT Article Search API for news coverage of enacted bills.
// Extracts bill number + title from claim metadata, queries NYT, and classifies framing.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-media-coverage.ts --dry-run [--limit N]
//      npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-media-coverage.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NYT_API_KEY = 'K7ulaKJJ0gCckL2RrdfCcqMLfBGcvhr9SuJGoJh4TbNC4k3C'
const NYT_SEARCH_URL = 'https://api.nytimes.com/svc/search/v2/articlesearch.json'
const MIN_INTERVAL = 1200 // NYT rate limits in practice around ~50 req/min

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --full [--limit N] [--verbose]')
        process.exit(1) as never
      })()
  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? parseInt(args[li + 1] ?? '10', 10) : (mode === 'dry-run' ? 20 : 0),
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
let lastReqAt = 0
async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── Bill number extraction ────────────────────────────────────────────────────

interface BillInfo {
  billNumber: string  // e.g. "H.R. 7147"
  congress: number
  title: string | null
  enactedAt: Date | null
}

const BILL_TYPE_MAP: Record<string, string> = {
  HR: 'H.R.',
  S: 'S.',
  HJRES: 'H.J.Res.',
  SJRES: 'S.J.Res.',
  HRES: 'H.Res.',
  SRES: 'S.Res.',
}

function parseBillFromClaim(claim: { externalId: string | null; text: string; metadata: unknown }): BillInfo | null {
  if (!claim.metadata || typeof claim.metadata !== 'object') return null
  const meta = claim.metadata as Record<string, unknown>

  const billTypeRaw = (meta.billType as string | undefined)?.toUpperCase()
  const billNum = meta.billNumber as string | undefined
  const congressNum = meta.congress as number | undefined

  if (!billTypeRaw || !billNum || !congressNum) return null

  const billType = BILL_TYPE_MAP[billTypeRaw] ?? billTypeRaw
  const billNumber = `${billType} ${billNum}`

  // Extract title after the em dash in claim text
  const titleMatch = claim.text.match(/—\s*(.+)$/)
  const title = titleMatch ? titleMatch[1].trim() : null

  const enactedAt = meta.enactedDate ? new Date(meta.enactedDate as string) : null

  return { billNumber, congress: congressNum, title, enactedAt }
}

// ── NYT search ────────────────────────────────────────────────────────────────

interface NytArticle {
  headline: string
  url: string
  publishedAt: string
  snippet: string
}

const FRAMING_KEYWORDS = {
  SUPPORTIVE: ['passes', 'signed', 'approved', 'enacted', 'bipartisan', 'victory', 'wins', 'advances'],
  CRITICAL: ['rejected', 'controversial', 'opposition', 'critics', 'protest', 'backlash', 'defeat', 'fails', 'opposed'],
  NEUTRAL: ['votes', 'passed', 'signed into law', 'congress', 'senate', 'house'],
}

function classifyFraming(headline: string, snippet: string): 'SUPPORTIVE' | 'CRITICAL' | 'NEUTRAL' | 'DESCRIPTIVE' {
  const text = `${headline} ${snippet}`.toLowerCase()
  const scores = { SUPPORTIVE: 0, CRITICAL: 0 }
  for (const word of FRAMING_KEYWORDS.SUPPORTIVE) if (text.includes(word)) scores.SUPPORTIVE++
  for (const word of FRAMING_KEYWORDS.CRITICAL) if (text.includes(word)) scores.CRITICAL++
  if (scores.CRITICAL > scores.SUPPORTIVE) return 'CRITICAL'
  if (scores.SUPPORTIVE > scores.CRITICAL) return 'SUPPORTIVE'
  return 'DESCRIPTIVE'
}

// Bills with these title prefixes are procedural noise — skip them
const SKIP_TITLE_PREFIXES = [
  'To designate the facility',
  'To designate the ',
  'A joint resolution providing for',
  'A bill to amend',
  'A bill to make',
  'A bill to provide for',
  'Relating to a national emergency',
]

// Pure-acronym titles (all caps, 2-8 chars before "Act") produce only noise
const ACRONYM_ACT_RE = /^[A-Z]{2,8}\s+Act$/

function isSearchableTitle(title: string | null): boolean {
  if (!title) return false
  if (SKIP_TITLE_PREFIXES.some(p => title.startsWith(p))) return false
  if (ACRONYM_ACT_RE.test(title.trim())) return false
  return true
}

function buildNytQuery(bill: BillInfo): string {
  if (bill.title && isSearchableTitle(bill.title)) {
    // Strip trailing year and US boilerplate, then quote for exact phrase match
    const cleaned = bill.title
      .replace(/\s+of\s+\d{4}$/, '')
      .replace(/\s+of the United States$/, '')
      .replace(/,\s*\d{4}$/, '')
      .trim()
    return `"${cleaned}"`
  }
  return ''
}

async function searchNyt(bill: BillInfo, verbose: boolean): Promise<NytArticle[]> {
  await throttle()

  const query = buildNytQuery(bill)
  if (!query) {
    if (verbose) console.log(`  Skipping — generic title`)
    return []
  }

  // Date range: 6 months before enactment through 3 months after
  const enacted = bill.enactedAt ?? new Date()
  const start = new Date(enacted)
  start.setMonth(start.getMonth() - 6)
  const end = new Date(enacted)
  end.setMonth(end.getMonth() + 3)
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

  const params = new URLSearchParams({
    q: query,
    fq: 'typeOfMaterials:Article AND section.name:("U.S." "Politics" "Washington")',
    'api-key': NYT_API_KEY,
    begin_date: fmtDate(start),
    end_date: fmtDate(end),
    sort: 'relevance',
    page: '0',
  })

  const url = `${NYT_SEARCH_URL}?${params}`
  if (verbose) console.log(`  NYT query: ${query}`)

  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 429) {
      console.warn('  NYT rate limit — sleeping 12s')
      await sleep(12000)
    }
    return []
  }

  const data = await res.json() as {
    response?: { docs?: Array<{ headline: { main: string }; web_url: string; pub_date: string; snippet: string }> }
  }

  return (data.response?.docs ?? []).slice(0, 5).map(doc => ({
    headline: doc.headline.main,
    url: doc.web_url,
    publishedAt: doc.pub_date,
    snippet: doc.snippet,
  }))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()
  console.log(`\n── Media Coverage Enrichment (${mode}) ──────────────────────────────`)

  // Target recent congresses (118th–119th) and bigger bill types to maximize hit rate
  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: 'congress_v1',
      metadata: {
        path: ['congress'],
        gte: 118,
      },
    },
    select: { id: true, externalId: true, text: true, metadata: true },
    take: limit > 0 ? limit : undefined,
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Found ${claims.length} congress bill claims to check\n`)

  const stats = { hits: 0, misses: 0, skipped: 0, stored: 0 }
  const samples: Array<{ slug: string; bill: string; articles: NytArticle[] }> = []

  for (const claim of claims) {
    const bill = parseBillFromClaim(claim as { externalId: string | null; text: string; metadata: unknown })
    if (!bill) { stats.skipped++; continue }
    if (!isSearchableTitle(bill.title)) { stats.skipped++; continue }

    process.stdout.write(`[${bill.congress}th] ${bill.billNumber.padEnd(15)}`)

    const articles = await searchNyt(bill, verbose)

    if (articles.length === 0) {
      process.stdout.write(` — no coverage\n`)
      stats.misses++
      continue
    }

    stats.hits++
    process.stdout.write(` — ${articles.length} article(s)\n`)

    if (verbose) {
      for (const a of articles) {
        const framing = classifyFraming(a.headline, a.snippet)
        console.log(`    [${framing}] ${a.headline}`)
        console.log(`      ${a.url}`)
      }
    }

    samples.push({ slug: claim.externalId ?? claim.id, bill: bill.billNumber, articles })

    if (mode === 'full') {
      // TODO: write to MediaCoverage table once schema is migrated
      stats.stored += articles.length
    }
  }

  const hitRate = claims.length > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) : '0'

  console.log(`\nResults:`)
  console.log(`  Hit rate:  ${hitRate}% (${stats.hits} with coverage, ${stats.misses} without)`)
  console.log(`  Skipped:   ${stats.skipped} (no bill number parseable)`)
  if (mode === 'full') console.log(`  Stored:    ${stats.stored} articles`)

  if (samples.length > 0 && mode === 'dry-run') {
    console.log(`\nSample hits:`)
    for (const s of samples.slice(0, 5)) {
      console.log(`  ${s.slug}`)
      for (const a of s.articles.slice(0, 2)) {
        const framing = classifyFraming(a.headline, a.snippet)
        console.log(`    [${framing}] ${a.headline}`)
      }
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
