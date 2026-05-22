// Pipeline 83 — AfricanLII Legislation (africanlii_v1)
// Dataset: African Legal Information Institute — legislation from 12 countries
// Source: Country-specific LII sites via Wayback Machine CDX enumeration
//
// BLOCKER NOTE: The AfricanLII.org API (africanlii.org/api/) requires
// authentication credentials ("Authentication credentials were not provided.").
// Per-country pages on africanlii.org return 404. As of 2026-05-20:
//
// WORKING (Wayback CDX confirmed):
//   Malawi — malawilii.org/mw/legislation/act/* — 551 acts confirmed via CDX
//
// BLOCKED (no usable Wayback CDX data found):
//   Mauritius, Seychelles, Sierra Leone, Rwanda, Tanzania, Botswana,
//   Liberia, eSwatini, Mozambique, Ethiopia, Zanzibar — zero CDX results
//   for known LII URL patterns. These countries may not have separate LII
//   sites or their sites have not been archived by Wayback at the act level.
//
// The script runs CDX enumeration for all 12 countries and processes those
// with results. In practice only Malawi currently yields data.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-africanlii.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-africanlii.ts --sample 10
//      ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-africanlii.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'africanlii_v1'
const PIPELINE = 'Pipeline 83'
const CDX_API = 'http://web.archive.org/cdx/search/cdx'
const WAYBACK_BASE = 'https://web.archive.org/web'
const REQUEST_DELAY_MS = 1200
const CDX_DELAY_MS = 600
const BATCH_SIZE = 50

// ── Country config ─────────────────────────────────────────────────────────────

interface Country {
  code: string
  name: string
  cdxPattern: string
  slugRegex: RegExp
  topicSlug: string
  topicName: string
}

// URL patterns confirmed via Wayback CDX probe (2026-05-20)
const COUNTRIES: Country[] = [
  {
    code: 'mw', name: 'Malawi',
    cdxPattern: 'malawilii.org/mw/legislation/act/*',
    slugRegex: /malawilii\.org\/mw\/legislation\/act\/(\d{4})\/(\d+)(?:\/|$)/,
    topicSlug: 'parliament-malawi',
    topicName: 'Acts of Malawi',
  },
  // These 11 countries have no usable Wayback CDX data at act-level URLs (2026-05-20).
  // CDX probes returned empty for all known URL patterns. Included to document
  // scope and allow future re-runs when data becomes available.
  {
    code: 'mu', name: 'Mauritius',
    cdxPattern: 'mauritiuslii.org/mu/legislation/act/*',
    slugRegex: /mauritiuslii\.org\/mu\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-mauritius',
    topicName: 'Acts of Mauritius',
  },
  {
    code: 'sc', name: 'Seychelles',
    cdxPattern: 'seylii.org/sc/legislation/act/*',
    slugRegex: /seylii\.org\/sc\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-seychelles',
    topicName: 'Acts of Seychelles',
  },
  {
    code: 'sl', name: 'Sierra Leone',
    cdxPattern: 'sierraleonelii.org/sl/legislation/act/*',
    slugRegex: /sierraleonelii\.org\/sl\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-sierra-leone',
    topicName: 'Acts of Sierra Leone',
  },
  {
    code: 'rw', name: 'Rwanda',
    cdxPattern: 'rwandalii.rw/rw/legislation/act/*',
    slugRegex: /rwandalii\.rw\/rw\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-rwanda',
    topicName: 'Acts of Rwanda',
  },
  {
    code: 'tz', name: 'Tanzania',
    cdxPattern: 'tanzlii.org/tz/legislation/act/*',
    slugRegex: /tanzlii\.org\/tz\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-tanzania',
    topicName: 'Acts of Tanzania',
  },
  {
    code: 'bw', name: 'Botswana',
    cdxPattern: 'botswalii.org/bw/legislation/act/*',
    slugRegex: /botswalii\.org\/bw\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-botswana',
    topicName: 'Acts of Botswana',
  },
  {
    code: 'lr', name: 'Liberia',
    cdxPattern: 'liberlii.org/lr/legislation/act/*',
    slugRegex: /liberlii\.org\/lr\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-liberia',
    topicName: 'Acts of Liberia',
  },
  {
    code: 'sz', name: 'eSwatini',
    cdxPattern: 'swazilii.org/sz/legislation/act/*',
    slugRegex: /swazilii\.org\/sz\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-eswatini',
    topicName: 'Acts of eSwatini',
  },
  {
    code: 'mz', name: 'Mozambique',
    cdxPattern: 'mozambiquelii.org/mz/legislation/act/*',
    slugRegex: /mozambiquelii\.org\/mz\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-mozambique',
    topicName: 'Acts of Mozambique',
  },
  {
    code: 'et', name: 'Ethiopia',
    cdxPattern: 'etlaw.gov.et/et/legislation/act/*',
    slugRegex: /etlaw\.gov\.et\/et\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-ethiopia',
    topicName: 'Acts of Ethiopia',
  },
  {
    code: 'tz-z', name: 'Zanzibar',
    cdxPattern: 'zanzibarlii.org/tz-z/legislation/act/*',
    slugRegex: /zanzibarlii\.org\/tz-z\/legislation\/act\/(\d{4})\/(\d+)/,
    topicSlug: 'parliament-zanzibar',
    topicName: 'Acts of Zanzibar',
  },
]

interface ActSlug {
  countryCode: string
  originalUrl: string
  timestamp: string
  year: number | null
  actNum: string | null
}

interface ActRecord extends ActSlug {
  countryName: string
  title: string
}

type Counts = { ingested: number; skipped: number; errors: number }
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── CLI ────────────────────────────────────────────────────────────────────────

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

// ── HTTP ───────────────────────────────────────────────────────────────────────

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

async function getCdxSlugs(country: Country): Promise<ActSlug[]> {
  const url = `${CDX_API}?url=${country.cdxPattern}&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=2000`
  let body: string
  try {
    body = await anyGet(url)
  } catch (err) {
    console.error(`  CDX error for ${country.name}: ${(err as Error).message}`)
    return []
  }
  let data: string[][]
  try {
    data = JSON.parse(body) as string[][]
  } catch {
    console.error(`  CDX parse error for ${country.name}`)
    return []
  }
  const rows = data.slice(1) // skip header
  const seen = new Set<string>()
  const results: ActSlug[] = []
  for (const [originalUrl, timestamp] of rows) {
    if (!originalUrl || !timestamp) continue
    if (seen.has(originalUrl)) continue
    const m = country.slugRegex.exec(originalUrl)
    const year = m ? parseInt(m[1]) : null
    const actNum = m ? m[2] : null
    seen.add(originalUrl)
    results.push({ countryCode: country.code, originalUrl, timestamp, year, actNum })
  }
  return results
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  if (!m) return ''
  return m[1].trim().replace(/\s+/g, ' ').replace(/\s*[|\-–—].*$/, '').trim()
}

async function fetchActTitle(slug: ActSlug): Promise<string> {
  const waybackUrl = `${WAYBACK_BASE}/${slug.timestamp}/${slug.originalUrl}`
  try {
    const body = await anyGet(waybackUrl)
    return extractTitle(body)
  } catch {
    return ''
  }
}

// ── Topic ──────────────────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
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

// ── Write row ──────────────────────────────────────────────────────────────────

async function writeRow(tx: TxClient, rec: ActRecord, topicId: string): Promise<'ingested' | 'skipped' | 'failed'> {
  const externalId = `africanlii_${rec.countryCode}_${rec.year ?? 'unknown'}_${rec.actNum ?? rec.timestamp}`
  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const claimEmergedAt = rec.year ? new Date(`${rec.year}-01-01T00:00:00Z`) : null
    const waybackUrl = `${WAYBACK_BASE}/${rec.timestamp}/${rec.originalUrl}`

    const source = await tx.source.upsert({
      where: { externalId: `src_${externalId}` },
      update: {},
      create: {
        externalId: `src_${externalId}`,
        name: `AfricanLII — ${rec.countryName}: ${rec.title.slice(0, 120)}`,
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
          year: rec.year,
          actNum: rec.actNum,
          waybackTimestamp: rec.timestamp,
          originalUrl: rec.originalUrl,
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
    console.error(`  Error writing ${externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: AfricanLII Legislation ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Countries: ${COUNTRIES.map(c => c.name).join(', ')}`)
  console.log(`Note: Only Malawi (malawilii.org) has confirmed Wayback CDX data as of 2026-05-20.\n`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  // Step 1: CDX enumeration for all countries
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
  const workingCountries = COUNTRIES.filter(c => (countsByCountry[c.code] ?? 0) > 0)

  console.log(`\nTotal acts enumerated: ${totalActs}`)
  console.log(`Working countries: ${workingCountries.map(c => `${c.name} (${countsByCountry[c.code]})`).join(', ') || 'none'}`)
  const blockedCountries = COUNTRIES.filter(c => (countsByCountry[c.code] ?? 0) === 0)
  if (blockedCountries.length > 0) {
    console.log(`Blocked countries (0 CDX results): ${blockedCountries.map(c => c.name).join(', ')}`)
  }

  if (totalActs === 0) {
    console.error('\nERROR: 0 acts enumerated. Wayback CDX API may be unavailable.')
    console.error('Blocker: AfricanLII.org API requires authentication (confirmed 2026-05-20).')
    console.error('Only Malawi (malawilii.org) has known Wayback CDX data for act-level URLs.')
    process.exit(1)
  }

  // Dry-run: fetch a few sample pages
  if (mode === 'dry-run') {
    console.log('\nStep 2 (dry-run): Fetching sample pages from Wayback...')
    const SAMPLE_PER_COUNTRY = 3
    const sampleSlugs: ActSlug[] = []
    for (const country of workingCountries) {
      const forCountry = allSlugs.filter(s => s.countryCode === country.code)
      sampleSlugs.push(...forCountry.slice(0, SAMPLE_PER_COUNTRY))
    }

    const sampleRecords: ActRecord[] = []
    for (const slug of sampleSlugs) {
      const country = COUNTRIES.find(c => c.code === slug.countryCode)!
      process.stdout.write(`  [${slug.countryCode}] ${slug.year}/${slug.actNum}... `)
      const title = await fetchActTitle(slug)
      const rec: ActRecord = { ...slug, countryName: country.name, title }
      sampleRecords.push(rec)
      console.log(title ? `"${title}"` : 'NO TITLE')
      await sleep(REQUEST_DELAY_MS)
    }

    const withTitle = sampleRecords.filter(r => r.title).length

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      blocker: 'AfricanLII.org API requires authentication. Only Malawi (malawilii.org) accessible via Wayback CDX.',
      totalEnumerated: totalActs,
      countsByCountry,
      blockedCountries: blockedCountries.map(c => c.name),
      sampleFetched: sampleRecords.length,
      coverage: { withTitle, total: sampleRecords.length },
      sample: sampleRecords.map(r => ({
        countryCode: r.countryCode,
        country: r.countryName,
        year: r.year,
        actNum: r.actNum,
        title: r.title,
        waybackUrl: `${WAYBACK_BASE}/${r.timestamp}/${r.originalUrl}`,
        claimText: r.title ? `${r.countryName} enacted the ${r.title}.` : '(no title extracted)',
      })),
    }

    fs.writeFileSync('pipeline-83-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\nWritten: pipeline-83-dry-run-sample.json')
    console.log(`\nCDX counts by country:`)
    for (const c of COUNTRIES) {
      const n = countsByCountry[c.code] ?? 0
      console.log(`  ${c.name}: ${n}${n === 0 ? ' (blocked — no Wayback CDX data)' : ''}`)
    }
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // Sample / Full
  console.log('\nStep 2: Ensuring topics...')
  const topicIds = new Map<string, string>()
  await ensureTopic('international-law', 'International Law', 'law')
  await ensureTopic('gov-region-africa', 'Africa', 'government', 'international-law')
  for (const country of workingCountries) {
    const id = await ensureTopic(country.topicSlug, country.topicName, 'government', 'gov-region-africa')
    topicIds.set(country.code, id)
  }

  const targetSlugs = mode === 'sample'
    ? allSlugs.filter(s => workingCountries.some(c => c.code === s.countryCode)).slice(0, sampleN * 3)
    : allSlugs.filter(s => workingCountries.some(c => c.code === s.countryCode))

  console.log(`\nStep 3: Fetching + writing ${targetSlugs.length} acts from Wayback...`)
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()
  let found = 0, noTitle = 0
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
          if (verbose) console.log(`  [${result}] [${rec.countryCode}] ${rec.year}/${rec.actNum} — ${rec.title.slice(0, 80)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch flush failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
  }

  for (const slug of targetSlugs) {
    const country = COUNTRIES.find(c => c.code === slug.countryCode)!
    const title = await fetchActTitle(slug)
    if (!title) {
      noTitle++
    } else {
      found++
      pending.push({ ...slug, countryName: country.name, title })
      if (pending.length >= BATCH_SIZE) await flushPending()
    }
    if (mode === 'sample' && found >= sampleN) break
    await sleep(REQUEST_DELAY_MS)
  }

  await flushPending()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nComplete in ${elapsed}s | With title: ${found} | No title: ${noTitle}`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`\nDB: Claims=${dbClaims} Sources=${dbSources}`)

  if (mode === 'sample') console.log('\nSample complete. Review then run --full with ALLOW_EDITS=true.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
