// Pipeline 38 — Italy Parlamento Italiano Enacted Laws (italy_legislation_v1)
// Dataset: Normattiva OpenData API (dati.normattiva.it)
//          Free, no API key required.
// Scope: All Leggi (LEGGE type) enacted since 1948-01-01.
// API:   POST https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/avanzata
// Topic: it-parlamento (Parlamento Italiano, domain=government).
// Run: npx tsx scripts/ingest-italy-legislation.ts --dry-run
//      npx tsx scripts/ingest-italy-legislation.ts --sample 10
//      npx tsx scripts/ingest-italy-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'italy_legislation_v1'
const PIPELINE = 'Pipeline 38'
const API_BASE = 'https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1'
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface NormativaAtto {
  numeroAtto: string
  numeroProvvedimento: string
  annoProvvedimento: string
  titoloAtto: string | null
  descrizioneAtto: string | null
  denominazioneAtto: string
  dataEmanazione: string | null
  dataGU: string | null
  codiceRedazionale: string | null
}

interface SearchResponse {
  listaAtti: NormativaAtto[]
  numeroPagine: number
  numeroAttiTrovati: number
  paginaCorrente: number
}

interface CandidateRecord {
  year: string
  number: string
  title: string
  descrizionAtto: string
  enactedDate: Date
  enactedDateStr: string
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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchPage(page: number, retries = 4): Promise<SearchResponse> {
  const url = `${API_BASE}/ricerca/avanzata`
  const body = {
    denominazioneAtto: 'LEGGE',
    dataInizioEmanazione: '1948-01-01',
    dataFineEmanazione: '2099-12-31',
    paginazione: {
      paginaCorrente: page,
      numeroElementiPerPagina: PAGE_SIZE,
    },
  }
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
        },
        body: JSON.stringify(body),
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at page ${page} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Normattiva API ${res.status} at page ${page}`)
      return await res.json() as SearchResponse
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error fetching page ${page}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at page ${page}`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(atto: NormativaAtto, verbose: boolean): CandidateRecord | null {
  const year = (atto.annoProvvedimento ?? '').trim()
  const number = (atto.numeroProvvedimento ?? atto.numeroAtto ?? '').trim()

  if (!year || !number) {
    if (verbose) console.log(`  Skip: missing year/number (year=${year}, number=${number})`)
    return null
  }

  // Clean title: strip surrounding brackets and editorial code suffix
  const rawTitle = atto.titoloAtto ?? atto.descrizioneAtto ?? ''
  const title = rawTitle.replace(/^\[/, '').replace(/\([A-Z0-9]+\)\s*\]$/, '').replace(/\]$/, '').trim()

  if (!title) {
    if (verbose) console.log(`  Skip ${year}/${number}: no title`)
    return null
  }

  const rawDate = atto.dataEmanazione ?? atto.dataGU ?? ''
  let enactedDateStr: string
  let enactedDate: Date

  if (rawDate) {
    enactedDateStr = rawDate.slice(0, 10)
    enactedDate = new Date(enactedDateStr + 'T00:00:00Z')
  } else if (/^\d{4}$/.test(year)) {
    enactedDateStr = `${year}-01-01`
    enactedDate = new Date(enactedDateStr + 'T00:00:00Z')
  } else {
    if (verbose) console.log(`  Skip ${year}/${number}: no date`)
    return null
  }

  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip ${year}/${number}: invalid date`)
    return null
  }

  const externalId = `it_legge_${year}_${number}`
  const sourceExternalId = `it_legge_source_${year}_${number}`
  const sourceUrl = `https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:${year};${number}`

  return {
    year,
    number,
    title,
    descrizionAtto: atto.descrizioneAtto ?? `Legge ${year}, n. ${number}`,
    enactedDate,
    enactedDateStr,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: `Italy Legge ${year}, n. ${number}`,
  }
}

// ── Fetch all laws ─────────────────────────────────────────────────────────────

async function fetchAllLaws(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skippedMalformed = 0
  let page = 1

  // First page to get total
  const firstPage = await fetchPage(1)
  const totalPages = firstPage.numeroPagine
  console.log(`  Total laws found: ${firstPage.numeroAttiTrovati}, pages: ${totalPages}`)

  for (const atto of firstPage.listaAtti) {
    const rec = buildCandidate(atto, verbose)
    if (!rec) { skippedMalformed++; continue }
    if (seenIds.has(rec.externalId)) continue
    seenIds.add(rec.externalId)
    candidates.push(rec)
    if (hardLimit > 0 && candidates.length >= hardLimit) break
  }

  if (hardLimit > 0 && candidates.length >= hardLimit) return candidates

  for (page = 2; page <= totalPages; page++) {
    await sleep(PAGE_DELAY_MS)
    const data = await fetchPage(page)

    if (!data.listaAtti || data.listaAtti.length === 0) break

    let newOnPage = 0
    for (const atto of data.listaAtti) {
      const rec = buildCandidate(atto, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break

    if (verbose || page % 50 === 0) {
      console.log(`  ...page ${page}/${totalPages}: cumulative ${candidates.length}`)
    } else {
      process.stdout.write(`  page ${page}/${totalPages} | ${candidates.length} candidates...\r`)
    }
  }

  if (skippedMalformed > 0) console.log(`  Skipped ${skippedMalformed} malformed/incomplete records`)
  return candidates
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
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          year: rec.year,
          number: rec.number,
          descrizioneAtto: rec.descrizionAtto,
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

  console.log(`\n── ${PIPELINE}: Italy Parlamento Italiano Enacted Laws ─────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('it-parlamento', 'Parlamento Italiano', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Italian laws from Normattiva OpenData API...')
  const candidates = await fetchAllLaws(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      year: r.year,
      number: r.number,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-38-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-38-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.title.slice(0, 110)}${r.title.length > 110 ? '…' : ''}`)
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
