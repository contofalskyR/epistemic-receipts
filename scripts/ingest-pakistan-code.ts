// Pipeline: Pakistan Code — consolidated federal acts of Pakistan (pakistan_code_v1)
// Source: The Pakistan Code, Ministry of Law and Justice
//   Live:    https://pakistancode.gov.pk/english/LGu0xAD?alp={LETTER}&page=1&action=inactive
//   Fallback: https://web.archive.org/web/20260121/{live_url}
//   (live site returns HTTP timeout as of 2026-06-08; Wayback 2026-01-21 snapshot used)
// Coverage: ~1,100+ Federal Laws, all letters A–Z.
//   Page is server-rendered HTML (accordion-section pattern); no API.
//   Each accordion entry: title, category, act-number (may be Roman numeral), promulgation date.
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-pakistan-code.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-pakistan-code.ts --limit 20
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-pakistan-code.ts --full
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-pakistan-code.ts --full --limit 200

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as zlib from 'zlib'

const prisma = new PrismaClient()

const INGESTED_BY = 'pakistan_code_v1'
const LIVE_BASE = 'https://pakistancode.gov.pk/english/LGu0xAD'
const REQUEST_DELAY_MS = 1200
const CONNECT_TIMEOUT_MS = 12000

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActRecord {
  externalId: string
  sourceExternalId: string
  title: string
  actNumber: string        // e.g. "XX" or "12" or "CXIV"
  year: number
  category: string
  promulgationDate: Date | null
  promulgationPrecision: 'DAY' | 'YEAR'
  letter: string
  href: string             // obfuscated URL slug from the site
  sourceUrl: string
  claimText: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isFull = args.includes('--full')
  if (!isDryRun && !isFull) {
    console.error('Usage: --dry-run | --full  [--limit N] [--verbose]')
    process.exit(1)
  }
  const li = args.indexOf('--limit')
  return {
    mode: isDryRun ? 'dry-run' as const : 'full' as const,
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── HTTP ───────────────────────────────────────────────────────────────────────

function httpsGet(url: string, timeoutMs = 40000, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; +https://epistemic-receipts.vercel.app)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Follow redirects
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location && maxRedirects > 0) {
          res.resume()
          // Resolve relative redirects
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).toString()
          resolve(httpsGet(nextUrl, timeoutMs, maxRedirects - 1))
          return
        }
        const chunks: Buffer[] = []
        let stream: NodeJS.ReadableStream = res
        if (res.headers['content-encoding'] === 'gzip') {
          stream = res.pipe(zlib.createGunzip())
        }
        stream.on('data', (c: Buffer) => chunks.push(c))
        stream.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          } else {
            resolve(body)
          }
        })
        stream.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)) })
    req.on('error', reject)
    req.end()
  })
}

const WAYBACK_SNAPSHOTS = [
  '20260121022709', '20250508122239', '20241217220356',
  '20240918203034', '20240520221533', '20240426173556', '20240424192257',
]

async function fetchLetterPage(letter: string): Promise<string> {
  const path = `?alp=${letter}&page=1&action=inactive`
  const liveUrl = `${LIVE_BASE}${path}`

  // Try live first with short timeout
  try {
    const html = await httpsGet(liveUrl, CONNECT_TIMEOUT_MS)
    if (html.includes('accordion-section-title')) return html
  } catch (_) {
    // Fall through to Wayback
  }

  // Try each Wayback snapshot with retry on connection error
  for (const snapshot of WAYBACK_SNAPSHOTS) {
    const waybackUrl = `https://web.archive.org/web/${snapshot}/${liveUrl}`
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const html = await httpsGet(waybackUrl, 45000)
        if (html.includes('accordion-section-title')) return html
        break // 200 OK but no accordion — try next snapshot
      } catch (err) {
        const msg = (err as Error).message
        if (msg.includes('ECONNREFUSED') && attempt < 2) {
          await sleep(3000 * (attempt + 1))
          continue
        }
        break // Non-retryable error — try next snapshot
      }
    }
  }

  throw new Error(`All fetch attempts failed for letter ${letter}`)
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Roman numeral to integer (handles MCMXCIX level; used to validate, not convert)
const ROMAN_VALID = /^(M{0,4})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i

function isRomanNumeral(s: string): boolean {
  return s.length > 0 && ROMAN_VALID.test(s.trim())
}

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function parsePromulgationDate(raw: string): { date: Date | null; precision: 'DAY' | 'YEAR' } {
  const cleaned = raw.replace(/\.$/, '').trim()

  // "February 17 1975" or "December 01 1996"
  const fullMatch = cleaned.match(/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/i)
  if (fullMatch) {
    const month = MONTH_MAP[fullMatch[1]!.toLowerCase()]
    const day = parseInt(fullMatch[2]!, 10)
    const year = parseInt(fullMatch[3]!, 10)
    if (month && day >= 1 && day <= 31 && year >= 1900) {
      return {
        date: new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`),
        precision: 'DAY',
      }
    }
  }

  // "April 29 2013" variant without leading zero — handled above
  // "December  23rd September, 1958" (typo in source data)
  const yearOnlyMatch = cleaned.match(/(\d{4})/)
  if (yearOnlyMatch) {
    const year = parseInt(yearOnlyMatch[1]!, 10)
    if (year >= 1900 && year <= 2030) {
      return { date: new Date(`${year}-01-01T00:00:00Z`), precision: 'YEAR' }
    }
  }

  return { date: null, precision: 'YEAR' }
}

function parseActNumber(numberField: string): { actNumber: string; year: number } | null {
  // Format: "XX of 1975" or "12 of 1961" or "CXIV of 2002"
  const m = numberField.match(/^([\w]+)\s+of\s+(\d{4})$/i)
  if (!m) return null
  const num = m[1]!.trim()
  const year = parseInt(m[2]!, 10)
  if (year < 1800 || year > 2030) return null
  return { actNumber: num, year }
}

// Extract all acts from a letter's HTML page
function parseLetterPage(html: string, letter: string): ActRecord[] {
  const records: ActRecord[] = []

  // Each accordion section: title div + content div
  // Pattern: data-tab="#accordionsN" ... <a href="...">Title</a> ... </div> ... content div ... </div>
  const sectionRe =
    /class="accordion-section-title"[^>]*>[\s\S]*?<a\s+href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?class="accordion-section-content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g

  let match: RegExpExecArray | null
  while ((match = sectionRe.exec(html)) !== null) {
    const href = match[1]!.trim()
    const rawTitle = stripHtml(decodeEntities(match[2]!)).trim()
    const detailBlock = match[3]!

    if (!rawTitle || rawTitle.length < 3) continue
    // Skip obvious boilerplate
    if (rawTitle.startsWith('Home') || rawTitle.startsWith('Laws in')) continue

    // Parse detail block: "Civil Laws | XX of 1975 | Promulgation Date: February 17 1975."
    const detailText = stripHtml(decodeEntities(detailBlock))

    // Extract number and year from "XX of 1975" pattern
    const numMatch = detailText.match(/([\w]+\s+of\s+\d{4})/i)
    if (!numMatch) continue
    const parsed = parseActNumber(numMatch[1]!)
    if (!parsed) continue
    const { actNumber, year } = parsed

    // Extract category (before first |)
    const catMatch = detailText.match(/^\s*([^|]+)\s*\|/)
    const category = catMatch ? catMatch[1]!.trim() : 'Unknown'

    // Extract promulgation date
    const dateMatch = detailText.match(/Promulgation Date:\s*([^|<]+)/i)
    const { date: promulgationDate, precision: promulgationPrecision } =
      dateMatch ? parsePromulgationDate(dateMatch[1]!.trim()) : { date: null, precision: 'YEAR' as const }

    // externalId from href (already unique per act on the site)
    const safeHref = href.replace(/[^a-zA-Z0-9_%-]/g, '_').slice(0, 120)
    const externalId = `pak_code_${safeHref}`
    const sourceExternalId = `src_pak_code_${safeHref}`
    const sourceUrl = `https://pakistancode.gov.pk/english/${href}`

    // Strip "(Repealed...)" or "(Repeal by...)" annotation — may contain nested parens
    // Greedy strip from "(Repeal" to end of string covers all nesting levels
    const cleanTitle = rawTitle.replace(/\s*\(Repeal.*/i, '').trim()

    const claimText = `Pakistan: ${cleanTitle} (${actNumber} of ${year})`

    records.push({
      externalId,
      sourceExternalId,
      title: cleanTitle,
      actNumber,
      year,
      category,
      promulgationDate,
      promulgationPrecision,
      letter,
      href,
      sourceUrl,
      claimText,
    })
  }

  return records
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<ActRecord[]> {
  const seen = new Set<string>()
  const records: ActRecord[] = []

  for (const letter of LETTERS) {
    try {
      const html = await fetchLetterPage(letter)
      const parsed = parseLetterPage(html, letter)
      let added = 0
      for (const rec of parsed) {
        if (seen.has(rec.externalId)) continue
        seen.add(rec.externalId)
        records.push(rec)
        added++
      }
      if (verbose) {
        console.log(`  ${letter}: ${added} acts (total ${records.length})`)
      } else {
        console.log(`  ${letter}: ${added} acts`)
      }
      if (limit > 0 && records.length >= limit) return records.slice(0, limit)
    } catch (err) {
      console.error(`  ${letter}: fetch failed — ${(err as Error).message}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  return records
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    topicCache.set(slug, existing.id)
    return existing.id
  }
  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one row ─────────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: ActRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const publishedAt = rec.promulgationDate ?? new Date(`${rec.year}-01-01T00:00:00Z`)

    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `Pakistan Code — ${rec.title.slice(0, 120)}`,
        url: rec.sourceUrl,
        publishedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'HARD_FACT',
        claimEmergedAt: publishedAt,
        claimEmergedPrecision: rec.promulgationDate ? rec.promulgationPrecision : 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          jurisdiction: 'PAK',
          title: rec.title,
          actNumber: rec.actNumber,
          year: rec.year,
          category: rec.category,
          letter: rec.letter,
          href: rec.href,
          promulgationDate: rec.promulgationDate?.toISOString() ?? null,
          source: 'pakistancode.gov.pk',
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })

    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log('\n── Pakistan Code: Consolidated Federal Acts of Pakistan (pakistan_code_v1) ──')
  console.log(`Mode: ${mode}${limit ? ` limit=${limit}` : ''}`)
  console.log(`Source: pakistancode.gov.pk (Ministry of Law and Justice)`)
  console.log(`Fallback: Wayback Machine (snapshots: ${WAYBACK_SNAPSHOTS.join(', ')})`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true required for full run (refusing to write to DB).')
    process.exit(2)
  }

  console.log('\nStep 1: Fetching acts catalogue (A–Z)...')
  const candidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal unique candidates: ${candidates.length}`)

  if (candidates.length === 0) {
    console.error('\nERROR: 0 candidates — site and Wayback both failed or page structure changed.')
    process.exit(1)
  }

  if (mode === 'dry-run') {
    const byLetter: Record<string, number> = {}
    const byDecade: Record<string, number> = {}
    let withDate = 0
    for (const r of candidates) {
      byLetter[r.letter] = (byLetter[r.letter] ?? 0) + 1
      const decade = `${Math.floor(r.year / 10) * 10}s`
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
      if (r.promulgationDate) withDate++
    }

    console.log('\nLetter distribution:')
    Object.entries(byLetter).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    console.log('\nDecade distribution:')
    Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    console.log(`\nWith parsed promulgation date: ${withDate} / ${candidates.length} (${(100 * withDate / candidates.length).toFixed(1)}%)`)

    console.log('\nSample (first 10):')
    candidates.slice(0, 10).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.actNumber} of ${r.year}] ${r.title.slice(0, 70)}`)
    )
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // Full run
  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('pak-legislation', 'Pakistan Federal Legislation', 'law', 'law')

  const rows = candidates
  console.log(`\nStep 3: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 50

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length} processed...\r`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
