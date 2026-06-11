/**
 * Source URL health checker — full 100% crawl.
 *
 * Queries every distinct HTTP/HTTPS URL from the Source table and HEAD-checks it.
 * Writes results incrementally to scripts/url-check-results.csv so runs are resumable.
 *
 * Usage:
 *   npx tsx scripts/check-source-urls.ts
 *   npx tsx scripts/check-source-urls.ts --resume       # skip already-checked URLs
 *   npx tsx scripts/check-source-urls.ts --domain doi.org  # one domain only
 *   npx tsx scripts/check-source-urls.ts --broken-only # print broken summary at end
 *
 * Output CSV columns: url, status, finalUrl, domain, error, checkedAt
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'

const prisma = new PrismaClient()

const RESULTS_FILE = path.join(__dirname, 'url-check-results.csv')
const CONCURRENCY = 80          // global concurrent requests
const PER_DOMAIN_CONCURRENCY = 80 // effectively no per-domain cap; rely on global cap
const TIMEOUT_MS = 10000        // 10s per request
const BATCH_SIZE = 5000         // rows fetched from DB at a time
const WRITE_BUFFER_SIZE = 100   // flush CSV every N results
const MAX_REDIRECTS = 5

const args = process.argv.slice(2)
const RESUME = args.includes('--resume')
const BROKEN_ONLY = args.includes('--broken-only')
const DOMAIN_FILTER = (() => {
  const idx = args.indexOf('--domain')
  return idx !== -1 ? args[idx + 1] : null
})()

// ── Known-static domains: skip redirect chase, treat 200/301/302 as OK ──────
const TRUSTED_REDIRECT_DOMAINS = new Set([
  'doi.org',
  'dx.doi.org',
])

// ── Pattern checks applied BEFORE HTTP (fast, zero requests) ─────────────────
function staticFlag(url: string): { broken: boolean; reason: string } | null {
  if (/clinicaltrials\.gov\/ct2\/show\//i.test(url)) {
    return { broken: true, reason: 'old ClinicalTrials URL pattern (/ct2/show/ → /study/)' }
  }
  return null
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function csvEscape(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function csvRow(r: CheckResult): string {
  return [r.url, r.status, r.finalUrl, r.domain, r.error, r.checkedAt]
    .map(csvEscape)
    .join(',')
}

interface CheckResult {
  url: string
  status: number | string   // HTTP status or 'STATIC_FLAG' | 'TIMEOUT' | 'ERROR' | 'SKIP'
  finalUrl: string
  domain: string
  error: string
  checkedAt: string
}

// ── Load already-checked URLs from prior run ─────────────────────────────────
function loadChecked(): Set<string> {
  const seen = new Set<string>()
  if (!fs.existsSync(RESULTS_FILE)) return seen
  const lines = fs.readFileSync(RESULTS_FILE, 'utf8').split('\n')
  for (const line of lines.slice(1)) { // skip header
    if (!line.trim()) continue
    const url = line.split(',')[0].replace(/^"|"$/g, '')
    if (url) seen.add(url)
  }
  console.log(`  Resuming: ${seen.size.toLocaleString()} already checked`)
  return seen
}

// ── HTTP HEAD with redirect following ────────────────────────────────────────
function headRequest(
  url: string,
  redirectsLeft = MAX_REDIRECTS
): Promise<{ status: number; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return reject(new Error('invalid URL'))
    }

    const mod = parsed.protocol === 'https:' ? https : http
    const timer = setTimeout(() => {
      req.destroy()
      reject(new Error('TIMEOUT'))
    }, TIMEOUT_MS)

    const req = mod.request(
      {
        method: 'HEAD',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 EpistemicReceiptsBot/1.0 (+https://epistemic-receipts.vercel.app)',
          'Accept': '*/*',
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        clearTimeout(timer)
        const status = res.statusCode ?? 0
        res.resume() // drain

        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          if (redirectsLeft <= 0) {
            return resolve({ status, finalUrl: res.headers.location })
          }
          let next = res.headers.location
          if (next.startsWith('/')) {
            next = `${parsed.protocol}//${parsed.host}${next}`
          }
          resolve(headRequest(next, redirectsLeft - 1))
        } else {
          resolve({ status, finalUrl: url })
        }
      }
    )

    req.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    req.on('timeout', () => {
      clearTimeout(timer)
      req.destroy()
      reject(new Error('TIMEOUT'))
    })
    req.end()
  })
}

// ── Check a single URL ────────────────────────────────────────────────────────
async function checkUrl(url: string): Promise<CheckResult> {
  const checkedAt = new Date().toISOString()
  let domain = ''
  try { domain = new URL(url).hostname } catch { /* ignore */ }

  // 1. Static pattern check (no HTTP needed)
  const flag = staticFlag(url)
  if (flag) {
    return { url, status: 'STATIC_FLAG', finalUrl: url, domain, error: flag.reason, checkedAt }
  }

  // 2. Trusted redirect domains — just verify reachability
  const isTrusted = TRUSTED_REDIRECT_DOMAINS.has(domain)

  try {
    const { status, finalUrl } = await headRequest(url)

    // For trusted domains, 3xx is fine (they always redirect to publisher)
    if (isTrusted && (status >= 200 && status < 500)) {
      return { url, status, finalUrl, domain, error: '', checkedAt }
    }

    let error = ''
    if (status === 404) error = '404 Not Found'
    else if (status === 410) error = '410 Gone'
    else if (status >= 400) error = `HTTP ${status}`
    else if (finalUrl !== url) {
      // Check if redirect left the expected domain
      try {
        const origHost = new URL(url).hostname.replace(/^www\./, '')
        const finalHost = new URL(finalUrl).hostname.replace(/^www\./, '')
        if (origHost !== finalHost && !isTrusted) {
          error = `Redirect to different domain: ${finalHost}`
        }
      } catch { /* ignore */ }
    }

    return { url, status, finalUrl, domain, error, checkedAt }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR'
    return { url, status, finalUrl: url, domain, error: msg, checkedAt }
  }
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
class Pool {
  private running = 0
  private domainRunning = new Map<string, number>()
  private queue: Array<() => void> = []

  constructor(private maxGlobal: number, private maxPerDomain: number) {}

  async run<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    await this.acquire(domain)
    try {
      return await fn()
    } finally {
      this.release(domain)
    }
  }

  private acquire(domain: string): Promise<void> {
    return new Promise((resolve) => {
      const attempt = () => {
        const domCount = this.domainRunning.get(domain) ?? 0
        if (this.running < this.maxGlobal && domCount < this.maxPerDomain) {
          this.running++
          this.domainRunning.set(domain, domCount + 1)
          resolve()
        } else {
          this.queue.push(attempt)
        }
      }
      attempt()
    })
  }

  private release(domain: string) {
    this.running--
    const domCount = this.domainRunning.get(domain) ?? 1
    this.domainRunning.set(domain, domCount - 1)
    // Drain queue
    const next = this.queue.shift()
    if (next) next()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Source URL Health Check ===')
  console.log(`  Concurrency: ${CONCURRENCY} global / ${PER_DOMAIN_CONCURRENCY} per domain`)
  console.log(`  Timeout: ${TIMEOUT_MS}ms`)
  if (DOMAIN_FILTER) console.log(`  Domain filter: ${DOMAIN_FILTER}`)
  if (RESUME) console.log('  Mode: RESUME (skipping already-checked)')
  console.log()

  // Load resume set
  const checked = RESUME ? loadChecked() : new Set<string>()

  // Init CSV file
  const isNew = !fs.existsSync(RESULTS_FILE) || !RESUME
  const csvStream = fs.createWriteStream(RESULTS_FILE, { flags: isNew ? 'w' : 'a' })
  if (isNew) {
    csvStream.write('url,status,finalUrl,domain,error,checkedAt\n')
  }

  // Count total
  console.log('Counting URLs in Source table...')
  const whereClause = DOMAIN_FILTER
    ? { url: { contains: DOMAIN_FILTER } }
    : {}
  const total = await prisma.source.count({
    where: { url: { startsWith: 'http' }, ...whereClause },
  })
  console.log(`  Total URLs to process: ${total.toLocaleString()}`)
  console.log()

  const pool = new Pool(CONCURRENCY, PER_DOMAIN_CONCURRENCY)
  let processed = 0
  let broken = 0
  let skipped = 0
  const writeBuffer: string[] = []
  let cursor: number | undefined

  function flush() {
    if (writeBuffer.length > 0) {
      csvStream.write(writeBuffer.join('\n') + '\n')
      writeBuffer.length = 0
    }
  }

  const startTime = Date.now()
  function printProgress() {
    const elapsed = (Date.now() - startTime) / 1000
    const rate = processed / elapsed
    const remaining = total - processed - skipped
    const eta = rate > 0 ? Math.round(remaining / rate) : 0
    const etaStr = eta > 3600
      ? `${Math.floor(eta / 3600)}h ${Math.floor((eta % 3600) / 60)}m`
      : eta > 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`
    process.stdout.write(
      `\r  [${(processed + skipped).toLocaleString()}/${total.toLocaleString()}] ` +
      `checked=${processed.toLocaleString()} broken=${broken} skipped=${skipped} ` +
      `rate=${rate.toFixed(0)}/s ETA=${etaStr}   `
    )
  }

  const progressInterval = setInterval(printProgress, 2000)

  // Page through all Sources
  let hasMore = true
  while (hasMore) {
    const batch = await prisma.source.findMany({
      where: {
        url: { startsWith: 'http', ...(DOMAIN_FILTER ? { contains: DOMAIN_FILTER } : {}) },
        ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, url: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    })

    if (batch.length === 0) { hasMore = false; break }
    cursor = batch[batch.length - 1].id

    // Deduplicate within batch
    const seen = new Set<string>()
    const urls: string[] = []
    for (const row of batch) {
      if (!seen.has(row.url)) {
        seen.add(row.url)
        urls.push(row.url)
      }
    }

    // Launch checks concurrently
    const promises = urls.map((url) => {
      if (checked.has(url)) {
        skipped++
        return Promise.resolve()
      }

      let domain = ''
      try { domain = new URL(url).hostname } catch { /* ignore */ }

      return pool.run(domain, () => checkUrl(url)).then((result) => {
        processed++
        if (result.error || result.status === 404 || result.status === 'STATIC_FLAG' || result.status === 'TIMEOUT' || result.status === 'ERROR') {
          if (result.error || result.status !== 200) broken++
        }
        writeBuffer.push(csvRow(result))
        if (writeBuffer.length >= WRITE_BUFFER_SIZE) flush()
      })
    })

    await Promise.all(promises)

    if (batch.length < BATCH_SIZE) hasMore = false
  }

  clearInterval(progressInterval)
  flush()
  csvStream.end()

  console.log('\n')
  console.log('=== Done ===')
  console.log(`  Checked:  ${processed.toLocaleString()}`)
  console.log(`  Skipped:  ${skipped.toLocaleString()}`)
  console.log(`  Broken:   ${broken.toLocaleString()}`)
  console.log(`  Results:  ${RESULTS_FILE}`)

  if (BROKEN_ONLY || broken > 0) {
    console.log('\n=== Broken URLs Summary ===')
    const lines = fs.readFileSync(RESULTS_FILE, 'utf8').split('\n').slice(1)
    const brokenRows = lines.filter((l) => {
      if (!l.trim()) return false
      const cols = l.split(',')
      const status = cols[1]?.replace(/^"|"$/g, '')
      const error = cols[4]?.replace(/^"|"$/g, '')
      return (
        status === 'STATIC_FLAG' ||
        status === 'TIMEOUT' ||
        status === 'ERROR' ||
        (error && error.length > 0) ||
        (Number(status) >= 400)
      )
    })

    // Group by domain + reason
    const byDomain: Record<string, { count: number; example: string; reason: string }> = {}
    for (const row of brokenRows) {
      const cols = row.split(',')
      const url = cols[0]?.replace(/^"|"$/g, '') ?? ''
      const status = cols[1]?.replace(/^"|"$/g, '') ?? ''
      const domain = cols[3]?.replace(/^"|"$/g, '') ?? ''
      const error = cols[4]?.replace(/^"|"$/g, '') ?? ''
      const key = `${domain}||${status}||${error.slice(0, 60)}`
      if (!byDomain[key]) byDomain[key] = { count: 0, example: url, reason: `${status}: ${error}` }
      byDomain[key].count++
    }

    const sorted = Object.entries(byDomain).sort((a, b) => b[1].count - a[1].count)
    for (const [, v] of sorted.slice(0, 50)) {
      console.log(`  ${v.count.toString().padStart(6)} × ${v.reason}`)
      console.log(`           e.g. ${v.example}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
