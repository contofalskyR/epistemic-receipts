/**
 * fix-all-broken-urls.ts — Comprehensive broken URL repair
 *
 * Handles ALL broken categories from url-check-results.csv:
 *
 *  404         → Wayback Machine → null if not found
 *  ERROR SSL   → http:// fallback → Wayback → null
 *  ERROR ENOTFOUND/ECONNRESET/hang → Wayback → null
 *  TIMEOUT     → domain-level probe (1 per domain) → null dead domains; skip live domains
 *  503/500/504/502 → null (recurring server errors)
 *
 *  SKIP: 403, 429, 420, 418, 405, 436, 481 (bot-blocking / rate-limiting, not truly broken)
 *  SKIP: archive.org ECONNREFUSED (archive.org own links, transient)
 *
 * Usage:
 *   npx tsx scripts/fix-all-broken-urls.ts [--dry-run] [--phase 1|2|3]
 *
 *   Phase 1: Handle 404s + ERRORs (Wayback + http fallback)
 *   Phase 2: Handle TIMEOUTs (domain probe + bulk null)
 *   Phase 3: Handle 503/500/504/502 (bulk null)
 *   (default: all phases)
 *
 * Output: scripts/fix-all-results.log
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as readline from 'readline'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'

const prisma = new PrismaClient()

const CSV_IN  = path.join(__dirname, 'url-check-results.csv')
const LOG_OUT = path.join(__dirname, 'fix-all-results.log')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const PHASE = (() => {
  const idx = args.indexOf('--phase')
  return idx !== -1 ? parseInt(args[idx + 1], 10) : 0 // 0 = all
})()

const CONCURRENCY_WAYBACK  = 6    // concurrent Wayback CDX calls (rate limit: 6/s)
const CONCURRENCY_PROBE    = 30   // concurrent domain probe checks
const CONCURRENCY_ECONNRESET = 20 // concurrent null updates
const WAYBACK_DELAY        = 170  // ms between Wayback calls

const log = fs.createWriteStream(LOG_OUT, { flags: 'a' })
function say(msg: string) {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${msg}`
  console.log(line)
  log.write(line + '\n')
}

// ── CSV reader ────────────────────────────────────────────────────────────────
interface CsvRow {
  url: string
  status: string
  finalUrl: string
  domain: string
  error: string
  checkedAt: string
}

async function streamCsvRows(file: string, filter: (row: CsvRow) => boolean): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = []
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })
    let headers: string[] = []
    let lineNum = 0
    rl.on('line', (line) => {
      lineNum++
      if (lineNum === 1) {
        headers = line.split(',').map(h => h.trim())
        return
      }
      const trimmed = line.trim()
      if (!trimmed) return
      const fields = parseCsvLine(trimmed)
      if (fields.length < headers.length) return
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => row[h] = fields[idx] ?? '')
      const r = row as unknown as CsvRow
      if (filter(r)) rows.push(r)
    })
    rl.on('close', () => { say(`  ${lineNum} lines scanned, ${rows.length} matched`); resolve(rows) })
    rl.on('error', reject)
  })
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── HTTP probe ────────────────────────────────────────────────────────────────
function fetchHead(rawUrl: string, timeoutMs = 10000): Promise<number | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(rawUrl)
      const lib = parsed.protocol === 'https:' ? https : http
      const req = lib.request(rawUrl, {
        method: 'HEAD',
        timeout: timeoutMs,
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ER-link-fixer/2.0)' },
      }, res => resolve(res.statusCode ?? null))
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
      req.end()
    } catch {
      resolve(null)
    }
  })
}

// ── Wayback Machine CDX API ───────────────────────────────────────────────────
async function waybackLookup(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const encoded = encodeURIComponent(url)
    const cdxUrl = `https://archive.org/wayback/available?url=${encoded}`
    const req = https.get(cdxUrl, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ER-link-fixer/2.0)' },
    }, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          const snap = json?.archived_snapshots?.closest
          if (snap?.available && snap.status === '200' && snap.url) {
            resolve(snap.url as string)
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
async function pool<T>(items: T[], fn: (item: T, idx: number) => Promise<void>, concurrency: number) {
  const queue = items.map((item, idx) => ({ item, idx }))
  let qi = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (qi < queue.length) {
      const { item, idx } = queue[qi++]
      await fn(item, idx)
    }
  })
  await Promise.all(workers)
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function loadSourceUrlMap(): Promise<Map<string, string[]>> {
  say('Loading Source URLs from DB...')
  const map = new Map<string, string[]>()
  let offset = 0
  while (true) {
    const rows = await prisma.source.findMany({
      where: { url: { not: null }, deleted: false },
      select: { id: true, url: true },
      skip: offset, take: 10000,
    })
    if (rows.length === 0) break
    for (const r of rows) {
      if (!r.url) continue
      if (!map.has(r.url)) map.set(r.url, [])
      map.get(r.url)!.push(r.id)
    }
    offset += rows.length
    if (rows.length < 10000) break
  }
  say(`  ${map.size} distinct URLs in Source table`)
  return map
}

async function nullUrls(urls: string[], reason: string): Promise<number> {
  if (urls.length === 0) return 0
  if (DRY_RUN) {
    say(`  [DRY RUN] would null ${urls.length} URLs: ${reason}`)
    return urls.length
  }
  // Batch into chunks of 500 for updateMany
  let total = 0
  const CHUNK = 500
  for (let i = 0; i < urls.length; i += CHUNK) {
    const chunk = urls.slice(i, i + CHUNK)
    const result = await prisma.source.updateMany({
      where: { url: { in: chunk }, deleted: false },
      data: { url: null },
    })
    total += result.count
  }
  return total
}

async function updateUrl(oldUrl: string, newUrl: string): Promise<number> {
  if (DRY_RUN) return 1
  const result = await prisma.source.updateMany({
    where: { url: oldUrl, deleted: false },
    data: { url: newUrl },
  })
  return result.count
}

// ── Phase 1: 404s + ERRORs ────────────────────────────────────────────────────
async function phase1(dbMap: Map<string, string[]>) {
  say('\n=== Phase 1: 404s + ERRORs (Wayback + http fallback) ===')
  say('Streaming CSV for phase 1...')

  const candidates = await streamCsvRows(CSV_IN, r => {
    if (!dbMap.has(r.url)) return false
    if (r.url.includes('web.archive.org') || r.url.includes('207.241.237.3')) return false
    if (r.status === '404') return true
    if (r.status === 'ERROR') {
      const e = r.error ?? ''
      if (e.includes('certificate') || e.includes('unable to verify') || e.includes('SSL') || e.includes('TLS')) return true
      if (e.includes('ENOTFOUND')) return true
      if (e.includes('ECONNRESET') || e.includes('socket hang up') || e.includes('disconnected')) return true
      if (e.includes('ECONNREFUSED') && !e.includes('207.241.237.3')) return true
      if (e.includes('certificate has expired')) return true
      if (e.includes('invalid URL')) return true
    }
    return false
  })

  say(`  ${candidates.length} URLs to process`)

  let waybackOk = 0, httpOk = 0, nulled = 0, processed = 0
  const toNull: string[] = []

  await pool(candidates, async (row) => {
    processed++
    if (processed % 200 === 0) {
      process.stdout.write(`\r  [${processed}/${candidates.length}] wayback=${waybackOk} http=${httpOk} toNull=${toNull.length}   `)
    }

    const e = row.error ?? ''

    // Try http fallback for SSL errors first
    if (row.status === 'ERROR' && (e.includes('certificate') || e.includes('unable to verify') || e.includes('SSL') || e.includes('TLS') || e.includes('expired'))) {
      const httpVariant = row.url.replace(/^https:\/\//, 'http://')
      if (httpVariant !== row.url) {
        const code = await fetchHead(httpVariant, 8000)
        if (code === 200 || code === 301 || code === 302 || code === 304) {
          await updateUrl(row.url, httpVariant)
          httpOk++
          return
        }
      }
    }

    // Dead connections → null directly (no Wayback needed)
    if (row.status === 'ERROR' && (e.includes('ECONNRESET') || e.includes('socket hang up') || e.includes('disconnected'))) {
      toNull.push(row.url)
      return
    }

    // Wayback Machine fallback
    await new Promise(r => setTimeout(r, WAYBACK_DELAY))
    const archiveUrl = await waybackLookup(row.url)
    if (archiveUrl) {
      await updateUrl(row.url, archiveUrl)
      waybackOk++
      return
    }

    // No fix → null
    toNull.push(row.url)
  }, CONCURRENCY_WAYBACK)

  process.stdout.write('\n')

  // Bulk null the unfixable
  const nullCount = await nullUrls(toNull, 'phase1 no-fix')
  nulled = nullCount

  say(`  Wayback rescued: ${waybackOk}`)
  say(`  HTTP fallback:   ${httpOk}`)
  say(`  Nulled:          ${nulled}`)
}

// ── Phase 2: TIMEOUTs ─────────────────────────────────────────────────────────
async function phase2(dbMap: Map<string, string[]>) {
  say('\n=== Phase 2: TIMEOUTs (domain probe + bulk null) ===')
  say('Streaming CSV for phase 2...')

  const timeoutRows = await streamCsvRows(CSV_IN, r =>
    r.status === 'TIMEOUT' &&
    dbMap.has(r.url) &&
    !r.url.includes('web.archive.org')
  )
  say(`  ${timeoutRows.length} TIMEOUT URLs in DB`)

  // Group by domain
  const byDomain = new Map<string, CsvRow[]>()
  for (const r of timeoutRows) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, [])
    byDomain.get(r.domain)!.push(r)
  }

  say(`  ${byDomain.size} distinct domains`)

  // Probe one URL per domain
  const domains = [...byDomain.keys()]
  const deadDomains = new Set<string>()
  let probed = 0

  await pool(domains, async (domain) => {
    probed++
    if (probed % 20 === 0) {
      process.stdout.write(`\r  Probing domains [${probed}/${domains.length}] dead=${deadDomains.size}   `)
    }

    const sampleRows = byDomain.get(domain)!
    // Try up to 3 sample URLs per domain
    const samples = sampleRows.slice(0, 3)
    let anyAlive = false
    for (const sample of samples) {
      const code = await fetchHead(sample.url, 8000)
      if (code !== null && code !== 0) {
        // Got a response — domain is alive (even if 4xx/5xx from bad URL)
        anyAlive = true
        break
      }
    }
    if (!anyAlive) {
      deadDomains.add(domain)
    }
  }, CONCURRENCY_PROBE)

  process.stdout.write('\n')
  say(`  Dead domains: ${deadDomains.size} / ${domains.size}`)

  // Log dead domains for audit
  const deadList = [...deadDomains].sort()
  say(`  Dead: ${deadList.slice(0, 20).join(', ')}${deadList.length > 20 ? '...' : ''}`)

  // Collect URLs to null (only from dead domains)
  const toNull: string[] = []
  for (const domain of deadDomains) {
    for (const r of byDomain.get(domain) ?? []) {
      toNull.push(r.url)
    }
  }

  say(`  Nulling ${toNull.length} URLs from dead domains`)
  const nulled = await nullUrls(toNull, 'phase2 timeout dead-domain')
  say(`  Nulled: ${nulled}`)

  // For alive domains — these timed out during bulk crawl but domain is responsive
  // Leave them as-is (URL is still technically valid, just slow)
  const kept = timeoutRows.length - toNull.length
  say(`  Kept (domain alive, just slow): ${kept}`)
}

// ── Phase 3: 5xx + other server errors ───────────────────────────────────────
async function phase3(dbMap: Map<string, string[]>) {
  say('\n=== Phase 3: 5xx server errors (bulk null) ===')
  say('Streaming CSV for phase 3...')

  const serverErrorStatuses = new Set(['503', '500', '504', '502', '501'])
  const candidates = await streamCsvRows(CSV_IN, r =>
    serverErrorStatuses.has(r.status) &&
    dbMap.has(r.url) &&
    !r.url.includes('web.archive.org')
  )

  say(`  ${candidates.length} server-error URLs in DB`)

  // Group by domain, probe sample to see if it's a temporary or permanent issue
  const byDomain = new Map<string, CsvRow[]>()
  for (const r of candidates) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, [])
    byDomain.get(r.domain)!.push(r)
  }

  say(`  ${byDomain.size} distinct domains`)

  const deadDomains = new Set<string>()
  let probed = 0
  const domains = [...byDomain.keys()]

  await pool(domains, async (domain) => {
    probed++
    if (probed % 20 === 0) {
      process.stdout.write(`\r  Probing [${probed}/${domains.length}] dead=${deadDomains.size}   `)
    }
    const samples = byDomain.get(domain)!.slice(0, 2)
    let anyAlive = false
    for (const s of samples) {
      const code = await fetchHead(s.url, 8000)
      if (code && code < 500) { anyAlive = true; break }
    }
    if (!anyAlive) deadDomains.add(domain)
  }, CONCURRENCY_PROBE)

  process.stdout.write('\n')

  const toNull: string[] = []
  for (const domain of deadDomains) {
    for (const r of byDomain.get(domain) ?? []) toNull.push(r.url)
  }

  say(`  Nulling ${toNull.length} URLs from ${deadDomains.size} dead domains`)
  const nulled = await nullUrls(toNull, 'phase3 server-error dead-domain')
  say(`  Nulled: ${nulled}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  say(`=== fix-all-broken-urls.ts  mode=${DRY_RUN ? 'DRY RUN' : 'LIVE'}  phase=${PHASE || 'all'} ===`)

  const dbMap = await loadSourceUrlMap()

  if (PHASE === 0 || PHASE === 1) await phase1(dbMap)
  if (PHASE === 0 || PHASE === 2) await phase2(dbMap)
  if (PHASE === 0 || PHASE === 3) await phase3(dbMap)

  say('\n=== ALL PHASES COMPLETE ===')
  await prisma.$disconnect()
  log.end()
}

main().catch(e => {
  console.error(e)
  log.write(`FATAL: ${e}\n`)
  log.end()
  process.exit(1)
})
