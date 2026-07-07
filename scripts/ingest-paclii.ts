// DEPRECATED (spec/10): migrated to pipelines/paclii_legislation_v1.ts + lib/ingest harness.
// Use: npx tsx scripts/run-pipeline.ts --tag paclii_legislation_v1 [--full | --dry-run]
// This file preserved for audit trail. Legacy copy: scripts/legacy/ingest-paclii.ts
//
// Pipeline 87 — PacLII Pacific Island Legislation (paclii_legislation_v1)
// Dataset: Pacific Islands Legal Information Institute (www.paclii.org)
// Countries: Fiji, Solomon Islands, Vanuatu, Tonga, Samoa, Kiribati, Tuvalu, Papua New Guinea
//
// Access: paclii.org is Cloudflare-protected — direct access blocked.
// Strategy: enumerate act slugs via Wayback CDX API, then fetch each act page
//           from Wayback Machine (web.archive.org/web/{ts}/{url}) and parse
//           the <title> tag for the act name.
//
// URL pattern: https://www.paclii.org/{cc}/legis/consol_act/{slug}/
// CDX API:     http://web.archive.org/cdx/search/cdx?url=www.paclii.org/{cc}/legis/consol_act/*
// Wayback:     https://web.archive.org/web/{timestamp}/{original_url}
//
// Year extraction: scan body for earliest "of YYYY" citation (ordinance/amendment history).
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-paclii.ts --dry-run
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-paclii.ts --sample 10
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-paclii.ts --full [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'paclii_legislation_v1'
const PIPELINE = 'Pipeline 87'
const CDX_API_BASE = 'http://web.archive.org/cdx/search/cdx'
const WAYBACK_BASE = 'https://web.archive.org/web'
const REQUEST_DELAY_MS = 1200
const CDX_DELAY_MS = 600
const BATCH_SIZE = 50

interface Country { code: string; name: string }

const COUNTRIES: Country[] = [
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
        console.error('Usage: --dry-run | --sample N | --full  [--start-from IDX] [--verbose]')
        process.exit(1) as never
      })()
  const sai = args.indexOf('--sample')
  const sfi = args.indexOf('--start-from')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    startFrom: sfi !== -1 ? (parseInt(args[sfi + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

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
        res.on('data', c => chunks.push(c))
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
  const url = `${CDX_API_BASE}?url=www.paclii.org/${countryCode}/legis/consol_act/*&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=2000`
  let body: string
  try {
    body = await anyGet(url)
  } catch (err) {
    console.error(`  CDX error for ${countryCode}: ${(err as Error).message}`)
    return []
  }

  let data: string[][]
  try {
    data = JSON.parse(body) as string[][]
  } catch {
    console.error(`  CDX parse error for ${countryCode}`)
    return []
  }

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
    results.push({ countryCode, slug, timestamp, originalUrl })
  }

  return results
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  if (!m) return ''
  // PacLII title tags are just the act name
  return m[1]!.trim().replace(/\s+/g, ' ')
}

function extractYear(html: string): number | null {
  // Find earliest "of YYYY" citation from ordinance/act amendment history.
  // The first/minimum year is typically the original enactment year.
  const bodyStart = html.indexOf('<body')
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html
  // Strip script/style blocks first
  const cleaned = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const matches = [...cleaned.matchAll(/\bof\s+(1[789]\d\d|20[012]\d)\b/g)]
  if (matches.length === 0) return null
  const years = matches.map(m => parseInt(m[1]!))
  const earliest = Math.min(...years)
  return earliest >= 1850 && earliest <= 2025 ? earliest : null
}

async function fetchActData(slug: ActSlug): Promise<{ title: string; year: number | null }> {
  const waybackUrl = `${WAYBACK_BASE}/${slug.timestamp}/${slug.originalUrl}`
  let body: string
  try {
    body = await anyGet(waybackUrl)
  } catch {
    return { title: '', year: null }
  }
  return { title: extractTitle(body), year: extractYear(body) }
}

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

async function writeRow(tx: TxClient, rec: ActRecord, topicId: string): Promise<'ingested' | 'skipped' | 'failed'> {
  const externalId = `paclii_${rec.countryCode}_${rec.slug}`
  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const claimEmergedAt = rec.year ? new Date(`${rec.year}-01-01T00:00:00Z`) : null
    const waybackUrl = `${WAYBACK_BASE}/${rec.timestamp}/${rec.originalUrl}`
    const sourceExternalId = `src_${externalId}`

    const source = await tx.source.upsert({
      where: { externalId: sourceExternalId },
      update: {},
      create: {
        externalId: sourceExternalId,
        name: `PacLII — ${rec.countryName}: ${rec.title.slice(0, 120)}`,
        url: waybackUrl,
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
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId,
        metadata: {
          dataset: INGESTED_BY,
          countryCode: rec.countryCode,
          country: rec.countryName,
          slug: rec.slug,
          waybackTimestamp: rec.timestamp,
          source: 'paclii.org',
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
    console.error(`  Error writing paclii_${rec.countryCode}_${rec.slug}: ${err}`)
    return 'failed'
  }
}

async function main() {
  const { mode, sampleN, startFrom, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: PacLII Pacific Island Legislation ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Countries: ${COUNTRIES.map(c => c.name).join(', ')}`)
  console.log(`Source: paclii.org via Wayback Machine CDX enumeration\n`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  // Phase 1: CDX enumeration
  console.log('Step 1: Enumerating acts via Wayback CDX API...')
  const allSlugs: ActSlug[] = []
  const countsByCountry: Record<string, number> = {}

  for (const country of COUNTRIES) {
    process.stdout.write(`  ${country.name} (${country.code})... `)
    const slugs = await getCdxSlugs(country.code)
    allSlugs.push(...slugs)
    countsByCountry[country.code] = slugs.length
    console.log(`${slugs.length} acts`)
    await sleep(CDX_DELAY_MS)
  }

  const totalActs = allSlugs.length
  console.log(`\nTotal acts enumerated: ${totalActs}`)

  if (totalActs === 0) {
    console.error('ERROR: 0 acts enumerated — CDX API may be unavailable.')
    process.exit(1)
  }

  // For dry-run: sample a few per country to verify page fetching works
  if (mode === 'dry-run') {
    console.log('\nStep 2 (dry-run): Fetching sample pages from Wayback...')
    const SAMPLE_PER_COUNTRY = 3
    const sampleSlugs: ActSlug[] = []
    for (const country of COUNTRIES) {
      const forCountry = allSlugs.filter(s => s.countryCode === country.code)
      sampleSlugs.push(...forCountry.slice(0, SAMPLE_PER_COUNTRY))
    }

    const sampleRecords: ActRecord[] = []
    for (const slug of sampleSlugs) {
      const country = COUNTRIES.find(c => c.code === slug.countryCode)!
      process.stdout.write(`  [${slug.countryCode}] ${slug.slug}... `)
      const { title, year } = await fetchActData(slug)
      const rec: ActRecord = { ...slug, countryName: country.name, title, year }
      sampleRecords.push(rec)
      console.log(title ? `"${title}"${year ? ` (${year})` : ''}` : 'NO TITLE')
      await sleep(REQUEST_DELAY_MS)
    }

    const withTitle = sampleRecords.filter(r => r.title).length
    const withYear = sampleRecords.filter(r => r.year !== null).length

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalEnumerated: totalActs,
      countsByCountry,
      sampleFetched: sampleRecords.length,
      coverage: { withTitle, withYear },
      sample: sampleRecords.map(r => ({
        countryCode: r.countryCode,
        country: r.countryName,
        slug: r.slug,
        title: r.title,
        year: r.year,
        waybackUrl: `${WAYBACK_BASE}/${r.timestamp}/${r.originalUrl}`,
        claimText: r.title ? `${r.countryName} enacted the ${r.title}.` : '(no title)',
        externalId: `paclii_${r.countryCode}_${r.slug}`,
      })),
    }

    fs.writeFileSync('pipeline-87-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\nWritten: pipeline-87-dry-run-sample.json')
    console.log(`\nCoverage (sample): title=${withTitle}/${sampleRecords.length}, year=${withYear}/${sampleRecords.length}`)
    console.log('\nCDX count by country:')
    for (const country of COUNTRIES) {
      console.log(`  ${country.name}: ${countsByCountry[country.code] ?? 0}`)
    }
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // Phase 2: Ensure topics and load resume state
  console.log('\nStep 2: Ensuring topics...')
  const topicIds = new Map<string, string>()
  for (const country of COUNTRIES) {
    const id = await ensureTopic(
      `${country.code}-parliament`,
      `Acts of ${country.name}`,
      'government',
      'gov-region-oceania'
    )
    topicIds.set(country.code, id)
  }

  console.log('\nStep 3: Loading resume state from DB...')
  const existingRaw = await prisma.claim.findMany({
    where: { ingestedBy: INGESTED_BY },
    select: { externalId: true },
  })
  const existingSet = new Set(existingRaw.map(c => c.externalId))
  console.log(`  ${existingSet.size} records already in DB (will skip without fetching)`)

  // Phase 3: Fetch + write interleaved
  const targetSlugs = mode === 'sample'
    ? allSlugs.slice(startFrom, startFrom + sampleN * 3)
    : allSlugs.slice(startFrom)
  const total = targetSlugs.length
  console.log(`\nStep 4: Fetching + writing ${total} acts from Wayback (batches of ${BATCH_SIZE}, interleaved)${startFrom ? ` [resuming from idx ${startFrom}]` : ''}...`)

  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()
  let fetched = 0, noTitle = 0, found = 0
  const pending: ActRecord[] = []

  async function flushPending() {
    if (pending.length === 0) return
    const batch = pending.splice(0)
    try {
      await prisma.$transaction(async (tx) => {
        for (const rec of batch) {
          const topicId = topicIds.get(rec.countryCode)!
          const result = await writeRow(tx, rec, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] paclii_${rec.countryCode}_${rec.slug} — ${rec.title.slice(0, 80)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch flush failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
  }

  for (const slug of targetSlugs) {
    const externalId = `paclii_${slug.countryCode}_${slug.slug}`

    if (existingSet.has(externalId)) {
      counts.skipped++
      fetched++
      continue
    }

    const country = COUNTRIES.find(c => c.code === slug.countryCode)!
    const { title, year } = await fetchActData(slug)
    fetched++
    if (!title) {
      noTitle++
    } else {
      found++
      pending.push({ ...slug, countryName: country.name, title, year })
      if (pending.length >= BATCH_SIZE) await flushPending()
    }

    if (fetched % 50 === 0) {
      console.log(`  ${fetched}/${total} fetched | Committed: ${counts.ingested} | Last: [${slug.countryCode}] ${slug.slug}`)
    }

    if (mode === 'sample' && found >= sampleN) break
    await sleep(REQUEST_DELAY_MS)
  }

  await flushPending()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Fetched: ${fetched} | With title: ${found} | No title: ${noTitle}`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (mode === 'sample') console.log('\nSample complete. Review then run --full.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
