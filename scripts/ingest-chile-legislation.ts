// Pipeline 44 — Chile Congreso Nacional Enacted Laws (chile_legislation_v1)
// Dataset: Biblioteca del Congreso Nacional de Chile — Ley Chile
// API:     https://nuevo.leychile.cl/servicios/buscarjson?fc_tn=Ley
// Scope:   All Leyes (tipo_norma=Ley), ~15,881 records
// Topic:   cl-congreso (Congreso Nacional de Chile, domain=government)
// Run: npx tsx scripts/ingest-chile-legislation.ts --dry-run
//      npx tsx scripts/ingest-chile-legislation.ts --sample 10
//      npx tsx scripts/ingest-chile-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'chile_legislation_v1'
const PIPELINE = 'Pipeline 44'
const BASE_URL = 'https://nuevo.leychile.cl/servicios'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
  'Origin': 'https://www.bcn.cl',
  'Referer': 'https://www.bcn.cl/leychile/',
}

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface BuscarRecord {
  IDNORMA: number
  NUMERO: string
  TITULO_NORMA: string
  FECHA_PUBLICACION: string | null
  FECHA_PROMULGACION: string
  FECHA_VIGENCIA: string
  DESCRIPCION: string
  ABREVIACION: string
}

interface CandidateRecord {
  idNorma: number
  numero: string
  title: string
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

// ── Date parsing ───────────────────────────────────────────────────────────────

const ES_MONTHS: Record<string, string> = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
}

function parseDate(str: string | null | undefined): { date: Date; str: string; precision: string } | null {
  if (!str || !str.trim()) return null
  const s = str.trim()

  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z')
    if (!isNaN(d.getTime())) return { date: d, str: s, precision: 'DAY' }
  }

  // Spanish format: DD-MON-YYYY (e.g., "12-MAY-2026")
  const m = s.match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/)
  if (m) {
    const month = ES_MONTHS[m[2]]
    if (month) {
      const iso = `${m[3]}-${month}-${m[1].padStart(2, '0')}`
      const d = new Date(iso + 'T00:00:00Z')
      if (!isNaN(d.getTime())) return { date: d, str: iso, precision: 'DAY' }
    }
  }

  // Year only
  if (/^\d{4}$/.test(s)) {
    const d = new Date(`${s}-01-01T00:00:00Z`)
    if (!isNaN(d.getTime())) return { date: d, str: `${s}-01-01`, precision: 'YEAR' }
  }

  return null
}

// ── Fetch page of laws ─────────────────────────────────────────────────────────

async function fetchPage(page: number, perPage: number): Promise<{ records: BuscarRecord[]; total: number }> {
  const url = `${BASE_URL}/buscarjson?itemsporpagina=${perPage}&npagina=${page}&cadena=&tipoviene=1&fc_tn=Ley`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`)
  const data = await res.json() as [BuscarRecord[], { totalitems: number }]
  return { records: data[0], total: data[1].totalitems }
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(rec: BuscarRecord, verbose: boolean): CandidateRecord | null {
  const idNorma = rec.IDNORMA
  if (!idNorma) {
    if (verbose) console.log(`  Skip (no IDNORMA): ${rec.NUMERO}`)
    return null
  }

  // Date: prefer FECHA_PROMULGACION, then FECHA_VIGENCIA, then FECHA_PUBLICACION
  const parsed = parseDate(rec.FECHA_PROMULGACION)
    ?? parseDate(rec.FECHA_VIGENCIA)
    ?? parseDate(rec.FECHA_PUBLICACION)
  if (!parsed) {
    if (verbose) console.log(`  Skip (no date): idNorma=${idNorma} numero=${rec.NUMERO}`)
    return null
  }

  const numero = rec.NUMERO && rec.NUMERO !== 'S/N' ? rec.NUMERO : null
  const title = rec.TITULO_NORMA?.trim() || (numero ? `Ley N° ${numero}` : `Ley idNorma ${idNorma}`)
  if (!title) return null

  const externalId = `cl_ley_${idNorma}`
  const sourceExternalId = `cl_ley_source_${idNorma}`
  const sourceUrl = `https://www.leychile.cl/Navegar?idNorma=${idNorma}`

  return {
    idNorma,
    numero: numero ?? '',
    title,
    enactedDate: parsed.date,
    enactedDateStr: parsed.str,
    enactedPrecision: parsed.precision,
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
        name: rec.title.slice(0, 255),
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.title.slice(0, 1000),
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
          idNorma: rec.idNorma,
          numero: rec.numero,
          enactedDate: rec.enactedDateStr,
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

  console.log(`\n── ${PIPELINE}: Chile Congreso Nacional Enacted Laws ─────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('cl-congreso', 'Congreso Nacional de Chile', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Chilean laws from Ley Chile buscarjson API...')
  const PER_PAGE = 100
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()

  // First page to get total
  const first = await fetchPage(1, PER_PAGE)
  const totalItems = first.total
  const totalPages = Math.ceil(totalItems / PER_PAGE)
  console.log(`  Total laws found: ${totalItems}, pages: ${totalPages}`)

  for (const rec of first.records) {
    if (limit > 0 && candidates.length >= limit) break
    const cand = buildCandidate(rec, verbose)
    if (!cand || seenIds.has(cand.externalId)) continue
    seenIds.add(cand.externalId)
    candidates.push(cand)
  }

  for (let page = 2; page <= totalPages; page++) {
    if (limit > 0 && candidates.length >= limit) break
    const { records } = await fetchPage(page, PER_PAGE)
    for (const rec of records) {
      if (limit > 0 && candidates.length >= limit) break
      const cand = buildCandidate(rec, verbose)
      if (!cand || seenIds.has(cand.externalId)) continue
      seenIds.add(cand.externalId)
      candidates.push(cand)
    }
    if (page % 25 === 0 || page === totalPages) {
      process.stdout.write(`  ...page ${page}/${totalPages}: ${candidates.length} candidates\n`)
    }
  }

  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      idNorma: r.idNorma,
      numero: r.numero,
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
    writeFileSync('pipeline-44-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-44-dry-run-sample.json')

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
