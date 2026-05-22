// Pipeline 97 — Western Balkans Legislation (western_balkans_v1)
// Dataset: Official Gazettes and legislation portals for Balkan countries.
//
// Country coverage & strategy:
//   Kosovo      — gzk.rks-gov.net   — server-rendered ASP.NET. Enumerate act IDs via
//                                      Wayback CDX, then fetch directly from live site.
//   Montenegro  — sluzbenilist.me   — CDX enumerate + Wayback fetch (Laravel SPA gated).
//   Albania     — qbz.gov.al        — CDX enumerate + Wayback fetch (Angular SPA gated).
//   N. Macedonia — pravo.gov.mk     — BLOCKED: DNS resolution failure. Skipped.
//   Bosnia       — sluzbenilist.ba  — BLOCKED: DNS resolution failure. Skipped.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-western-balkans.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-western-balkans.ts --sample 10
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-western-balkans.ts --full [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'western_balkans_v1'
const PIPELINE = 'Pipeline 97'
const CDX_API = 'http://web.archive.org/cdx/search/cdx'
const WAYBACK = 'https://web.archive.org/web'
const REQUEST_DELAY_MS = 800
const CDX_DELAY_MS = 500
const BATCH_SIZE = 50

interface Country {
  code: string
  name: string
  cdxUrl: string
  slugRegex: RegExp
  directFetch?: boolean  // fetch from live site instead of Wayback
  directBase?: string
}

// North Macedonia (pravo.gov.mk): DNS failure — skip.
// Bosnia (sluzbenilist.ba): DNS failure — skip.
const COUNTRIES: Country[] = [
  {
    code: 'xk',
    name: 'Kosovo',
    // ActDetail.aspx?ActID=N — server-rendered, directly fetchable
    cdxUrl: 'gzk.rks-gov.net/ActDetail.aspx?ActID=*',
    slugRegex: /gzk\.rks-gov\.net\/ActDetail\.aspx\?ActID=(\d+)$/i,
    directFetch: true,
    directBase: 'https://gzk.rks-gov.net',
  },
  {
    code: 'me',
    name: 'Montenegro',
    cdxUrl: 'www.sluzbenilist.me/*',
    slugRegex: /sluzbenilist\.me\/(zakoni|propisi|en\/regulation|en\/law)\/([^/?#]+)\/?$/i,
  },
  {
    code: 'al',
    name: 'Albania',
    cdxUrl: 'qbz.gov.al/*',
    // Albanian Official Journal — main act slugs under /Aktet/ or /#/
    slugRegex: /qbz\.gov\.al\/(Aktet|akt|document)\/([^/?#]+)\/?$/i,
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
          'Accept-Language': 'en,sq,sr;q=0.8',
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
            reject(new Error(`HTTP ${res.statusCode} for ${urlStr}`))
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
  const url = `${CDX_API}?url=${country.cdxUrl}&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=5000`
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
    const m = country.slugRegex.exec(originalUrl)
    if (!m) continue
    const slug = m[m.length - 1]!
    if (!slug || slug.length < 2 || seen.has(slug)) continue
    seen.add(slug)
    results.push({ countryCode: country.code, slug, timestamp, originalUrl })
  }
  return results
}

// Kosovo: enumerate act IDs from homepage-visible range (acts go up to ~120000+)
// Since CDX regex matching is difficult for query params, we enumerate from CDX broadly
// and also add a sequential range scan for IDs mentioned on the homepage.
async function getKosovoActSlugs(): Promise<ActSlug[]> {
  // Try CDX with a broad pattern first
  const url = `${CDX_API}?url=gzk.rks-gov.net/ActDetail.aspx*&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=5000`
  let body: string
  try { body = await httpGet(url, 60000) }
  catch (err) { console.error(`  CDX error for Kosovo: ${(err as Error).message}`); return [] }

  let data: string[][]
  try { data = JSON.parse(body) as string[][] }
  catch { console.error(`  CDX parse error for Kosovo`); return [] }

  const seen = new Set<string>()
  const results: ActSlug[] = []

  for (const row of data.slice(1)) {
    const [originalUrl, timestamp] = row
    if (!originalUrl || !timestamp) continue
    const m = /[?&]ActID=(\d{3,6})(?:&|$)/i.exec(originalUrl)
    if (!m) continue
    const actId = m[1]!
    if (seen.has(actId)) continue
    seen.add(actId)
    results.push({
      countryCode: 'xk',
      slug: actId,
      timestamp,
      originalUrl: `https://gzk.rks-gov.net/ActDetail.aspx?ActID=${actId}`,
    })
  }
  return results
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  if (!m) return ''
  return m[1]!.trim().replace(/\s+/g, ' ').replace(/\s*[-|–]\s*(Gazeta Zyrtare|Official Gazette|sluzbenilist|QBZ).*/i, '')
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

async function fetchActData(slug: ActSlug, country: Country): Promise<{ title: string; year: number | null }> {
  let fetchUrl: string
  if (country.directFetch && country.directBase) {
    // Kosovo: fetch directly from live site
    fetchUrl = `${country.directBase}/ActDetail.aspx?ActID=${slug.slug}`
  } else {
    fetchUrl = `${WAYBACK}/${slug.timestamp}/${slug.originalUrl}`
  }
  let body: string
  try { body = await httpGet(fetchUrl) }
  catch { return { title: '', year: null } }
  return { title: extractTitle(body), year: extractYear(body) }
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
    const liveUrl = rec.countryCode === 'xk'
      ? `https://gzk.rks-gov.net/ActDetail.aspx?ActID=${rec.slug}`
      : rec.originalUrl
    const sourceUrl = `${WAYBACK}/${rec.timestamp}/${rec.originalUrl}`

    const source = await tx.source.upsert({
      where: { externalId: `src_${externalId}` },
      update: {},
      create: {
        externalId: `src_${externalId}`,
        name: `${rec.countryName} legislation — ${rec.title.slice(0, 120)}`,
        url: rec.countryCode === 'xk' ? liveUrl : sourceUrl,
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
          source: liveUrl,
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

  console.log(`\n── ${PIPELINE}: Western Balkans Legislation ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Countries: Kosovo, Montenegro, Albania`)
  console.log(`Blockers: North Macedonia (pravo.gov.mk — DNS failure), Bosnia (sluzbenilist.ba — DNS failure)\n`)

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
    const slugs = country.code === 'xk'
      ? await getKosovoActSlugs()
      : await getCdxSlugs(country)
    allSlugs.push(...slugs)
    countsByCountry[country.code] = slugs.length
    console.log(`${slugs.length} acts`)
    await sleep(CDX_DELAY_MS)
  }

  const totalActs = allSlugs.length
  console.log(`\nTotal acts enumerated: ${totalActs}`)

  if (totalActs === 0) {
    console.warn('WARNING: 0 acts enumerated — CDX may be unavailable or slugs not indexed.')
  }

  // Phase 2: dry-run — sample a few per country
  if (mode === 'dry-run') {
    console.log('\nStep 2 (dry-run): Fetching sample pages...')
    const SAMPLE_PER_COUNTRY = 3
    const sampleSlugs: ActSlug[] = []
    for (const country of COUNTRIES) {
      const forCountry = allSlugs.filter(s => s.countryCode === country.code)
      sampleSlugs.push(...forCountry.slice(0, SAMPLE_PER_COUNTRY))
    }

    const sampleRecords: ActRecord[] = []
    for (const slug of sampleSlugs) {
      const country = COUNTRIES.find(c => c.code === slug.countryCode)!
      process.stdout.write(`  [${slug.countryCode}] ${slug.slug.slice(0, 40)}... `)
      const { title, year } = await fetchActData(slug, country)
      const rec: ActRecord = { ...slug, countryName: country.name, title, year }
      sampleRecords.push(rec)
      console.log(title ? `"${title.slice(0, 70)}"${year ? ` (${year})` : ''}` : 'NO TITLE')
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
      blockers: {
        north_macedonia: 'pravo.gov.mk — DNS resolution failure (exit code 6)',
        bosnia: 'sluzbenilist.ba — DNS resolution failure',
      },
      sampleFetched: sampleRecords.length,
      coverage: { withTitle, withYear },
      sample: sampleRecords.map(r => ({
        countryCode: r.countryCode,
        country: r.countryName,
        slug: r.slug,
        title: r.title,
        year: r.year,
        sourceUrl: r.countryCode === 'xk'
          ? `https://gzk.rks-gov.net/ActDetail.aspx?ActID=${r.slug}`
          : `${WAYBACK}/${r.timestamp}/${r.originalUrl}`,
        claimText: r.title ? `${r.countryName} enacted: ${r.title}.` : '(no title)',
        externalId: `${INGESTED_BY}_${r.countryCode}_${r.slug}`,
      })),
    }

    fs.writeFileSync('pipeline-97-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\nWritten: pipeline-97-dry-run-sample.json')
    console.log(`\nCoverage (sample): title=${withTitle}/${sampleRecords.length}, year=${withYear}/${sampleRecords.length}`)
    console.log('\nCDX count by country:')
    for (const country of COUNTRIES) {
      console.log(`  ${country.name}: ${countsByCountry[country.code] ?? 0}`)
    }
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // Phase 3: ensure topics
  console.log('\nStep 2: Ensuring topics...')
  const topicIds = new Map<string, string>()
  for (const country of COUNTRIES) {
    const id = await ensureTopic(
      `${country.code}-parliament`,
      `Acts of ${country.name}`,
      'government',
      'gov-region-europe'
    )
    topicIds.set(country.code, id)
  }

  // Phase 4: fetch + write
  const existingRaw = await prisma.claim.findMany({
    where: { ingestedBy: INGESTED_BY }, select: { externalId: true },
  })
  const existingSet = new Set(existingRaw.map(c => c.externalId))
  console.log(`  ${existingSet.size} records already in DB`)

  const targetSlugs = mode === 'sample' ? allSlugs.slice(0, sampleN * 3) : allSlugs
  const total = targetSlugs.length
  console.log(`\nStep 3: Fetching + writing ${total} acts...`)

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
          const topicId = topicIds.get(rec.countryCode)!
          const result = await writeRow(tx, rec, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${INGESTED_BY}_${rec.countryCode}_${rec.slug} — ${rec.title.slice(0, 80)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch flush failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
  }

  for (const slug of targetSlugs) {
    const externalId = `${INGESTED_BY}_${slug.countryCode}_${slug.slug}`
    if (existingSet.has(externalId)) { counts.skipped++; fetched++; continue }

    const country = COUNTRIES.find(c => c.code === slug.countryCode)!
    const { title, year } = await fetchActData(slug, country)
    fetched++
    if (!title) { noTitle++; } else {
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
  console.log(`  Claims: ${dbClaims} | Sources: ${dbSources} | Edges: ${dbEdges}`)

  if (mode === 'sample') console.log('\nSample complete. Review then run --full.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
