/**
 * fix-broken-urls.ts — Repair broken Source URLs from url-check-results.csv
 *
 * Strategy:
 *  1. 404s → try Wayback Machine CDX API; update Source.url to archive snapshot if found
 *  2. SSL cert errors (not archive.org) → try http:// variant; if that fails, try Wayback
 *  3. Skip ECONNREFUSED 207.241.237.3 (already archive.org links, Wayback was flaky)
 *  4. Skip 403/429/TIMEOUT (not truly broken)
 *
 * Usage:
 *   npx tsx scripts/fix-broken-urls.ts [--dry-run] [--status 404]
 *
 * Output: scripts/fix-broken-urls-results.csv
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'

const prisma = new PrismaClient()

const CSV_IN  = path.join(__dirname, 'url-check-results.csv')
const CSV_OUT = path.join(__dirname, 'fix-broken-urls-results.csv')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const STATUS_FILTER = (() => {
  const idx = args.indexOf('--status')
  return idx !== -1 ? args[idx + 1] : null
})()

const CONCURRENCY  = 8   // concurrent Wayback CDX calls
const WAYBACK_DELAY = 200  // ms between Wayback calls (5/s max)

// ── CSV reader ────────────────────────────────────────────────────────────────
interface CsvRow {
  url: string
  status: string
  finalUrl: string
  domain: string
  error: string
  checkedAt: string
}

function* readCsv(file: string): Generator<CsvRow> {
  const raw = fs.readFileSync(file, 'utf8')
  const lines = raw.split('\n')
  const headers = lines[0].split(',')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // Simple CSV parse (fields may be quoted)
    const fields = parseCsvLine(line)
    if (fields.length < headers.length) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => row[h.trim()] = fields[idx] ?? '')
    yield row as unknown as CsvRow
  }
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

// ── Should we try to fix this row? ───────────────────────────────────────────
function shouldFix(row: CsvRow): boolean {
  if (STATUS_FILTER && row.status !== STATUS_FILTER) return false

  // Skip already-archive.org links that just had connection issues
  if (row.url.includes('web.archive.org') || row.url.includes('archive.org/web')) return false

  if (row.status === '404') return true

  if (row.status === 'ERROR') {
    const e = row.error
    // SSL cert issues — try http fallback or Wayback
    if (e.includes('unable to verify') || e.includes('certificate') || e.includes('SSL')) return true
    // Dead domain
    if (e.includes('ENOTFOUND')) return true
    // Skip transient/access issues
    return false
  }

  return false
}

// ── HTTP fetch helper ─────────────────────────────────────────────────────────
function fetchHead(rawUrl: string, timeoutMs = 8000): Promise<number | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(rawUrl)
      const lib = parsed.protocol === 'https:' ? https : http
      const req = lib.request(rawUrl, {
        method: 'HEAD',
        timeout: timeoutMs,
        rejectUnauthorized: false, // allow self-signed certs
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ER-link-fixer/1.0)' },
      }, res => {
        resolve(res.statusCode ?? null)
      })
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
      req.end()
    } catch {
      resolve(null)
    }
  })
}

// ── Wayback Machine CDX API ───────────────────────────────────────────────────
interface WaybackResult {
  found: boolean
  archiveUrl?: string
  timestamp?: string
}

async function waybackLookup(url: string): Promise<WaybackResult> {
  return new Promise(resolve => {
    const encoded = encodeURIComponent(url)
    const cdxUrl = `https://archive.org/wayback/available?url=${encoded}`
    const req = https.get(cdxUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ER-link-fixer/1.0)' },
    }, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          const snap = json?.archived_snapshots?.closest
          if (snap?.available && snap.status === '200' && snap.url) {
            resolve({ found: true, archiveUrl: snap.url, timestamp: snap.timestamp })
          } else {
            resolve({ found: false })
          }
        } catch {
          resolve({ found: false })
        }
      })
    })
    req.on('error', () => resolve({ found: false }))
    req.on('timeout', () => { req.destroy(); resolve({ found: false }) })
  })
}

// ── Concurrency pool ─────────────────────────────────────────────────────────
async function pool<T>(items: T[], fn: (item: T) => Promise<void>, concurrency: number) {
  const queue = [...items]
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!
      await fn(item)
    }
  })
  await Promise.all(workers)
}

// ── CSV output ────────────────────────────────────────────────────────────────
function csvEsc(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  if (STATUS_FILTER) console.log(`Status filter: ${STATUS_FILTER}`)

  // 1. Read broken URLs from CSV
  console.log('Reading CSV...')
  const toFix: CsvRow[] = []
  for (const row of readCsv(CSV_IN)) {
    if (shouldFix(row)) toFix.push(row)
  }
  console.log(`  ${toFix.length} URLs to attempt fixing`)

  // 2. Build URL → Source ID map from DB
  console.log('Loading Source URLs from DB...')
  const sourcesByUrl = new Map<string, string[]>() // url → [id, ...]
  let offset = 0
  const BATCH = 10000
  while (true) {
    const rows = await prisma.source.findMany({
      where: { url: { not: null }, deleted: false },
      select: { id: true, url: true },
      skip: offset, take: BATCH,
    })
    if (rows.length === 0) break
    for (const r of rows) {
      if (!r.url) continue
      if (!sourcesByUrl.has(r.url)) sourcesByUrl.set(r.url, [])
      sourcesByUrl.get(r.url)!.push(r.id)
    }
    offset += rows.length
    if (rows.length < BATCH) break
  }
  console.log(`  ${sourcesByUrl.size} distinct URLs in Source table`)

  // Filter to only URLs that actually exist in DB
  const actionable = toFix.filter(r => sourcesByUrl.has(r.url))
  console.log(`  ${actionable.length} match Source records in DB`)

  // 3. Open results CSV
  const outStream = fs.createWriteStream(CSV_OUT)
  outStream.write('original_url,action,new_url,source_ids,note\n')

  let updated = 0, notFound = 0, httpFallback = 0, skipped = 0
  let processed = 0

  function logResult(row: CsvRow, action: string, newUrl: string, note: string) {
    const ids = sourcesByUrl.get(row.url) ?? []
    outStream.write([
      csvEsc(row.url),
      csvEsc(action),
      csvEsc(newUrl),
      csvEsc(ids.join('|')),
      csvEsc(note),
    ].join(',') + '\n')
  }

  // 4. Process each URL
  await pool(actionable, async (row) => {
    processed++
    if (processed % 100 === 0) {
      process.stdout.write(`\r  [${processed}/${actionable.length}] updated=${updated} wayback-miss=${notFound} http-ok=${httpFallback}   `)
    }

    const ids = sourcesByUrl.get(row.url) ?? []

    // --- Strategy 1: For SSL errors, try http:// fallback ---
    const errText = row.error ?? ''
    if (row.status === 'ERROR' && (errText.includes('certificate') || errText.includes('unable to verify'))) {
      const httpVariant = row.url.replace(/^https:\/\//, 'http://')
      if (httpVariant !== row.url) {
        const code = await fetchHead(httpVariant)
        if (code === 200 || code === 301 || code === 302) {
          logResult(row, 'http_fallback', httpVariant, `HTTP fallback works (${code})`)
          if (!DRY_RUN) {
            await prisma.source.updateMany({ where: { url: row.url }, data: { url: httpVariant } })
          }
          httpFallback++
          return
        }
      }
    }

    // --- Strategy 2: Wayback Machine CDX lookup ---
    await new Promise(r => setTimeout(r, WAYBACK_DELAY)) // rate limit
    const wb = await waybackLookup(row.url)
    if (wb.found && wb.archiveUrl) {
      logResult(row, 'wayback', wb.archiveUrl, `snapshot ${wb.timestamp}`)
      if (!DRY_RUN) {
        await prisma.source.updateMany({ where: { url: row.url }, data: { url: wb.archiveUrl } })
      }
      updated++
      return
    }

    // --- No fix found ---
    logResult(row, 'no_fix', row.url, `${row.status}: ${row.error ?? ''}`)
    notFound++
  }, CONCURRENCY)

  outStream.end()

  console.log(`\n\nDone.`)
  console.log(`  Updated via http fallback: ${httpFallback}`)
  console.log(`  Updated via Wayback:       ${updated}`)
  console.log(`  No fix found:              ${notFound}`)
  console.log(`  Skipped (not in DB):       ${toFix.length - actionable.length}`)
  console.log(`  Results: ${CSV_OUT}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
