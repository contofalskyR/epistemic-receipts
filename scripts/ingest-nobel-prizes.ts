// Pipeline 10 — Nobel Prize ingester
// Dataset: Nobel Foundation API v2.1 (api.nobelprize.org) — the Nobel Foundation's
// canonical record. API-only sourcing: no model-recalled laureates or years.
// No CITES cross-references — ingesters produce facts, humans curate connections.
// Terms: https://www.nobelprize.org/about/terms-of-use-for-api-nobelprize-org-and-data-nobelprize-org/
// Run: npx tsx scripts/ingest-nobel-prizes.ts --dry-run
//      npx tsx scripts/ingest-nobel-prizes.ts --sample 10
//      npx tsx scripts/ingest-nobel-prizes.ts --full [--category all|physics|...] [--limit N]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()
const NOBEL_BASE = 'https://api.nobelprize.org/2.1'
const INGESTED_BY = 'nobel_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocalizedString { en?: string; se?: string; no?: string }

interface ApiLaureate {
  id: string
  knownName?: LocalizedString
  fullName?: LocalizedString
  orgName?: LocalizedString   // organizations (e.g. Red Cross) carry orgName, not knownName
  nativeName?: string
  portion?: string
  sortOrder?: string
  motivation?: LocalizedString
}

interface ApiPrize {
  awardYear: string
  category: LocalizedString
  categoryFullName: LocalizedString
  dateAwarded?: string        // YYYY-MM-DD — present on most records, guard anyway
  prizeAmount?: number
  prizeAmountAdjusted?: number
  laureates?: ApiLaureate[]   // absent/empty for un-awarded years (e.g. WWII)
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── Category config ───────────────────────────────────────────────────────────

interface CategoryDef {
  cli: string       // CLI filter name + externalId slug
  apiName: string   // category.en as returned by the API
  apiCode: string   // nobelPrizeCategory query code
  webSlug: string   // nobelprize.org URL slug
  topicSlug: string
  topicName: string
  domain: string
}

const CATEGORIES: CategoryDef[] = [
  { cli: 'physics',    apiName: 'Physics',                apiCode: 'phy', webSlug: 'physics',           topicSlug: 'nobel-physics',    topicName: 'Nobel Prize in Physics',                  domain: 'science'   },
  { cli: 'chemistry',  apiName: 'Chemistry',              apiCode: 'che', webSlug: 'chemistry',         topicSlug: 'nobel-chemistry',  topicName: 'Nobel Prize in Chemistry',                domain: 'science'   },
  { cli: 'medicine',   apiName: 'Physiology or Medicine', apiCode: 'med', webSlug: 'medicine',          topicSlug: 'nobel-medicine',   topicName: 'Nobel Prize in Physiology or Medicine',   domain: 'medicine'  },
  { cli: 'literature', apiName: 'Literature',             apiCode: 'lit', webSlug: 'literature',        topicSlug: 'nobel-literature', topicName: 'Nobel Prize in Literature',               domain: 'culture'   },
  { cli: 'peace',      apiName: 'Peace',                  apiCode: 'pea', webSlug: 'peace',             topicSlug: 'nobel-peace',      topicName: 'Nobel Peace Prize',                       domain: 'politics'  },
  { cli: 'economics',  apiName: 'Economic Sciences',      apiCode: 'eco', webSlug: 'economic-sciences', topicSlug: 'nobel-economics',  topicName: 'Nobel Prize in Economic Sciences',        domain: 'economics' },
]

const CATEGORY_BY_API_NAME = new Map(CATEGORIES.map(c => [c.apiName, c]))

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { mode: 'dry-run' | 'sample' | 'full'; category: string; limit: number; sampleN: number; verbose: boolean } {
  const args = process.argv.slice(2)

  const mode: 'dry-run' | 'sample' | 'full' = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --sample N | --full  [--category all|...] [--limit N] [--verbose]'); process.exit(1) as never })()

  const ci = args.indexOf('--category')
  const li = args.indexOf('--limit')
  const si = args.indexOf('--sample')

  return {
    mode,
    category: ci !== -1 ? (args[ci + 1] ?? 'all') : 'all',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: si !== -1 ? (parseInt(args[si + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting + HTTP with retry ──────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 250  // ms — polite spacing; only ~7 page fetches total

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    return res
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Fetch all prize-years (paginated) ─────────────────────────────────────────

async function fetchAllPrizes(): Promise<ApiPrize[]> {
  const PAGE = 100
  const all: ApiPrize[] = []
  let offset = 0

  for (;;) {
    const url = `${NOBEL_BASE}/nobelPrizes?offset=${offset}&limit=${PAGE}`
    const res = await fetchWithRetry(url)
    if (!res.ok) throw new Error(`Nobel API ${res.status} at offset ${offset}`)
    const data = await res.json() as { nobelPrizes?: ApiPrize[]; meta?: { count?: number } }
    const page = data.nobelPrizes ?? []
    all.push(...page)
    console.log(`  Fetched ${all.length}${data.meta?.count ? `/${data.meta.count}` : ''} prize-years`)
    if (page.length < PAGE) break
    offset += PAGE
  }

  return all
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Organizations carry orgName; people carry knownName/fullName.
function getLaureateName(l: ApiLaureate): string | null {
  return l.knownName?.en ?? l.fullName?.en ?? l.orgName?.en ?? l.nativeName ?? null
}

function parseAwardDate(prize: ApiPrize): { date: Date; precision: 'DAY' | 'YEAR' } | null {
  if (prize.dateAwarded) {
    const d = new Date(prize.dateAwarded)
    if (!isNaN(d.getTime())) return { date: d, precision: 'DAY' }
  }
  const yearNum = parseInt(prize.awardYear, 10)
  if (!yearNum || isNaN(yearNum)) return null
  // No dateAwarded on record — fall back to year-only precision, never invent a day.
  return { date: new Date(Date.UTC(yearNum, 0, 1)), precision: 'YEAR' }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// Root 'nobel-prize' + one child per category, each with its appropriate domain.
async function ensureTopics(): Promise<{ root: string; byCategory: Map<string, string> }> {
  const root = await ensureTopic('nobel-prize', 'Nobel Prize', 'science')
  const byCategory = new Map<string, string>()
  for (const c of CATEGORIES) {
    const id = await ensureTopic(c.topicSlug, c.topicName, c.domain, 'nobel-prize')
    byCategory.set(c.cli, id)
  }
  return { root, byCategory }
}

// ── Core: ingest one (laureate, prize-year) record ────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  prize: ApiPrize,
  laureate: ApiLaureate,
  cat: CategoryDef,
  topicIds: string[],
): Promise<IngestResult> {
  const year = prize.awardYear
  const externalId = `nobel_laureate_${laureate.id}_${cat.cli}_${year}`

  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true, ingestedBy: true } })
  if (existing) return 'skipped'

  const name = getLaureateName(laureate)
  if (!name) return 'skipped'

  const awarded = parseAwardDate(prize)
  if (!awarded) return 'skipped'

  const fullName = prize.categoryFullName.en ?? `Nobel Prize in ${cat.apiName}`
  const motivation = laureate.motivation?.en?.trim()
  const claimText = motivation
    ? `${name} was awarded ${fullName} ${year} "${motivation}".`
    : `${name} was awarded ${fullName} ${year}.`

  const webUrl = `https://www.nobelprize.org/prizes/${cat.webSlug}/${year}/summary/`
  const apiUrl = `${NOBEL_BASE}/nobelPrizes?nobelPrizeCategory=${cat.apiCode}&nobelPrizeYear=${year}`

  const source = await tx.source.create({
    data: {
      name: `Nobel Prize record: ${name}, ${cat.apiName} ${year}`,
      url: webUrl,
      publishedAt: awarded.date,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `nobel_source_laureate_${laureate.id}_${cat.cli}_${year}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: awarded.date,
      claimEmergedPrecision: awarded.precision,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId,
      metadata: {
        dataset: 'nobel_v1',
        laureateId: laureate.id,
        category: cat.apiName,
        categorySlug: cat.cli,
        awardYear: year,
        dateAwarded: prize.dateAwarded ?? null,
        portion: laureate.portion ?? null,
        prizeAmount: prize.prizeAmount ?? null,
        prizeAmountAdjusted: prize.prizeAmountAdjusted ?? null,
        sourceApiUrl: apiUrl,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 95,
      reason: 'Nobel Foundation institutional record — prize award as HARD_FACT',
      changedAt: awarded.date,
    },
  })

  for (const topicId of topicIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, category, limit, sampleN, verbose } = parseArgs()

  if (category !== 'all' && !CATEGORIES.some(c => c.cli === category)) {
    console.error(`Unknown category: ${category}. Use: all | ${CATEGORIES.map(c => c.cli).join(' | ')}`)
    process.exit(1)
  }

  console.log(`\n── Pipeline 10: Nobel Prize Laureates ────────────────────────────────`)
  console.log(`Mode: ${mode} | Category: ${category} | Limit: ${limit || 'all'}`)

  // Step 1: Topics — skipped in dry-run (no DB contact before data is reviewed)
  let root = ''
  let byCategory = new Map<string, string>()
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring Nobel Prize topics...')
    const topics = await ensureTopics()
    root = topics.root
    byCategory = topics.byCategory
    console.log(`  Root topic (nobel-prize): ${root}`)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch all prizes
  console.log('\nStep 2: Fetching prize-years from Nobel Foundation API...')
  const prizes = await fetchAllPrizes()

  // Build candidate records list for dry-run and sample planning
  interface CandidateRecord {
    prize: ApiPrize
    laureate: ApiLaureate
    cat: CategoryDef
    name: string
    year: string
    motivation: string | null
    webUrl: string
    externalId: string
    claimText: string
    topicIds: string[]
  }

  const candidates: CandidateRecord[] = []
  let unawarded = 0
  const categoryBreakdown: Record<string, number> = {}

  for (const prize of prizes) {
    const cat = CATEGORY_BY_API_NAME.get(prize.category?.en ?? '')
    if (!cat) {
      console.warn(`  Warning: unmapped category "${prize.category?.en}" (${prize.awardYear}) — skipping`)
      continue
    }
    if (category !== 'all' && cat.cli !== category) continue

    const laureates = prize.laureates ?? []
    if (laureates.length === 0) { unawarded++; continue }

    const topicIds = [root, byCategory.get(cat.cli)!]
    const awarded = parseAwardDate(prize)

    for (const laureate of laureates) {
      const name = getLaureateName(laureate)
      if (!name || !awarded) continue

      const fullName = prize.categoryFullName.en ?? `Nobel Prize in ${cat.apiName}`
      const motivation = laureate.motivation?.en?.trim() ?? null
      const claimText = motivation
        ? `${name} was awarded ${fullName} ${prize.awardYear} "${motivation}".`
        : `${name} was awarded ${fullName} ${prize.awardYear}.`

      candidates.push({
        prize,
        laureate,
        cat,
        name,
        year: prize.awardYear,
        motivation,
        webUrl: `https://www.nobelprize.org/prizes/${cat.webSlug}/${prize.awardYear}/summary/`,
        externalId: `nobel_laureate_${laureate.id}_${cat.cli}_${prize.awardYear}`,
        claimText,
        topicIds,
      })
      categoryBreakdown[cat.apiName] = (categoryBreakdown[cat.apiName] ?? 0) + 1
    }
  }

  console.log(`\nFetch complete: ${prizes.length} prize-years, ${candidates.length} laureate records, ${unawarded} un-awarded years skipped`)
  console.log('Category breakdown:')
  for (const [cat, n] of Object.entries(categoryBreakdown).sort()) {
    console.log(`  ${cat}: ${n}`)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no claim/source/edge DB writes)...')

    const sample = candidates.slice(0, 10).map(c => ({
      claimText: c.claimText,
      externalId: c.externalId,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      year: c.year,
      category: c.cat.apiName,
      topicSlug: c.cat.topicSlug,
      source: {
        url: c.webUrl,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    }))

    const output = {
      runDate: new Date().toISOString(),
      totalPrizeYears: prizes.length,
      totalLaureateRecords: candidates.length,
      unAwardedYearsSkipped: unawarded,
      categoryBreakdown,
      sample,
    }

    fs.writeFileSync('pipeline-10-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-10-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample run.')
    return
  }

  // ── Sample run ─────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const rows = candidates.slice(0, sampleN)
    console.log(`\nSample run: ${rows.length} rows in rolled-back transaction...`)
    let ingested = 0, skipped = 0, errors = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const result = await writeRow(tx, row.prize, row.laureate, row.cat, row.topicIds)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] ${row.name} — ${row.cat.apiName} ${row.year}`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nRolled back. Would have ingested: ${ingested}, skipped: ${skipped}, errors: ${errors}`)
      } else {
        throw e
      }
    }

    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback DB count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  const rows = limit > 0 ? candidates.slice(0, limit) : candidates
  console.log(`\nFull ingestion: ${rows.length} rows (per-row transactions)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const row of rows) {
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, row.prize, row.laureate, row.cat, row.topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 50 === 0) {
        console.log(`  Progress: ingested ${counts.ingested}/${rows.length} — ${row.name} ${row.year}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${row.externalId} — ${msg}`)
      counts.errors++
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  // Verify against DB state — do not trust in-script counters (AGENTS.md).
  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (dbClaims !== counts.ingested) {
    console.error(`  WARNING: DB claim count (${dbClaims}) does not match ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
