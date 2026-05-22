// Pipeline 91 — Slovenia Legislation (slovenia_legislation_v1)
//
// Source: PISRS Register predpisov API (https://pisrs.si/api/filter/filter)
//   POST with {"nazivZbirke":["Register predpisov"]} returns all 15,374 Slovenian
//   legislative acts with full titles and dates.
//   Cursor-based pagination: nextCursorMark from each response is passed as
//   a URL query param to the next request (?cursorMark=<encoded>).
//   Page size is fixed at 10 by the server.
//
//   Fields used:
//     zunanjiId       — PISRS external ID (e.g. ZAKO8309, URED4488)
//     nazivAkta       — Full title of the act
//     datumSprejetja  — Adoption date (primary publishedAt)
//     datumObjave     — Publication date (fallback)
//     organSprejemaAliIzdaje — Enacting body
//     semafor.naziv   — Status label
//
// Run: set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-slovenia-legislation.ts --dry-run
//      set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-slovenia-legislation.ts --sample 5
//      set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-slovenia-legislation.ts --full [--limit N]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'slovenia_legislation_v1'
const PIPELINE = 'Pipeline 91'
const PISRS_BASE = 'https://pisrs.si'
const FILTER_API = `${PISRS_BASE}/api/filter/filter`
const REQUEST_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface PisrsRecord {
  interniId: number
  zunanjiId: string
  nazivAkta: string
  datumSprejetja: string | null
  datumObjave: string | null
  organSprejemaAliIzdaje: string | null
  semafor: { id: number; naziv: string } | null
  [key: string]: unknown
}

interface CandidateRecord {
  pisrsId: string
  legalType: string
  typeLabel: string
  claimText: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
  adoptionDate: Date | null
  title: string
  enactingBody: string | null
  statusLabel: string | null
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

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchPage(cursorMark: string | null): Promise<{ seznam: PisrsRecord[]; nextCursor: string; total: number }> {
  const url = cursorMark
    ? `${FILTER_API}?cursorMark=${encodeURIComponent(cursorMark)}`
    : FILTER_API

  let delay = 2000
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EpistemicReceipts/1.0 (robert.contofalsky@rutgers.edu)',
        },
        body: JSON.stringify({ nazivZbirke: ['Register predpisov'] }),
      })

      if ([429, 502, 503, 504].includes(res.status) && attempt < 3) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)

      const json = await res.json()
      if (json.error) throw new Error(`API error: ${json.error}`)

      const data = json.data
      return {
        seznam: data.seznam as PisrsRecord[],
        nextCursor: data.nextCursorMark as string,
        total: data.numOfAllResultsForIndex as number,
      }
    } catch (err) {
      if (attempt >= 3) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error('Failed after 3 retries')
}

// ── Record building ────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  ZAKO: 'a law (Zakon)',
  URED: 'a decree (Uredba)',
  PRAV: 'a regulation (Pravilnik)',
  ODLO: 'an ordinance (Odlok)',
  SKLE: 'a decision (Sklep)',
  UKAZ: 'a presidential order (Ukaz)',
  DRUG: 'a legislative act',
}

function getLegalTypeLabel(zunanjiId: string): { legalType: string; typeLabel: string } {
  const prefix = zunanjiId.slice(0, 4).toUpperCase()
  const typeLabel = TYPE_LABELS[prefix] ?? 'a legislative act'
  return { legalType: prefix, typeLabel }
}

function buildRecord(item: PisrsRecord): CandidateRecord {
  const { legalType, typeLabel } = getLegalTypeLabel(item.zunanjiId)
  const sourceUrl = `${PISRS_BASE}/pregledPredpisa?id=${item.zunanjiId}`
  const externalId = `si_predpis_${item.zunanjiId.toLowerCase()}`
  const adoptionDate = item.datumSprejetja
    ? new Date(item.datumSprejetja)
    : item.datumObjave
    ? new Date(item.datumObjave)
    : null

  return {
    pisrsId: item.zunanjiId,
    legalType,
    typeLabel,
    claimText: `${item.nazivAkta} is ${typeLabel} enacted by the Republic of Slovenia.`,
    sourceUrl,
    externalId,
    sourceExternalId: `${externalId}_src`,
    sourceName: `Slovenia — ${item.nazivAkta} (${item.zunanjiId})`,
    adoptionDate,
    title: item.nazivAkta,
    enactingBody: item.organSprejemaAliIzdaje ?? null,
    statusLabel: item.semafor?.naziv ?? null,
  }
}

// ── Fetch all records ──────────────────────────────────────────────────────────

async function fetchAllRecords(maxRecords: number, verbose: boolean): Promise<CandidateRecord[]> {
  const records: CandidateRecord[] = []
  let cursor: string | null = null
  let pageNum = 0
  let total = 0

  while (true) {
    const { seznam, nextCursor, total: t } = await fetchPage(cursor)
    total = t

    if (pageNum === 0) {
      console.log(`  Total records in Register predpisov: ${total}`)
    }

    for (const item of seznam) {
      records.push(buildRecord(item))
      if (maxRecords > 0 && records.length >= maxRecords) break
    }

    pageNum++
    if (verbose) {
      process.stdout.write(`  Page ${pageNum}: fetched ${records.length}/${maxRecords > 0 ? maxRecords : total}\r`)
    } else if (pageNum % 50 === 0) {
      process.stdout.write(`  Fetched ${records.length}/${maxRecords > 0 ? maxRecords : total} records...\r`)
    }

    if (maxRecords > 0 && records.length >= maxRecords) break
    if (seznam.length === 0 || nextCursor === cursor) break

    cursor = nextCursor
    await sleep(REQUEST_DELAY_MS)
  }

  process.stdout.write('\n')
  return records
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }

  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
    else console.warn(`  Parent topic ${parentSlug} not found`)
  }

  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
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
        ingestedBy: INGESTED_BY,
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        claimEmergedAt: rec.adoptionDate ?? undefined,
        claimEmergedPrecision: rec.adoptionDate ? 'DAY' : undefined,
        metadata: {
          dataset: INGESTED_BY,
          pisrsId: rec.pisrsId,
          legalType: rec.legalType,
          title: rec.title,
          enactingBody: rec.enactingBody,
          status: rec.statusLabel,
          country: 'Slovenia',
        },
      },
    })

    await tx.edge.create({
      data: { claimId: claim.id, sourceId: source.id, type: 'CITES', ingestedBy: INGESTED_BY, autoApproved: false },
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

  console.log(`\n── ${PIPELINE}: Slovenia Legislation ─────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Source: PISRS Register predpisov API`)

  const fetchLimit = mode === 'dry-run' ? 15
    : mode === 'sample' ? Math.max(sampleN, 15)
    : limit > 0 ? limit
    : 0

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('parliament-slovenia', 'National Assembly of Slovenia', 'government', 'gov-region-europe')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching records from PISRS Register predpisov API...')
  const candidates = await fetchAllRecords(fetchLimit, verbose)
  console.log(`Total records fetched: ${candidates.length}`)

  // ── Dry-run ──────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const sample = candidates.slice(0, 15).map(r => ({
      pisrsId: r.pisrsId,
      legalType: r.legalType,
      title: r.title,
      claimText: r.claimText,
      externalId: r.externalId,
      sourceUrl: r.sourceUrl,
      adoptionDate: r.adoptionDate?.toISOString().slice(0, 10) ?? null,
      enactingBody: r.enactingBody,
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
      dataSource: 'PISRS Register predpisov API (https://pisrs.si/api/filter/filter)',
      totalInRegister: 15374,
      totalFetched: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-91-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-91-dry-run-sample.json')

    console.log('\nSample (first 5):')
    candidates.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.pisrsId}] ${r.title} (${r.adoptionDate?.toISOString().slice(0, 10) ?? 'no date'})`)
    )

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  if (candidates.length === 0) {
    console.error('\nERROR: No candidates fetched from API.')
    process.exit(1)
  }

  if (mode === 'full' && !process.env.ALLOW_EDITS) {
    console.error('ERROR: Set ALLOW_EDITS=true to run in full mode.')
    process.exit(1)
  }

  const rows = mode === 'sample' ? candidates.slice(0, sampleN) : candidates

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
          if (verbose) console.log(`  [${result}] ${row.externalId}`)
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
