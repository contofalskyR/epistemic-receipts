/**
 * verify-citation-content.ts
 *
 * Checks that source URLs actually point to papers relevant to the claims
 * they support. Fetches real paper titles from external APIs and computes
 * word-overlap similarity against the claim text.
 *
 * Phase 1: PubMed (eutils batch API — fast, ~10 API calls for all 1,952 PMIDs)
 * Phase 2: DOI via CrossRef API (~360K, rate-limited to 30/s, ~3h)
 *
 * Usage:
 *   npx tsx scripts/verify-citation-content.ts [--phase 1|2] [--dry-run]
 *
 * Output: scripts/citation-mismatches.csv
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'

const prisma = new PrismaClient()
const OUT_CSV = path.join(__dirname, 'citation-mismatches.csv')
const LOG     = path.join(__dirname, 'verify-citation.log')

const args         = process.argv.slice(2)
const DRY_RUN      = args.includes('--dry-run')
const PHASE        = (() => { const i = args.indexOf('--phase'); return i !== -1 ? parseInt(args[i+1]) : 0 })()
const START_OFFSET = (() => { const i = args.indexOf('--start-offset'); return i !== -1 ? parseInt(args[i+1]) : 0 })()

const log = fs.createWriteStream(LOG, { flags: 'a' })
function say(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  log.write(line + '\n')
}

// ── Word-overlap similarity ───────────────────────────────────────────────────
const STOPWORDS = new Set(['a','an','the','and','or','of','in','to','for','on','at','by',
  'with','from','this','that','are','is','was','were','be','been','has','have','had',
  'it','its','as','not','but','also','can','may','after','before','between','during',
  'each','which','who','than','about','study','studies','effect','effects','role',
  'associated','association','related','relationship','analysis','systematic','review',
  'meta','clinical','trial','randomized','controlled','results','patients','human'])

function keywords(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOPWORDS.has(w))
  )
}

function overlap(a: string, b: string): number {
  const ka = keywords(a)
  const kb = keywords(b)
  if (ka.size === 0 || kb.size === 0) return 0
  let shared = 0
  for (const w of ka) if (kb.has(w)) shared++
  return shared / Math.min(ka.size, kb.size)
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function getJson(url: string, timeoutMs = 15000): Promise<any> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url)
      const lib = parsed.protocol === 'https:' ? https : http
      const req = lib.get(url, {
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'ER-citation-verifier/1.0 (mailto:robert@example.com)',
          'Accept': 'application/json',
        },
      }, res => {
        let body = ''
        res.on('data', d => body += d)
        res.on('end', () => {
          try { resolve(JSON.parse(body)) } catch { resolve(null) }
        })
      })
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    } catch { resolve(null) }
  })
}

// ── CSV output ────────────────────────────────────────────────────────────────
function csvEsc(v: string): string {
  const s = String(v ?? '')
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s
}

let csvStream: fs.WriteStream
function writeMismatch(
  sourceId: string, url: string, fetchedTitle: string,
  claimId: string, claimText: string, score: number, note: string
) {
  csvStream.write([
    csvEsc(sourceId), csvEsc(url), csvEsc(fetchedTitle),
    csvEsc(claimId), csvEsc(claimText.slice(0, 200)),
    csvEsc(score.toFixed(2)), csvEsc(note),
  ].join(',') + '\n')
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
async function pool<T>(items: T[], fn: (item: T, i: number) => Promise<void>, concurrency: number) {
  let qi = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (qi < items.length) {
      const idx = qi++
      await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
}

// ── Phase 1: PubMed ───────────────────────────────────────────────────────────
async function phase1() {
  say('\n=== Phase 1: PubMed verification ===')

  // Load PubMed sources + their linked claims
  say('Loading PubMed sources from DB...')
  const sources = await prisma.source.findMany({
    where: { url: { contains: 'pubmed.ncbi.nlm.nih.gov', not: null }, deleted: false },
    select: {
      id: true, url: true,
      edges: {
        where: { deleted: false },
        select: { claim: { select: { id: true, text: true } } },
      },
    },
  })
  say(`  ${sources.length} PubMed sources`)

  // Extract PMIDs
  const pmidMap = new Map<string, typeof sources[0]>() // pmid → source
  for (const s of sources) {
    const m = s.url?.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)
    if (m) pmidMap.set(m[1], s)
  }
  const pmids = [...pmidMap.keys()]
  say(`  ${pmids.length} valid PMIDs`)

  // Batch-fetch titles from eutils (200 per request)
  say('Fetching titles from PubMed eutils...')
  const titleMap = new Map<string, string>() // pmid → title
  const BATCH = 200
  let fetched = 0
  for (let i = 0; i < pmids.length; i += BATCH) {
    const chunk = pmids.slice(i, i + BATCH)
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${chunk.join(',')}&retmode=json`
    const json = await getJson(url)
    if (json?.result) {
      for (const pmid of chunk) {
        const rec = json.result[pmid]
        if (rec?.title) {
          titleMap.set(pmid, rec.title as string)
          fetched++
        }
      }
    }
    await new Promise(r => setTimeout(r, 340)) // NCBI rate limit: 3/s without API key
    process.stdout.write(`\r  Fetched ${fetched}/${pmids.length}   `)
  }
  process.stdout.write('\n')
  say(`  Got titles for ${fetched} PMIDs`)

  // Compare titles to claim text
  say('Comparing titles to claim text...')
  let mismatches = 0, checked = 0

  for (const [pmid, source] of pmidMap) {
    const title = titleMap.get(pmid)
    if (!title) continue

    for (const edge of source.edges) {
      const claim = edge.claim
      const score = overlap(title, claim.text)
      checked++

      if (score < 0.15) {
        // Low overlap — potential mismatch
        writeMismatch(
          source.id, source.url ?? '', title,
          claim.id, claim.text, score,
          `PubMed PMID ${pmid}: title has low overlap with claim`
        )
        mismatches++
      }
    }
  }

  say(`  Checked ${checked} source→claim pairs`)
  say(`  Potential mismatches (overlap < 0.15): ${mismatches}`)
}

// ── Phase 2: DOI via CrossRef ─────────────────────────────────────────────────
async function phase2() {
  say('\n=== Phase 2: DOI verification via CrossRef ===')

  say('Loading DOI sources from DB (streaming in batches)...')
  let offset = 0
  const BATCH = 5000
  let total = 0, checked = 0, mismatches = 0
  let batchNum = 0

  while (true) {
    const sources = await prisma.source.findMany({
      where: {
        OR: [
          { url: { startsWith: 'https://doi.org/', not: null } },
          { url: { startsWith: 'http://doi.org/', not: null } },
        ],
        deleted: false,
      },
      select: {
        id: true, url: true,
        edges: {
          where: { deleted: false },
          select: { claim: { select: { id: true, text: true } } },
        },
      },
      skip: offset,
      take: BATCH,
    })
    if (sources.length === 0) break
    offset += sources.length
    total += sources.length
    batchNum++
    say(`  Batch ${batchNum}: ${sources.length} DOI sources (total so far: ${total})`)

    await pool(sources, async (source, idx) => {
      if (idx % 200 === 0) {
        process.stdout.write(`\r  [batch ${batchNum}] ${idx}/${sources.length} checked=${checked} mismatches=${mismatches}   `)
      }

      const rawDoi = source.url?.replace(/^https?:\/\/doi\.org\//, '')
      if (!rawDoi) return

      // CrossRef API
      const crUrl = `https://api.crossref.org/works/${encodeURIComponent(rawDoi)}?mailto=robert.contofalsky@rutgers.edu`
      await new Promise(r => setTimeout(r, 34)) // ~30/s rate limit
      const json = await getJson(crUrl, 12000)
      const titleArr = json?.message?.title
      if (!Array.isArray(titleArr) || titleArr.length === 0) return

      const title = String(titleArr[0])

      for (const edge of source.edges) {
        const claim = edge.claim
        const score = overlap(title, claim.text)
        checked++

        if (score < 0.12) {
          writeMismatch(
            source.id, source.url ?? '', title,
            claim.id, claim.text, score,
            `DOI ${rawDoi}: title has low overlap with claim`
          )
          mismatches++
        }
      }
    }, 30) // 30 concurrent CrossRef requests

    process.stdout.write('\n')

    if (sources.length < BATCH) break
  }

  say(`  Total DOI sources checked: ${total}`)
  say(`  Source→claim pairs checked: ${checked}`)
  say(`  Potential mismatches (overlap < 0.12): ${mismatches}`)
}

// ── Phase 3: All other URLs (scrape <title> tag) ─────────────────────────────
function fetchTitle(rawUrl: string, timeoutMs = 10000): Promise<string | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(rawUrl)
      const lib = parsed.protocol === 'https:' ? https : http
      const req = lib.get(rawUrl, {
        timeout: timeoutMs,
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ER-citation-verifier/1.0)',
          'Accept': 'text/html',
          'Accept-Language': 'en',
        },
      }, res => {
        // Follow one redirect manually if needed
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          req.destroy()
          resolve(fetchTitle(res.headers.location, timeoutMs))
          return
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 400) {
          req.destroy()
          resolve(null)
          return
        }
        let body = ''
        let done = false
        res.on('data', (chunk: Buffer) => {
          if (done) return
          body += chunk.toString('utf8', 0, Math.min(chunk.length, 8192))
          // Stop reading once we have the <head> section
          if (body.length > 32768 || body.toLowerCase().includes('</head>')) {
            done = true
            req.destroy()
            const m = body.match(/<title[^>]*>([^<]{1,300})<\/title>/i)
            resolve(m ? m[1].trim() : null)
          }
        })
        res.on('end', () => {
          if (!done) {
            const m = body.match(/<title[^>]*>([^<]{1,300})<\/title>/i)
            resolve(m ? m[1].trim() : null)
          }
        })
      })
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    } catch { resolve(null) }
  })
}

async function phase3() {
  say('\n=== Phase 3: All other URLs (scrape <title> tag) ===')

  // Domains already covered by phase 1 & 2
  const SKIP_PATTERNS = [
    'pubmed.ncbi.nlm.nih.gov',
    'ncbi.nlm.nih.gov/pmc',
    'doi.org/',
    'web.archive.org',
  ]

  let offset = START_OFFSET
  const BATCH = 2000
  let total = 0, fetched = 0, checked = 0, mismatches = 0, batchNum = 0
  if (START_OFFSET > 0) say(`  Resuming from offset ${START_OFFSET}`)

  while (true) {
    const sources = await prisma.source.findMany({
      where: {
        url: { not: null },
        deleted: false,
        AND: SKIP_PATTERNS.map(p => ({ url: { not: { contains: p } } })),
      },
      select: {
        id: true, url: true,
        edges: {
          where: { deleted: false },
          select: { claim: { select: { id: true, text: true } } },
        },
      },
      orderBy: { id: 'asc' },
      skip: offset,
      take: BATCH,
    })
    if (sources.length === 0) break
    offset += sources.length
    total += sources.length
    batchNum++

    // Only check sources that have at least one linked claim
    const actionable = sources.filter(s => s.edges.length > 0)
    say(`  Batch ${batchNum}: ${sources.length} sources, ${actionable.length} with claims (total: ${total})`)

    await pool(actionable, async (source, idx) => {
      if (idx % 100 === 0) {
        process.stdout.write(`\r  [batch ${batchNum}] ${idx}/${actionable.length} fetched=${fetched} mismatches=${mismatches}   `)
      }

      const title = await fetchTitle(source.url!, 8000)
      if (!title) return
      fetched++

      // Decode HTML entities in title
      const cleanTitle = title
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')

      for (const edge of source.edges) {
        const claim = edge.claim
        const score = overlap(cleanTitle, claim.text)
        checked++

        if (score < 0.10) {
          writeMismatch(
            source.id, source.url!, cleanTitle,
            claim.id, claim.text, score,
            `page title has low overlap with claim`
          )
          mismatches++
        }
      }
    }, 50) // 50 concurrent page fetches

    process.stdout.write('\n')
    if (sources.length < BATCH) break
  }

  say(`  Total sources processed: ${total}`)
  say(`  Titles fetched: ${fetched}`)
  say(`  Source→claim pairs checked: ${checked}`)
  say(`  Potential mismatches (overlap < 0.10): ${mismatches}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  say(`=== verify-citation-content.ts  mode=${DRY_RUN ? 'DRY RUN' : 'LIVE'}  phase=${PHASE || 'all'} ===`)

  csvStream = fs.createWriteStream(OUT_CSV, { flags: 'a' }) // append so phases can run separately
  if (!fs.existsSync(OUT_CSV) || fs.statSync(OUT_CSV).size === 0) {
    csvStream.write('source_id,url,fetched_title,claim_id,claim_text,overlap_score,note\n')
  }

  if (PHASE === 0 || PHASE === 1) await phase1()
  if (PHASE === 0 || PHASE === 2) await phase2()
  if (PHASE === 0 || PHASE === 3) await phase3()

  csvStream.end()
  say(`\n=== DONE. Mismatches written to ${OUT_CSV} ===`)
  await prisma.$disconnect()
  log.end()
}

main().catch(e => { console.error(e); process.exit(1) })
