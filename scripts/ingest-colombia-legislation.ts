// Pipeline 46 — Colombia Congreso de Colombia Enacted Laws (colombia_legislation_v1)
// Dataset: SUIN-Juriscol — Sistema Único de Información Normativa
// API:     Azure Cognitive Search at searchmjd.search.windows.net
//          Public read-only key exposed in www.suin-juriscol.gov.co frontend
// Scope:   All Leyes (subtipo=LEY*), ~12,919 records
// Topic:   co-congreso (Congreso de Colombia, domain=government)
// Run: npx tsx scripts/ingest-colombia-legislation.ts --dry-run
//      npx tsx scripts/ingest-colombia-legislation.ts --sample 10
//      npx tsx scripts/ingest-colombia-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'colombia_legislation_v1'
const PIPELINE = 'Pipeline 46'
const SEARCH_URL = 'https://searchmjd.search.windows.net/indexes/suinjuriscol-index/docs'
const API_KEY = process.env.COLOMBIA_SEARCH_KEY
if (!API_KEY) {
  console.error('Missing COLOMBIA_SEARCH_KEY environment variable')
  process.exit(1)
}
const API_VERSION = '2019-05-06'

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface SuinRecord {
  ID: string
  titulo: string
  subtipo: string
  epigrafe: string | null
  vigencia: string[] | null
  sector: string[] | null
  entidad_emisora: string | null
  nombre_comun: string | null
}

interface CandidateRecord {
  id: string
  lawNumber: string
  lawYear: string
  title: string
  epigrafe: string
  enactedDate: Date
  enactedDateStr: string
  enactedPrecision: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Title parsing ──────────────────────────────────────────────────────────────

// titulo format: "\r\nLEY 12 DE 1942" or "\r\nLEY 1776 DE 2016"
function parseTitulo(titulo: string): { number: string; year: string } | null {
  const m = titulo.trim().match(/^LEY\s+(\d+)\s+DE\s+(\d{4})$/i)
  if (!m) return null
  return { number: m[1], year: m[2] }
}

// ── Fetch page ─────────────────────────────────────────────────────────────────

async function fetchPage(skip: number, top: number): Promise<{ records: SuinRecord[]; total: number | null }> {
  const params = new URLSearchParams({
    'api-version': API_VERSION,
    search: 'ley',
    '$select': 'ID,titulo,subtipo,epigrafe,vigencia,sector,entidad_emisora,nombre_comun',
    '$top': String(top),
    '$skip': String(skip),
  })
  if (skip === 0) params.set('$count', 'true')

  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: {
      'api-key': API_KEY,
      'Accept': 'application/json; odata.metadata=none',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} on skip=${skip}`)
  const data = await res.json() as { value: SuinRecord[]; '@odata.count'?: number }
  return {
    records: data.value ?? [],
    total: data['@odata.count'] ?? null,
  }
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(rec: SuinRecord, verbose: boolean): CandidateRecord | null {
  if (!rec.ID) return null

  // Only include Ley subtypes
  const subtipo = (rec.subtipo ?? '').toUpperCase()
  if (!subtipo.startsWith('LEY')) {
    if (verbose) console.log(`  Skip (subtipo=${rec.subtipo}): ${rec.titulo?.trim()}`)
    return null
  }

  const parsed = parseTitulo(rec.titulo ?? '')
  if (!parsed) {
    if (verbose) console.log(`  Skip (unparseable titulo): ${rec.titulo?.trim()}`)
    return null
  }

  const { number, year } = parsed
  const yearNum = parseInt(year, 10)
  if (yearNum < 1819 || yearNum > 2099) {
    if (verbose) console.log(`  Skip (year out of range): ${rec.titulo?.trim()}`)
    return null
  }

  const epigrafe = rec.epigrafe?.trim() || ''
  const title = epigrafe || `Ley ${number} de ${year}`

  const enactedDate = new Date(`${year}-01-01T00:00:00Z`)
  const enactedDateStr = `${year}-01-01`
  const enactedPrecision = 'YEAR'

  const externalId = `co_ley_${year}_${number}`
  const sourceExternalId = `co_ley_source_${rec.ID}`
  const sourceUrl = `https://www.suin-juriscol.gov.co/viewDocument.asp?id=${rec.ID}`

  return {
    id: rec.ID,
    lawNumber: number,
    lawYear: year,
    title: title.slice(0, 1000),
    epigrafe,
    enactedDate,
    enactedDateStr,
    enactedPrecision,
    sourceUrl,
    externalId,
    sourceExternalId,
  }
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one record ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `Ley ${rec.lawNumber} de ${rec.lawYear}`.slice(0, 255),
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.title,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: rec.enactedPrecision as 'DAY' | 'MONTH' | 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          suinId: rec.id,
          lawNumber: rec.lawNumber,
          lawYear: rec.lawYear,
          epigrafe: rec.epigrafe.slice(0, 500),
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
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: Colombia Congreso de Colombia Enacted Laws ─────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('co-congreso', 'Congreso de Colombia', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Colombian laws from SUIN-Juriscol Azure Search API...')
  const TOP = 1000
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()

  // First page gets total count
  const first = await fetchPage(0, TOP)
  const total = first.total
  if (total !== null) console.log(`  Total laws found: ${total}`)

  for (const rec of first.records) {
    if (limit > 0 && candidates.length >= limit) break
    const cand = buildCandidate(rec, verbose)
    if (!cand || seenIds.has(cand.externalId)) continue
    seenIds.add(cand.externalId)
    candidates.push(cand)
  }

  let skip = TOP
  while (true) {
    if (limit > 0 && candidates.length >= limit) break
    const { records } = await fetchPage(skip, TOP)
    if (records.length === 0) break
    for (const rec of records) {
      if (limit > 0 && candidates.length >= limit) break
      const cand = buildCandidate(rec, verbose)
      if (!cand || seenIds.has(cand.externalId)) continue
      seenIds.add(cand.externalId)
      candidates.push(cand)
    }
    skip += TOP
    if (skip % 5000 === 0 || records.length < TOP) {
      process.stdout.write(`  ...skip=${skip}: ${candidates.length} candidates\n`)
    }
    if (records.length < TOP) break
  }

  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      suinId: r.id,
      lawNumber: r.lawNumber,
      lawYear: r.lawYear,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const { writeFileSync } = await import('fs')
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      sample,
    }
    writeFileSync('pipeline-46-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-46-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.lawYear}] Ley ${r.lawNumber}: ${r.title.slice(0, 100)}${r.title.length > 100 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample'
    ? candidates.slice(0, sampleN)
    : (limit > 0 ? candidates.slice(0, limit) : candidates)

  console.log(`\nStep 3: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 50

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}-${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    if (!verbose) {
      const done = Math.min(i + BATCH, rows.length)
      process.stdout.write(`  ${done}/${rows.length} processed...\r`)
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

  if (mode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
