// Pipeline 92 — Luxembourg Legislation (luxembourg_legislation_v1)
// Dataset: Luxembourg Legilux "Casemates" via SPARQL endpoint
// Ontology: Jolux — http://data.legilux.public.lu/resource/ontology/jolux#
// Endpoint: https://data.legilux.public.lu/sparqlendpoint (POST, form-urlencoded)
// Scope:  In-force Laws (LOI) and Grand-Ducal Regulations (RGD). ~17,800 records.
// Note:   Previous attempts used /sparql, which returns the Angular SPA HTML.
//         The actual SPARQL endpoint is /sparqlendpoint (found via Angular bundle).
// Run: set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-luxembourg-legislation.ts --dry-run
//      set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-luxembourg-legislation.ts --sample 5
//      set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-luxembourg-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'luxembourg_legislation_v1'
const PIPELINE = 'Pipeline 92'
const SPARQL_ENDPOINT = 'https://data.legilux.public.lu/sparqlendpoint'
const PAGE_SIZE = 200
const PAGE_DELAY_MS = 600

const JOLUX = 'http://data.legilux.public.lu/resource/ontology/jolux#'
const TYPE_LOI = 'http://data.legilux.public.lu/resource/authority/resource-type/LOI'
const TYPE_RGD = 'http://data.legilux.public.lu/resource/authority/resource-type/RGD'
const STATUS_IN_FORCE = 'http://data.legilux.public.lu/resource/authority/application-status/in-force'

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface SparqlBinding {
  work?: { value: string }
  title?: { value: string }
  dateDoc?: { value: string }
  typeDoc?: { value: string }
}

interface CandidateRecord {
  eliUri: string
  claimText: string
  dateStr: string
  dateObj: Date
  legalType: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '5', 10) || 5) : 5,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP / SPARQL ──────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function sparqlQuery(query: string, retries = 4): Promise<SparqlBinding[]> {
  const body = new URLSearchParams({ query }).toString()
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(SPARQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Accept': 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'EpistemicReceipts/1.0 (robert.contofalsky@rutgers.edu)',
        },
        body,
      })
      // 500 at out-of-range OFFSET = genuine end of results from this endpoint
      if (res.status === 500) return []
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay); delay *= 2; continue
      }
      if (!res.ok) throw new Error(`SPARQL ${res.status}: ${(await res.text()).slice(0, 120)}`)
      const data = await res.json() as { results: { bindings: SparqlBinding[] } }
      return data.results.bindings
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  SPARQL error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay); delay *= 2
    }
  }
  throw new Error(`SPARQL failed after ${retries} retries`)
}

function buildPageQuery(offset: number): string {
  return `PREFIX jolux: <${JOLUX}>
PREFIX lang: <http://publications.europa.eu/resource/authority/language/>
SELECT DISTINCT ?work ?title ?dateDoc ?typeDoc WHERE {
  ?work a jolux:Act ;
        jolux:typeDocument ?typeDoc ;
        jolux:dateDocument ?dateDoc ;
        jolux:inForceStatus <${STATUS_IN_FORCE}> ;
        jolux:isRealizedBy ?expr .
  ?expr jolux:title ?title ;
        jolux:language lang:FRA .
  FILTER(?typeDoc IN (
    <${TYPE_LOI}>,
    <${TYPE_RGD}>
  ))
  FILTER(STRSTARTS(STR(?work), "http://data.legilux.public.lu/eli/etat/leg/"))
} ORDER BY ?work LIMIT ${PAGE_SIZE} OFFSET ${offset}`
}

// ── Candidate building ─────────────────────────────────────────────────────────

function eliUriToExternalId(uri: string): string {
  // http://data.legilux.public.lu/eli/etat/leg/loi/2026/05/05/a226/jo
  // → lux_leg_loi_2026_05_05_a226_jo
  const match = uri.match(/\/eli\/etat\/(.+)$/)
  if (!match) return `lux_${uri.replace(/[^a-z0-9]/gi, '_')}`
  return `lux_${match[1].replace(/\//g, '_')}`
}

function buildCandidate(b: SparqlBinding, verbose: boolean): CandidateRecord | null {
  const uri = b.work?.value
  const rawTitle = b.title?.value
  const dateDoc = b.dateDoc?.value
  const typeUri = b.typeDoc?.value

  if (!uri || !rawTitle || !dateDoc || !typeUri) {
    if (verbose) console.log(`  Skip: missing required fields (uri=${uri}, title=${!!rawTitle}, date=${dateDoc})`)
    return null
  }

  const title = rawTitle.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
  if (!title) {
    if (verbose) console.log(`  Skip ${uri}: empty title after normalization`)
    return null
  }

  const dateObj = new Date(`${dateDoc}T00:00:00Z`)
  if (isNaN(dateObj.getTime())) {
    if (verbose) console.log(`  Skip ${uri}: invalid date "${dateDoc}"`)
    return null
  }

  const legalType = typeUri.split('/').pop() ?? 'ACT'
  const externalId = eliUriToExternalId(uri)
  const sourceExternalId = `${externalId}_src`
  const sourceUrl = `${uri}/fr/html`

  return {
    eliUri: uri,
    claimText: title,
    dateStr: dateDoc,
    dateObj,
    legalType,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: `Luxembourg ${legalType} — ${title.slice(0, 80)}`,
  }
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const all: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let offset = 0
  let page = 0
  let skipped = 0

  while (true) {
    const bindings = await sparqlQuery(buildPageQuery(offset))
    if (bindings.length === 0) break

    for (const b of bindings) {
      const rec = buildCandidate(b, verbose)
      if (!rec) { skipped++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      all.push(rec)
      if (hardLimit > 0 && all.length >= hardLimit) break
    }

    page++
    if (!verbose) process.stdout.write(`  Page ${page}: fetched ${all.length} total...\r`)
    else console.log(`  Page ${page} (offset ${offset}): ${all.length} total`)

    if (hardLimit > 0 && all.length >= hardLimit) break
    if (bindings.length < PAGE_SIZE) break

    offset += PAGE_SIZE
    await sleep(PAGE_DELAY_MS)
  }

  process.stdout.write('\n')
  if (skipped > 0) console.log(`  Skipped ${skipped} malformed records`)
  return all
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
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: rec.dateObj,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.dateObj,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          eli_uri: rec.eliUri,
          legal_type: rec.legalType,
          date: rec.dateStr,
          country: 'Luxembourg',
          language: 'fr',
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
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

  console.log(`\n── ${PIPELINE}: Luxembourg Legislation (LOI + RGD) ──────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('parliament-luxembourg', 'Luxembourg Chamber of Deputies', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Luxembourg legislation via Legilux SPARQL endpoint...')
  console.log(`  Endpoint: ${SPARQL_ENDPOINT}`)
  console.log(`  Types: LOI (laws) + RGD (Grand-Ducal Regulations), in-force only`)
  const candidates = await fetchAllCandidates(
    mode === 'dry-run' ? 50 : mode === 'sample' ? sampleN : limit,
    verbose
  )
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      eliUri: r.eliUri,
      legalType: r.legalType,
      date: r.dateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: false,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      sparqlEndpoint: SPARQL_ENDPOINT,
      typesIngested: ['LOI', 'RGD'],
      totalCandidatesInDryRunSample: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-92-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-92-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.legalType} ${r.dateStr}] ${r.claimText.slice(0, 100)}${r.claimText.length > 100 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.claimText.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
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
