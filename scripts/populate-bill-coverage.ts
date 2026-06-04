// Populate BillCoverage rows for 119th Congress bills by querying the NYT
// Article Search API. Respects the published rate limit (10 req/min) by
// sleeping 6 seconds between requests.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/populate-bill-coverage.ts --limit 50
//   npx dotenv-cli -e .env.local -- npx tsx scripts/populate-bill-coverage.ts --dry-run --limit 5
//
// Flags:
//   --limit N    Process at most N bills (default: all)
//   --dry-run    Print queries + response counts but don't write to DB
//   --skip-existing  Skip claims that already have a BillCoverage row

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NYT_KEY = process.env.NYT_API_KEY ?? 'K7ulaKJJ0gCckL2RrdfCcqMLfBGcvhr9SuJGoJh4TbNC4k3C'
const NYT_BASE = 'https://api.nytimes.com/svc/search/v2/articlesearch.json'
const REQUEST_DELAY_MS = 6_000

interface NytArticle {
  headline?: { main?: string }
  web_url?: string
  pub_date?: string
}

interface NytResponse {
  status?: string
  response?: {
    docs?: NytArticle[]
    meta?: { hits?: number }       // old field name (kept for compat)
    metadata?: { hits?: number }   // current field name as of 2026
  }
  fault?: { faultstring?: string }
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let limit = Number.POSITIVE_INFINITY
  let dryRun = false
  let skipExisting = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--dry-run') dryRun = true
    else if (a === '--skip-existing') skipExisting = true
    else if (a === '--limit') {
      const next = args[i + 1]
      const n = next != null ? Number(next) : NaN
      if (!Number.isFinite(n) || n <= 0) {
        console.error('--limit requires a positive integer')
        process.exit(1)
      }
      limit = n
      i++
    } else if (a?.startsWith('--limit=')) {
      const n = Number(a.split('=')[1])
      if (!Number.isFinite(n) || n <= 0) {
        console.error('--limit requires a positive integer')
        process.exit(1)
      }
      limit = n
    }
  }
  return { limit, dryRun, skipExisting }
}

// ── Query builder ──────────────────────────────────────────────────────────────

const TYPE_PREFIX_PATTERNS = [
  /^h\.?\s*r\.?\s*\d+/i,
  /^s\.?\s*\d+/i,
  /^h\.?\s*j\.?\s*res\.?\s*\d+/i,
  /^s\.?\s*j\.?\s*res\.?\s*\d+/i,
  /^h\.?\s*con\.?\s*res\.?\s*\d+/i,
  /^s\.?\s*con\.?\s*res\.?\s*\d+/i,
  /^h\.?\s*res\.?\s*\d+/i,
  /^s\.?\s*res\.?\s*\d+/i,
]

const LEAD_VERB_PATTERNS = [
  /^to\s+amend\s+(the\s+|chapter\s+|title\s+|subchapter\s+|subtitle\s+|act\s+)?/i,
  /^to\s+(provide|establish|require|prohibit|authorize|reauthorize|direct|designate|extend|modify|allow|create|prevent|ensure|reduce|increase|limit|permit|repeal|enable)\s+/i,
  /^to\s+/i,
  /^a\s+bill\s+to\s+/i,
  /^an?\s+act\s+to\s+/i,
  /^providing\s+for\s+/i,
  /^expressing\s+(the\s+sense|support)\s+/i,
]

const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'of', 'the', 'to', 'in', 'for', 'on', 'at', 'by',
  'with', 'as', 'that', 'this', 'these', 'those', 'from', 'into', 'such',
  'be', 'is', 'are', 'was', 'were', 'so', 'if',
])

/**
 * Extract a clean ~5-6 word NYT-style search query from a bill title.
 *
 * Strips H.R./S./H.Res./etc prefixes, then strips "To amend", "To provide",
 * "A bill to", "An act to", "Providing for", "Expressing the sense" leads.
 * Keeps the next 5–6 meaningful (non-stopword) words, in order.
 */
export function buildSearchQuery(rawTitle: string): string {
  // The Claim.text format from the tracker is:
  //   "H.R. 4405 (119th Congress) — "Epstein Files Transparency Act". Sponsored by..."
  // Prefer the short title inside the first pair of straight or curly quotes.
  const quoted = rawTitle.match(/[“"]([^“”"]{3,120})[”"]/)
  let title = quoted ? quoted[1]! : rawTitle

  // Drop any leading bill identifier (e.g. "H.R. 1234 ").
  for (const pat of TYPE_PREFIX_PATTERNS) {
    title = title.replace(pat, '')
  }
  title = title.replace(/^[\s\-—:.]+/, '').trim()

  // Drop boilerplate lead verbs.
  for (const pat of LEAD_VERB_PATTERNS) {
    const next = title.replace(pat, '')
    if (next !== title) { title = next; break }
  }
  title = title.replace(/^[\s\-—:.]+/, '').trim()

  // Drop trailing "Act of 2024", "Act of 2025", etc — NYT relevance is better
  // without the year.  Keep the bare "Act" if present.
  title = title.replace(/\s+of\s+\d{4}\s*$/i, '').trim()

  // Take first ~6 meaningful words (skip stopwords for the count, but keep them
  // in the output for natural phrasing).
  const words = title.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let meaningful = 0
  for (const w of words) {
    out.push(w)
    if (!STOPWORDS.has(w.toLowerCase())) meaningful++
    if (meaningful >= 6) break
  }
  let q = out.join(' ').trim()
  // Strip trailing punctuation/quotes.
  q = q.replace(/[.,;:!?'"“”]+$/g, '').trim()
  return q
}

// ── NYT fetch ──────────────────────────────────────────────────────────────────

async function fetchNyt(query: string, attempt = 1): Promise<{ hits: number; topDocs: NytArticle[] }> {
  const url = `${NYT_BASE}?q=${encodeURIComponent(query)}&api-key=${NYT_KEY}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })

  if (res.status === 429 || res.status === 503) {
    if (attempt > 3) throw new Error(`NYT API ${res.status} after ${attempt} attempts`)
    const backoff = 30_000 * attempt
    console.log(`    rate-limited (${res.status}); backing off ${backoff / 1000}s`)
    await sleep(backoff)
    return fetchNyt(query, attempt + 1)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NYT API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as NytResponse
  const hits = data.response?.metadata?.hits ?? data.response?.meta?.hits ?? 0
  const topDocs = (data.response?.docs ?? []).slice(0, 3)
  return { hits, topDocs }
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

// ── Main ───────────────────────────────────────────────────────────────────────

interface ClaimRow {
  id: string
  text: string
  externalId: string | null
  topics: { topic: { slug: string } }[]
}

async function main() {
  const { limit, dryRun, skipExisting } = parseArgs()

  console.log(`populate-bill-coverage starting`)
  console.log(`  limit=${Number.isFinite(limit) ? limit : 'all'}  dry-run=${dryRun}  skip-existing=${skipExisting}`)

  const claims: ClaimRow[] = await prisma.claim.findMany({
    where: {
      deleted: false,
      topics: { some: { topic: { slug: 'congress-119' } } },
      ingestedBy: { in: ['congress_bills_tracker_v1', 'congress_v1'] },
    },
    select: {
      id: true,
      text: true,
      externalId: true,
      topics: { select: { topic: { select: { slug: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`  ${claims.length.toLocaleString()} bills found tagged with congress-119`)

  let existingClaimIds = new Set<string>()
  if (skipExisting) {
    const existing = await prisma.billCoverage.findMany({ select: { claimId: true } })
    existingClaimIds = new Set(existing.map(e => e.claimId))
    console.log(`  ${existingClaimIds.size.toLocaleString()} bills already have coverage data`)
  }

  let processed = 0
  let written = 0
  let errors = 0
  let zeroCoverage = 0

  for (const claim of claims) {
    if (processed >= limit) break
    if (skipExisting && existingClaimIds.has(claim.id)) continue

    const query = buildSearchQuery(claim.text)
    if (!query || query.length < 3) {
      console.log(`  [skip] ${claim.externalId ?? claim.id}: empty query from "${claim.text.slice(0, 80)}"`)
      continue
    }

    processed++
    const label = claim.externalId ?? claim.id
    try {
      const { hits, topDocs } = await fetchNyt(query)
      if (hits === 0) zeroCoverage++

      const topHeadlines = topDocs.map(d => ({
        headline: d.headline?.main ?? '(no headline)',
        url: d.web_url ?? '',
        date: d.pub_date ?? '',
      }))

      console.log(
        `  [${processed}${Number.isFinite(limit) ? `/${Math.min(limit, claims.length)}` : ''}] ${label}` +
        ` · q="${query}" · hits=${hits}`
      )

      if (!dryRun) {
        await prisma.billCoverage.upsert({
          where: { claimId: claim.id },
          create: {
            claimId: claim.id,
            articleCount: hits,
            topHeadlines,
            searchQuery: query,
          },
          update: {
            articleCount: hits,
            topHeadlines,
            searchQuery: query,
            lastChecked: new Date(),
          },
        })
        written++
      }
    } catch (err) {
      errors++
      console.error(`  [err] ${label}: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Rate-limit: ~10 req/min.
    if (processed < limit && processed < claims.length) {
      await sleep(REQUEST_DELAY_MS)
    }
  }

  console.log(`\nDone. processed=${processed} written=${written} errors=${errors} zero-coverage=${zeroCoverage}`)
  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
