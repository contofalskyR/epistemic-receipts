// Pipeline 102 — Caribbean Legislation (caribbean_v1)
// Dataset: Legislation portals for Caribbean Commonwealth nations.
//
// Country coverage & strategy:
//   Bahamas  — laws.bahamas.gov.bs  — DIRECT scrape of alphabetical acts index (Joomla CMS,
//                                      server-rendered, no JS required). PDF links encode year.
//   Belize   — belizelaw.org        — CDX enumerate + Wayback fetch (site suspended as of probe).
//   Barbados — lawsofbarbados.gov.bb — BLOCKED: DNS resolution failure. Skipped.
//   Guyana   — legalaffairs.gov.gy  — BLOCKED: DNS resolution failure. Skipped.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-caribbean.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-caribbean.ts --sample 10
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-caribbean.ts --full [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'caribbean_v1'
const PIPELINE = 'Pipeline 102'
const CDX_API = 'http://web.archive.org/cdx/search/cdx'
const WAYBACK = 'https://web.archive.org/web'
const REQUEST_DELAY_MS = 800
const CDX_DELAY_MS = 500
const BATCH_SIZE = 50
const BAHAMAS_ALPHA_URL = 'https://laws.bahamas.gov.bs/cms/legislation/acts_only/by-alphabetical-order.html'
const BAHAMAS_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type Counts = { ingested: number; skipped: number; errors: number }
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

interface ActRecord {
  countryCode: string
  countryName: string
  slug: string
  title: string
  year: number | null
  sourceUrl: string
  timestamp?: string
  originalUrl?: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--verbose]')
        process.exit(1) as never
      })()
  const sai = args.indexOf('--sample')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpPost(urlStr: string, body: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const buf = Buffer.from(body, 'utf8')
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'text/html,*/*',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': buf.byteLength,
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${urlStr}`)) })
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

function httpGet(urlStr: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const lib = parsed.protocol === 'https:' ? https : http
    const req = (lib as typeof https).request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: parsed.protocol === 'https:' ? 443 : 80,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'text/html,*/*',
          'Accept-Language': 'en',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpGet(new URL(res.headers.location, urlStr).toString(), timeoutMs).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }
          resolve(Buffer.concat(chunks).toString('utf8'))
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${urlStr}`) ) })
    req.on('error', reject)
    req.end()
  })
}

// ── Bahamas: direct scrape of alphabetical listing ──────────────────────────
// Each act appears as:
//   <a class="npWrap" href="/cms/images/LEGISLATION/PRINCIPAL/{year}/{year-actno}/{...}.pdf">Act Title</a>
// The PDF path encodes year. We only ingest PRINCIPAL acts (skip SUBORDINATE / AMENDING).
function parseBahamasAlpha(html: string): ActRecord[] {
  const records: ActRecord[] = []
  const seen = new Set<string>()
  // Match principal act links: href encodes PRINCIPAL/{year}/{year-actno}/...pdf
  // The anchor text may contain &nbsp; and <i> tags — extract text up to first HTML tag
  const re = /<a\s[^>]*class="npWrap"[^>]*href="(\/cms\/images\/LEGISLATION\/PRINCIPAL\/(\d{4})\/(\d{4}-\d{4})\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const pdfPath = m[1]!
    const year = parseInt(m[2]!, 10)
    const actNo = m[3]!          // e.g. "2023-0038"
    // Strip any inner HTML tags, decode entities
    const rawTitle = m[4]!
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ').trim()
    if (!rawTitle || rawTitle.length < 3) continue

    const slug = actNo.toLowerCase()
    if (seen.has(slug)) continue
    seen.add(slug)

    records.push({
      countryCode: 'bs',
      countryName: 'Bahamas',
      slug,
      title: rawTitle,
      year: year >= 1799 && year <= 2030 ? year : null,
      sourceUrl: `https://laws.bahamas.gov.bs${pdfPath}`,
    })
  }
  return records
}

// ── Belize: CDX enumeration ─────────────────────────────────────────────────
// belizelaw.org is suspended; use Wayback CDX to enumerate act pages.
async function getBelizeSlugs(): Promise<Array<{ slug: string; timestamp: string; originalUrl: string }>> {
  const url = `${CDX_API}?url=www.belizelaw.org/web/lawadmin/PDF_legislation/*&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=2000`
  let body: string
  try { body = await httpGet(url, 60000) }
  catch (err) { console.error(`  CDX error for Belize: ${(err as Error).message}`); return [] }

  let data: string[][]
  try { data = JSON.parse(body) as string[][] }
  catch { console.error(`  CDX parse error for Belize`); return [] }

  const seen = new Set<string>()
  const results: Array<{ slug: string; timestamp: string; originalUrl: string }> = []

  for (const row of data.slice(1)) {
    const [originalUrl, timestamp] = row
    if (!originalUrl || !timestamp) continue
    // belizelaw.org PDF paths: /web/lawadmin/PDF_legislation/{CAP-XX}.pdf
    const m = /PDF_legislation\/([A-Z0-9_-]+)\.pdf$/i.exec(originalUrl)
    if (!m) continue
    const slug = m[1]!.toLowerCase()
    if (seen.has(slug)) continue
    seen.add(slug)
    results.push({ slug, timestamp, originalUrl })
  }
  return results
}

async function fetchBelizeTitle(slug: string, timestamp: string, originalUrl: string): Promise<{ title: string; year: number | null }> {
  // PDFs don't have extractable text easily; derive from chapter number and filename
  // e.g. CAP_1 → Chapter 1 of Laws of Belize
  const cap = slug.replace(/^cap[_-]/i, '').replace(/_/g, ' ').toUpperCase()
  const yearMatch = /(\d{4})/.exec(originalUrl)
  const year = yearMatch ? parseInt(yearMatch[1]!) : null
  return {
    title: `Chapter ${cap} of the Laws of Belize`,
    year,
  }
}

const topicCache = new Map<string, string>()
async function ensureTopic(s: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(s)) return topicCache.get(s)!
  const existing = await prisma.topic.findUnique({ where: { slug: s } })
  if (existing) { topicCache.set(s, existing.id); return existing.id }
  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
  }
  const created = await prisma.topic.create({ data: { slug: s, name, domain, parentTopicId } })
  console.log(`  Created topic: ${s}`)
  topicCache.set(s, created.id)
  return created.id
}

async function writeRow(tx: TxClient, rec: ActRecord, topicId: string): Promise<'ingested' | 'skipped' | 'failed'> {
  const externalId = `${INGESTED_BY}_${rec.countryCode}_${rec.slug}`
  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const claimEmergedAt = rec.year ? new Date(`${rec.year}-01-01T00:00:00Z`) : null

    const source = await tx.source.upsert({
      where: { externalId: `src_${externalId}` },
      update: {},
      create: {
        externalId: `src_${externalId}`,
        name: `${rec.countryName} — ${rec.title.slice(0, 120)}`,
        url: rec.sourceUrl,
        publishedAt: claimEmergedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: `${rec.countryName} enacted the ${rec.title}.`,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt,
        claimEmergedPrecision: rec.year ? 'YEAR' : undefined,
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId,
        metadata: {
          dataset: INGESTED_BY,
          countryCode: rec.countryCode,
          country: rec.countryName,
          slug: rec.slug,
          year: rec.year,
          source: rec.sourceUrl,
        },
      },
    })

    await tx.edge.create({
      data: { claimId: claim.id, sourceId: source.id, type: 'CITES', ingestedBy: INGESTED_BY, autoApproved: true },
    })
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${externalId}: ${err}`)
    return 'failed'
  }
}

async function main() {
  const { mode, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: Caribbean Legislation ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Countries: Bahamas (direct), Belize (CDX)`)
  console.log(`Blockers:`)
  console.log(`  Barbados (lawsofbarbados.gov.bb) — DNS resolution failure`)
  console.log(`  Guyana (legalaffairs.gov.gy) — DNS resolution failure\n`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  // Phase 1: Fetch Bahamas list — POST per letter to enumerate all acts
  console.log('Step 1: Fetching Bahamas acts from alphabetical index (A-Z)...')
  let bahamasRecords: ActRecord[] = []
  const seenSlugs = new Set<string>()
  for (const letter of BAHAMAS_LETTERS) {
    try {
      const postBody = `submit4=${encodeURIComponent(letter)}&pointintime_post_alpha=${encodeURIComponent(new Date().toISOString().slice(0, 10) + ' 00:00:00')}`
      const html = await httpPost(BAHAMAS_ALPHA_URL, postBody)
      const recs = parseBahamasAlpha(html)
      let newForLetter = 0
      for (const rec of recs) {
        if (!seenSlugs.has(rec.slug)) { seenSlugs.add(rec.slug); bahamasRecords.push(rec); newForLetter++ }
      }
      process.stdout.write(`  ${letter}: ${newForLetter} acts\n`)
    } catch (err) {
      console.warn(`  [${letter}] Bahamas fetch failed: ${(err as Error).message}`)
    }
    await sleep(500)
  }
  console.log(`  Bahamas total: ${bahamasRecords.length} principal acts`)
  await sleep(CDX_DELAY_MS)

  // Phase 2: CDX enumerate Belize
  console.log('Step 2: Enumerating Belize acts via Wayback CDX...')
  let belizeRecords: ActRecord[] = []
  try {
    const belizeSlugs = await getBelizeSlugs()
    console.log(`  Belize: ${belizeSlugs.length} acts from CDX`)
    for (const { slug, timestamp, originalUrl } of belizeSlugs) {
      const { title, year } = await fetchBelizeTitle(slug, timestamp, originalUrl)
      belizeRecords.push({
        countryCode: 'bz',
        countryName: 'Belize',
        slug,
        title,
        year,
        sourceUrl: `${WAYBACK}/${timestamp}/${originalUrl}`,
        timestamp,
        originalUrl,
      })
    }
  } catch (err) {
    console.error(`  Belize CDX failed: ${(err as Error).message}`)
  }

  const allRecords: ActRecord[] = [...bahamasRecords, ...belizeRecords]
  console.log(`\nTotal candidates: ${allRecords.length}`)

  if (allRecords.length === 0) {
    console.warn('WARNING: 0 candidates — both sources failed.')
  }

  if (mode === 'dry-run') {
    console.log('\nStep 3 (dry-run): Writing sample JSON...')

    const byCountry: Record<string, number> = {}
    for (const r of allRecords) byCountry[r.countryName] = (byCountry[r.countryName] ?? 0) + 1

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allRecords.length,
      countsByCountry: byCountry,
      blockers: {
        barbados: 'lawsofbarbados.gov.bb — DNS resolution failure',
        guyana: 'legalaffairs.gov.gy — DNS resolution failure',
      },
      sample: allRecords.slice(0, 15).map(r => ({
        countryCode: r.countryCode,
        country: r.countryName,
        slug: r.slug,
        title: r.title,
        year: r.year,
        sourceUrl: r.sourceUrl,
        claimText: `${r.countryName} enacted the ${r.title}.`,
        externalId: `${INGESTED_BY}_${r.countryCode}_${r.slug}`,
      })),
    }

    fs.writeFileSync('pipeline-102-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-102-dry-run-sample.json')

    console.log('\nSample (first 10):')
    allRecords.slice(0, 10).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.countryCode.toUpperCase()}] ${r.title.slice(0, 80)}${r.year ? ` (${r.year})` : ''}`)
    )
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  console.log('\nStep 3: Ensuring topics...')
  const topicIds = new Map<string, string>()
  topicIds.set('bs', await ensureTopic('bs-parliament', 'Parliament of the Bahamas', 'government', 'gov-region-americas'))
  topicIds.set('bz', await ensureTopic('bz-national-assembly', 'National Assembly of Belize', 'government', 'gov-region-americas'))

  const existingRaw = await prisma.claim.findMany({ where: { ingestedBy: INGESTED_BY }, select: { externalId: true } })
  const existingSet = new Set(existingRaw.map(c => c.externalId))
  console.log(`  ${existingSet.size} records already in DB`)

  const rows = mode === 'sample' ? allRecords.slice(0, sampleN) : allRecords
  console.log(`\nStep 4: Writing ${rows.length} rows to DB...`)

  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()
  const BATCH = BATCH_SIZE

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const rec of batch) {
          const externalId = `${INGESTED_BY}_${rec.countryCode}_${rec.slug}`
          if (existingSet.has(externalId)) { counts.skipped++; continue }
          const topicId = topicIds.get(rec.countryCode)!
          const result = await writeRow(tx, rec, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${rec.countryCode} ${rec.slug} — ${rec.title.slice(0, 80)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch ${i}-${i + batch.length} failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length} processed...\r`)
    await sleep(100)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims: ${dbClaims} | Sources: ${dbSources} | Edges: ${dbEdges}`)

  if (mode === 'sample') console.log('\nSample complete. Review then run --full.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
