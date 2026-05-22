// Pipeline 101 — Central America Legislation (central_america_v1)
// Dataset: Legislative portals for Central American and Caribbean nations.
//
// Country coverage & strategy:
//   Panama            — asamblea.gob.pa  — CDX enumerate + Wayback fetch (no JS API found).
//   El Salvador       — asamblea.gob.sv  — CDX enumerate /decretos/* pages + Wayback fetch.
//   Guatemala         — congreso.gob.gt  — CDX enumerate + Wayback fetch (WAF/Incapsula blocked).
//   Dominican Republic — congreso.gob.do — BLOCKED: domain parked (redirects to parking page).
//   Honduras          — congreso.gob.hn  — BLOCKED: DNS resolution failure.
//   Nicaragua         — asamblea.gob.ni  — BLOCKED: DNS resolution failure.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-central-america.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-central-america.ts --sample 10
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-central-america.ts --full [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'central_america_v1'
const PIPELINE = 'Pipeline 101'
const CDX_API = 'http://web.archive.org/cdx/search/cdx'
const WAYBACK = 'https://web.archive.org/web'
const REQUEST_DELAY_MS = 900
const CDX_DELAY_MS = 500
const BATCH_SIZE = 50

interface Country {
  code: string
  name: string
  cdxPattern: string
  slugRegex: RegExp
}

// Dominican Republic (congreso.gob.do): parked domain — skip.
// Honduras (congreso.gob.hn): DNS failure — skip.
// Nicaragua (asamblea.gob.ni): DNS failure — skip.
const COUNTRIES: Country[] = [
  {
    code: 'pa',
    name: 'Panama',
    cdxPattern: 'asamblea.gob.pa/APPS/SEG_LEGIS/*',
    slugRegex: /asamblea\.gob\.pa\/APPS\/SEG_LEGIS\/(?:PDF_SEG\/)?PDF_SEG_(\d{4})\/(?:PDF_SEG_\d{4}\/)?(\d{4}_[A-Z]_\d+)\.pdf$/i,
  },
  {
    code: 'sv',
    name: 'El Salvador',
    cdxPattern: 'www.asamblea.gob.sv/decretos/*',
    // Decree detail pages
    slugRegex: /asamblea\.gob\.sv\/decretos\/(?:detalle|busqueda-decretos)\/([^/?#]+)\/?$/i,
  },
  {
    code: 'gt',
    name: 'Guatemala',
    cdxPattern: 'www.congreso.gob.gt/*',
    slugRegex: /congreso\.gob\.gt\/(?:legislacion|decreto|expediente)\/([^/?#]+)\/?$/i,
  },
]

interface ActSlug {
  countryCode: string
  slug: string
  timestamp: string
  originalUrl: string
}

interface ActRecord extends ActSlug {
  countryName: string
  title: string
  year: number | null
}

type Counts = { ingested: number; skipped: number; errors: number }
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

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
          'Accept': 'text/html,application/json,*/*',
          'Accept-Language': 'es,en;q=0.8',
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
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${urlStr}`)) })
    req.on('error', reject)
    req.end()
  })
}

async function getCdxSlugs(country: Country): Promise<ActSlug[]> {
  const url = `${CDX_API}?url=${country.cdxPattern}&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=5000`
  let body: string
  try { body = await httpGet(url, 60000) }
  catch (err) { console.error(`  CDX error for ${country.name}: ${(err as Error).message}`); return [] }

  let data: string[][]
  try { data = JSON.parse(body) as string[][] }
  catch { console.error(`  CDX parse error for ${country.name}`); return [] }

  const seen = new Set<string>()
  const results: ActSlug[] = []

  for (const row of data.slice(1)) {
    const [originalUrl, timestamp] = row
    if (!originalUrl || !timestamp) continue

    // Panama: extract law number from PDF URL
    if (country.code === 'pa') {
      const m = /PDF_SEG_(\d{4})\/(?:\w+\/)?(\d{4}[_-][A-Za-z][_-]\d+)\.pdf$/i.exec(originalUrl)
      if (!m) continue
      const slug = m[2]!.replace(/\s/g, '').toLowerCase()
      if (seen.has(slug)) continue
      seen.add(slug)
      results.push({ countryCode: country.code, slug, timestamp, originalUrl })
      continue
    }

    const m = country.slugRegex.exec(originalUrl)
    if (!m) continue
    const slug = m[m.length - 1]!
    if (!slug || slug.length < 2 || seen.has(slug)) continue
    seen.add(slug)
    results.push({ countryCode: country.code, slug, timestamp, originalUrl })
  }
  return results
}

function extractTitle(html: string, countryCode: string): string {
  // Try og:title first
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
  if (ogTitle) return ogTitle[1]!.trim().replace(/\s+/g, ' ')

  // Try <title> tag
  const m = html.match(/<title>([^<]+)<\/title>/i)
  if (!m) return ''
  let t = m[1]!.trim().replace(/\s+/g, ' ')
  // Strip site name from title
  t = t.replace(/\s*[-|–]\s*(Asamblea|Congreso|Panama|El Salvador|Guatemala).*/i, '')
  return t
}

function extractYear(html: string): number | null {
  const body = html.slice(html.indexOf('<body') >= 0 ? html.indexOf('<body') : 0)
  const cleaned = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const matches = [...cleaned.matchAll(/\b(19[5-9]\d|20[012]\d)\b/g)]
  if (matches.length === 0) return null
  const years = matches.map(m => parseInt(m[1]!))
  const earliest = Math.min(...years)
  return earliest >= 1950 && earliest <= 2026 ? earliest : null
}

// Panama: year is in the PDF filename directly
function extractPanamaYear(slug: string): number | null {
  const m = /^(\d{4})[_-]/.exec(slug)
  if (m) return parseInt(m[1]!)
  return null
}

async function fetchActData(slug: ActSlug, country: Country): Promise<{ title: string; year: number | null }> {
  // Panama PDFs: derive title from filename (PDF parsing not feasible here)
  if (country.code === 'pa') {
    const year = extractPanamaYear(slug.slug)
    const lawNum = slug.slug.replace(/^\d{4}[_-][a-z][_-]/i, '').replace(/_/g, '/')
    const lawType = /[_-][a-z][_-]/i.exec(slug.slug)?.[0]?.replace(/[_-]/g, '').toUpperCase() ?? 'LEY'
    const typeMap: Record<string, string> = { A: 'Decreto Ejecutivo', P: 'Proyecto de Ley', L: 'Ley', D: 'Decreto' }
    const typeName = typeMap[lawType] ?? 'Decreto'
    return {
      title: `${typeName} No. ${lawNum} (${year ?? 'n.d.'})`,
      year,
    }
  }

  const waybackUrl = `${WAYBACK}/${slug.timestamp}/${slug.originalUrl}`
  let body: string
  try { body = await httpGet(waybackUrl) }
  catch { return { title: '', year: null } }
  return { title: extractTitle(body, slug.countryCode), year: extractYear(body) }
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
    const sourceUrl = `${WAYBACK}/${rec.timestamp}/${rec.originalUrl}`

    const source = await tx.source.upsert({
      where: { externalId: `src_${externalId}` },
      update: {},
      create: {
        externalId: `src_${externalId}`,
        name: `${rec.countryName} legislation — ${rec.title.slice(0, 120)}`,
        url: sourceUrl,
        publishedAt: claimEmergedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: `${rec.countryName} enacted: ${rec.title}.`,
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
          waybackUrl: sourceUrl,
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

  console.log(`\n── ${PIPELINE}: Central America Legislation ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Countries: Panama, El Salvador, Guatemala`)
  console.log(`Blockers:`)
  console.log(`  Dominican Republic (congreso.gob.do) — parked domain`)
  console.log(`  Honduras (congreso.gob.hn) — DNS failure`)
  console.log(`  Nicaragua (asamblea.gob.ni) — DNS failure\n`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  console.log('Step 1: Enumerating acts via Wayback CDX API...')
  const allSlugs: ActSlug[] = []
  const countsByCountry: Record<string, number> = {}

  for (const country of COUNTRIES) {
    process.stdout.write(`  ${country.name} (${country.code})... `)
    const slugs = await getCdxSlugs(country)
    allSlugs.push(...slugs)
    countsByCountry[country.code] = slugs.length
    console.log(`${slugs.length} acts`)
    await sleep(CDX_DELAY_MS)
  }

  const totalActs = allSlugs.length
  console.log(`\nTotal acts enumerated: ${totalActs}`)

  if (totalActs === 0) {
    console.warn('WARNING: 0 acts enumerated — CDX may be unavailable.')
  }

  if (mode === 'dry-run') {
    console.log('\nStep 2 (dry-run): Fetching sample pages...')
    const SAMPLE_PER_COUNTRY = 3
    const sampleSlugs: ActSlug[] = []
    for (const country of COUNTRIES) {
      sampleSlugs.push(...allSlugs.filter(s => s.countryCode === country.code).slice(0, SAMPLE_PER_COUNTRY))
    }

    const sampleRecords: ActRecord[] = []
    for (const slug of sampleSlugs) {
      const country = COUNTRIES.find(c => c.code === slug.countryCode)!
      process.stdout.write(`  [${slug.countryCode}] ${slug.slug.slice(0, 40)}... `)
      const { title, year } = await fetchActData(slug, country)
      sampleRecords.push({ ...slug, countryName: country.name, title, year })
      console.log(title ? `"${title.slice(0, 70)}"${year ? ` (${year})` : ''}` : 'NO TITLE')
      await sleep(REQUEST_DELAY_MS)
    }

    const withTitle = sampleRecords.filter(r => r.title).length

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalEnumerated: totalActs,
      countsByCountry,
      blockers: {
        dominican_republic: 'congreso.gob.do — parked domain (redirects to GoDaddy parking)',
        honduras: 'congreso.gob.hn — DNS resolution failure',
        nicaragua: 'asamblea.gob.ni — DNS resolution failure',
      },
      sampleFetched: sampleRecords.length,
      coverage: { withTitle },
      sample: sampleRecords.map(r => ({
        countryCode: r.countryCode,
        country: r.countryName,
        slug: r.slug,
        title: r.title,
        year: r.year,
        waybackUrl: `${WAYBACK}/${r.timestamp}/${r.originalUrl}`,
        claimText: r.title ? `${r.countryName} enacted: ${r.title}.` : '(no title)',
        externalId: `${INGESTED_BY}_${r.countryCode}_${r.slug}`,
      })),
    }

    fs.writeFileSync('pipeline-101-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\nWritten: pipeline-101-dry-run-sample.json')
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  console.log('\nStep 2: Ensuring topics...')
  const topicIds = new Map<string, string>()
  for (const country of COUNTRIES) {
    const id = await ensureTopic(`${country.code}-legislature`, `Legislature of ${country.name}`, 'government', 'gov-region-americas')
    topicIds.set(country.code, id)
  }

  const existingRaw = await prisma.claim.findMany({ where: { ingestedBy: INGESTED_BY }, select: { externalId: true } })
  const existingSet = new Set(existingRaw.map(c => c.externalId))
  console.log(`  ${existingSet.size} records already in DB`)

  const targetSlugs = mode === 'sample' ? allSlugs.slice(0, sampleN * 3) : allSlugs
  console.log(`\nStep 3: Fetching + writing ${targetSlugs.length} acts...`)

  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()
  let fetched = 0, noTitle = 0, found = 0
  let pending: ActRecord[] = []

  async function flushPending() {
    if (pending.length === 0) return
    const batch = pending.splice(0)
    try {
      await prisma.$transaction(async (tx) => {
        for (const rec of batch) {
          const result = await writeRow(tx, rec, topicIds.get(rec.countryCode)!)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${rec.countryCode} ${rec.slug} — ${rec.title.slice(0, 80)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
  }

  for (const slug of targetSlugs) {
    const externalId = `${INGESTED_BY}_${slug.countryCode}_${slug.slug}`
    if (existingSet.has(externalId)) { counts.skipped++; fetched++; continue }

    const country = COUNTRIES.find(c => c.code === slug.countryCode)!
    const { title, year } = await fetchActData(slug, country)
    fetched++
    if (!title) { noTitle++ } else {
      found++
      pending.push({ ...slug, countryName: country.name, title, year })
      if (pending.length >= BATCH_SIZE) await flushPending()
    }
    if (fetched % 50 === 0) console.log(`  ${fetched}/${targetSlugs.length} fetched | Committed: ${counts.ingested}`)
    if (mode === 'sample' && found >= sampleN) break
    await sleep(REQUEST_DELAY_MS)
  }
  await flushPending()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Fetched: ${fetched} | With title: ${found} | No title: ${noTitle}`)
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
