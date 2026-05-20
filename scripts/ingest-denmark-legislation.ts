// Pipeline 32 — Denmark Folketing Enacted Laws (denmark_legislation_v1)
// Dataset: ODA API (oda.ft.dk). Free, no API key required.
// Scope: Lovforslag (typeid=3) with lovnummer set — enacted laws passed by Folketing.
// Topic: dk-folketing (Folketing (Denmark), domain=government).
// Run: npx tsx scripts/ingest-denmark-legislation.ts --dry-run
//      npx tsx scripts/ingest-denmark-legislation.ts --sample 10
//      npx tsx scripts/ingest-denmark-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'denmark_legislation_v1'
const PIPELINE = 'Pipeline 32'
const API_BASE = 'https://oda.ft.dk/api'
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

interface OdaSag {
  id: number
  typeid: number
  titel?: string
  titelkort?: string
  lovnummer?: string | null
  lovnummerdato?: string | null
  nummer?: string | null
  nummerprefix?: string
  nummernumerisk?: string
  periodeid?: number
}

interface OdaPeriode {
  id: number
  kode: string
  titel: string
}

interface OdaPage<T> {
  'odata.count'?: string
  value: T[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  sagId: number
  nummer: string
  claimText: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
  lovnummer: string
  periodeTitel: string
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

async function fetchJson<T>(url: string, retries = 4): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`ODA API ${res.status} at ${url}`)
      return await res.json() as T
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at ${url}`)
}

// ── Load Periode map ───────────────────────────────────────────────────────────

async function loadPeriodeMap(): Promise<Map<number, OdaPeriode>> {
  const map = new Map<number, OdaPeriode>()
  let skip = 0
  while (true) {
    const url = `${API_BASE}/Periode?$format=json&$select=id,kode,titel&$top=100&$skip=${skip}`
    const page = await fetchJson<OdaPage<OdaPeriode>>(url)
    for (const p of page.value) map.set(p.id, p)
    if (page.value.length < 100) break
    skip += 100
    await sleep(300)
  }
  return map
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(
  sag: OdaSag,
  periodeMap: Map<number, OdaPeriode>,
  verbose: boolean,
): CandidateRecord | null {
  const lovnummer = sag.lovnummer?.trim() ?? ''
  if (!lovnummer) {
    if (verbose) console.log(`  Skip sag ${sag.id}: no lovnummer`)
    return null
  }

  const dateStr = sag.lovnummerdato?.slice(0, 10)
  if (!dateStr) {
    if (verbose) console.log(`  Skip sag ${sag.id}: no lovnummerdato`)
    return null
  }
  const enactedDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip sag ${sag.id}: invalid date ${dateStr}`)
    return null
  }

  const claimText = (sag.titel ?? sag.titelkort ?? '').trim()
  if (!claimText) {
    if (verbose) console.log(`  Skip sag ${sag.id}: no titel`)
    return null
  }

  const nummer = (sag.nummer ?? `L${sag.nummernumerisk ?? sag.id}`).trim()
  const periode = sag.periodeid ? periodeMap.get(sag.periodeid) : undefined
  const periodeTitel = periode?.titel ?? String(sag.periodeid ?? '')
  const periodeKode = periode?.kode ?? ''
  const numNum = (sag.nummernumerisk ?? '').trim()

  const sourceUrl = periodeKode && numNum
    ? `https://www.ft.dk/samling/${periodeKode}/lovforslag/L${numNum}/index.htm`
    : `https://oda.ft.dk/api/Sag(${sag.id})?$format=json`

  const externalId = `dk_folketing_sag_${sag.id}`
  const sourceExternalId = `dk_folketing_source_${sag.id}`
  const sourceName = `Folketing ${periodeTitel} ${nummer}`

  return {
    sagId: sag.id,
    nummer,
    claimText,
    enactedDate,
    enactedDateStr: dateStr,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName,
    lovnummer,
    periodeTitel,
  }
}

// ── Fetch all enacted laws ─────────────────────────────────────────────────────

async function fetchAllEnactedLaws(
  periodeMap: Map<number, OdaPeriode>,
  hardLimit: number,
  verbose: boolean,
): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let total = -1
  let skippedMalformed = 0
  let skip = 0
  let pagesFetched = 0

  while (true) {
    const url = `${API_BASE}/Sag?$format=json&$filter=typeid+eq+3+and+lovnummer+ne+null`
      + `&$select=id,titel,titelkort,lovnummer,lovnummerdato,nummer,nummerprefix,nummernumerisk,periodeid`
      + `&$orderby=lovnummerdato+desc&$top=${PAGE_SIZE}&$skip=${skip}`
      + (pagesFetched === 0 ? '&$inlinecount=allpages' : '')

    const page = await fetchJson<OdaPage<OdaSag>>(url)
    pagesFetched++

    if (total === -1 && page['odata.count']) {
      total = parseInt(page['odata.count'], 10) || 0
      console.log(`  API reports ${total} enacted laws total`)
    }

    if (page.value.length === 0) break

    let newOnPage = 0
    for (const sag of page.value) {
      const rec = buildCandidate(sag, periodeMap, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break
    if (page.value.length < PAGE_SIZE) break
    if (newOnPage === 0) break

    if (verbose) console.log(`  ...page ${pagesFetched}: cumulative ${candidates.length}/${total}`)
    skip += PAGE_SIZE
    await sleep(PAGE_DELAY_MS)
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
        text: rec.claimText,
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
          sagId: rec.sagId,
          nummer: rec.nummer,
          lovnummer: rec.lovnummer,
          periodeTitel: rec.periodeTitel,
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

  console.log(`\n── ${PIPELINE}: Denmark Folketing Enacted Laws ────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  console.log('\nStep 1: Loading Periode (parliamentary session) map...')
  const periodeMap = await loadPeriodeMap()
  console.log(`  Loaded ${periodeMap.size} Periode records`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 2: Ensuring topics...')
    topicId = await ensureTopic('dk-folketing', 'Folketing (Denmark)', 'government')
  } else {
    console.log('\nStep 2: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 3: Fetching enacted laws from ODA API...')
  const candidates = await fetchAllEnactedLaws(periodeMap, limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      sagId: r.sagId,
      nummer: r.nummer,
      lovnummer: r.lovnummer,
      periodeTitel: r.periodeTitel,
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

    fs.writeFileSync('pipeline-32-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-32-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
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

  console.log(`\nStep 4: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
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
