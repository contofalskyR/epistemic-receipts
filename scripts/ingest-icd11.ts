// Pipeline 11 — ICD-11 Disease Classifications
// Dataset: WHO ICD-11 MMS Linearization API (id.who.int) — canonical global disease taxonomy.
// API is free; requires one-time registration at https://icd.who.int/icdapi/Account/Register
// Set env vars: ICD_API_CLIENT_ID, ICD_API_CLIENT_SECRET
// Run: npx tsx scripts/ingest-icd11.ts --dry-run
//      npx tsx scripts/ingest-icd11.ts --sample 10
//      npx tsx scripts/ingest-icd11.ts --full [--chapter 01|02|...] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'icd11_v1'
const ICD_TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token'
const ICD_API_BASE = 'https://id.who.int'
const ICD_LINEARIZATION = 'mms'
const ICD_RELEASE = '2024-01'
const ICD_ROOT_URI = `${ICD_API_BASE}/icd/release/11/${ICD_RELEASE}/${ICD_LINEARIZATION}`
const ICD_BROWSER_BASE = `https://icd.who.int/browse/${ICD_RELEASE}/${ICD_LINEARIZATION}/en`

// ── Types ─────────────────────────────────────────────────────────────────────

interface IcdEntity {
  '@id': string
  title: { '@value': string }
  code?: string
  classKind: 'chapter' | 'block' | 'category'
  child?: string[]
  parent?: string[]
  browserUrl?: string
}

interface IcdRoot {
  child: string[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  uri: string
  linearizationId: string
  code: string
  title: string
  classKind: 'chapter' | 'block' | 'category'
  chapterNum: string
  chapterTitle: string
  externalId: string
  claimText: string
  sourceUrl: string
  apiUrl: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --sample N | --full  [--chapter XX] [--limit N] [--verbose]'); process.exit(1) as never })()

  const ci = args.indexOf('--chapter')
  const li = args.indexOf('--limit')
  const si = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    chapterFilter: ci !== -1 ? (args[ci + 1] ?? null) : null,
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: si !== -1 ? (parseInt(args[si + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

let bearerToken = ''
let tokenExpiresAt = 0

async function getToken(): Promise<string> {
  if (bearerToken && Date.now() < tokenExpiresAt - 60_000) return bearerToken

  const clientId = process.env.ICD_API_CLIENT_ID
  const clientSecret = process.env.ICD_API_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('\nMissing ICD API credentials.')
    console.error('Register at https://icd.who.int/icdapi/Account/Register then set:')
    console.error('  ICD_API_CLIENT_ID=your_client_id')
    console.error('  ICD_API_CLIENT_SECRET=your_client_secret')
    process.exit(1)
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'icdapi_access',
  })

  const res = await fetch(ICD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`WHO token request failed (${res.status}): ${txt}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  bearerToken = data.access_token
  tokenExpiresAt = Date.now() + data.expires_in * 1000
  return bearerToken
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 500

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function icdFetch<T>(url: string, retries = 5): Promise<T> {
  // WHO API returns child URIs with http:// but authenticated requests require https://
  const secureUrl = url.replace(/^http:\/\//, 'https://')
  let delay = 1500
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const token = await getToken()
    try {
      const res = await fetch(secureUrl, {
        headers: {
          Accept: 'application/json',
          'API-Version': 'v2',
          'Accept-Language': 'en',
          Authorization: `Bearer ${token}`,
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) {
        throw new Error(`ICD API ${res.status} at ${secureUrl}`)
      }
      return res.json() as Promise<T>
    } catch (err) {
      // Network errors (GOAWAY, connection reset) — retry with backoff
      if (attempt < retries && err instanceof Error && err.message !== `ICD API`) {
        const isNetworkError = err.cause !== undefined || err.message.includes('fetch failed')
        if (isNetworkError) {
          console.warn(`  Network error (attempt ${attempt + 1}/${retries + 1}) — retrying in ${delay}ms: ${err.message}`)
          await sleep(delay)
          delay = Math.min(delay * 2, 10000)
          continue
        }
      }
      throw err
    }
  }
  throw new Error(`Failed after ${retries} retries: ${secureUrl}`)
}

// ── Tree traversal ────────────────────────────────────────────────────────────

function extractLinearizationId(uri: string): string {
  // URIs like https://id.who.int/icd/release/11/2024-01/mms/12345678
  const parts = uri.split('/')
  return parts[parts.length - 1] ?? uri
}

// Traverse children of a URI up to a given depth.
// Yields CandidateRecords for entities that have a code (blocks and categories).
async function* traverse(
  uri: string,
  chapterNum: string,
  chapterTitle: string,
  depth: number,
  maxDepth: number,
): AsyncGenerator<CandidateRecord> {
  if (depth > maxDepth) return

  const entity = await icdFetch<IcdEntity>(uri)
  const title = entity.title['@value']
  const code = entity.code
  const classKind = entity.classKind
  const linearizationId = extractLinearizationId(entity['@id'])
  const browserUrl = `${ICD_BROWSER_BASE}#${linearizationId}`

  if (code && (classKind === 'block' || classKind === 'category')) {
    const claimText = classKind === 'category'
      ? `WHO ICD-11 code ${code} classifies "${title}" under Chapter ${chapterNum} (${chapterTitle}).`
      : `WHO ICD-11 code block ${code} groups "${title}" under Chapter ${chapterNum} (${chapterTitle}).`

    yield {
      uri,
      linearizationId,
      code,
      title,
      classKind,
      chapterNum,
      chapterTitle,
      externalId: `icd11_${linearizationId}`,
      claimText,
      sourceUrl: browserUrl,
      apiUrl: uri,
    }
  }

  if (entity.child && depth < maxDepth) {
    for (const childUri of entity.child) {
      yield* traverse(childUri, chapterNum, chapterTitle, depth + 1, maxDepth)
    }
  }
}

// Fetch chapters from the root linearization.
async function fetchChapters(): Promise<{ uri: string; num: string; title: string }[]> {
  const root = await icdFetch<IcdRoot>(ICD_ROOT_URI)
  const chapters: { uri: string; num: string; title: string }[] = []

  for (const childUri of root.child) {
    const entity = await icdFetch<IcdEntity>(childUri)
    const title = entity.title['@value']
    const code = entity.code ?? String(chapters.length + 1).padStart(2, '0')
    chapters.push({ uri: childUri, num: code, title })
  }

  return chapters
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

async function ensureRootTopic(): Promise<string> {
  return ensureTopic('icd-11', 'ICD-11 Disease Classifications', 'medicine')
}

async function ensureChapterTopic(chapterNum: string, chapterTitle: string): Promise<string> {
  const slug = `icd-11-ch${chapterNum.replace(/\s/g, '').toLowerCase()}`
  const name = `ICD-11 Chapter ${chapterNum}: ${chapterTitle}`
  return ensureTopic(slug, name, 'medicine', 'icd-11')
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  rootTopicId: string,
  chapterTopicId: string,
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `ICD-11 ${rec.code}: ${rec.title}`,
      url: rec.sourceUrl,
      publishedAt: new Date('2024-01-01'),
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `icd11_source_${rec.linearizationId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: new Date('2024-01-01'),
      claimEmergedPrecision: 'YEAR',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        code: rec.code,
        classKind: rec.classKind,
        chapterNum: rec.chapterNum,
        chapterTitle: rec.chapterTitle,
        linearizationId: rec.linearizationId,
        release: ICD_RELEASE,
        sourceApiUrl: rec.apiUrl,
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
      reason: 'WHO ICD-11 official classification — institutional taxonomy as HARD_FACT',
      changedAt: new Date('2024-01-01'),
    },
  })

  for (const topicId of [rootTopicId, chapterTopicId]) {
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
  const { mode, chapterFilter, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── Pipeline 11: ICD-11 Disease Classifications ───────────────────────`)
  console.log(`Mode: ${mode} | Chapter filter: ${chapterFilter ?? 'all'} | Limit: ${limit || 'all'}`)

  // Step 1: Topics (skipped in dry-run)
  let rootTopicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring ICD-11 root topic...')
    rootTopicId = await ensureRootTopic()
    console.log(`  Root topic (icd-11): ${rootTopicId}`)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch chapters from WHO API
  console.log('\nStep 2: Fetching ICD-11 chapters from WHO API...')
  const chapters = await fetchChapters()
  console.log(`  Found ${chapters.length} chapters`)

  const filteredChapters = chapterFilter
    ? chapters.filter(c => c.num === chapterFilter)
    : chapters

  if (filteredChapters.length === 0) {
    console.error(`No chapters match filter "${chapterFilter}". Available: ${chapters.map(c => c.num).join(', ')}`)
    process.exit(1)
  }

  // Step 3: Collect candidates (2 levels deep: blocks + categories)
  console.log('\nStep 3: Traversing ICD-11 tree (blocks + categories)...')
  const candidates: CandidateRecord[] = []
  const chapterBreakdown: Record<string, number> = {}

  for (const chapter of filteredChapters) {
    console.log(`  Chapter ${chapter.num}: ${chapter.title}`)
    const entity = await icdFetch<IcdEntity>(chapter.uri)
    if (!entity.child) continue

    for (const blockUri of entity.child) {
      for await (const rec of traverse(blockUri, chapter.num, chapter.title, 0, 1)) {
        candidates.push(rec)
        chapterBreakdown[`Ch ${chapter.num}`] = (chapterBreakdown[`Ch ${chapter.num}`] ?? 0) + 1
      }
    }
  }

  console.log(`\nTotal candidates: ${candidates.length}`)
  if (Object.keys(chapterBreakdown).length > 0) {
    console.log('Chapter breakdown:')
    for (const [ch, n] of Object.entries(chapterBreakdown)) {
      console.log(`  ${ch}: ${n}`)
    }
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      code: r.code,
      classKind: r.classKind,
      chapterNum: r.chapterNum,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      source: { url: r.sourceUrl, methodologyType: 'primary' },
    }))

    const output = {
      runDate: new Date().toISOString(),
      totalCandidates: candidates.length,
      chaptersTraversed: filteredChapters.length,
      chapterBreakdown,
      sample,
    }

    fs.writeFileSync('pipeline-11-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-11-dry-run-sample.json')
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
          const chapterTopicId = await ensureChapterTopic(row.chapterNum, row.chapterTitle)
          const result = await writeRow(tx, row, rootTopicId, chapterTopicId)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] ${row.code} — ${row.title}`)
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
      const chapterTopicId = await ensureChapterTopic(row.chapterNum, row.chapterTitle)
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, row, rootTopicId, chapterTopicId),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 100 === 0) {
        console.log(`  Progress: ${counts.ingested}/${rows.length} — ${row.code} ${row.title}`)
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
