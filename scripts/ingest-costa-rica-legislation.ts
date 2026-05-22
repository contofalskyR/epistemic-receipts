// Pipeline 88 — Costa Rica Legislation (costa_rica_legislation_v1)
// Source: SCIJ (Sistema Costarricense de Información Jurídica) — pgrweb.go.cr/scij
// Method: CDX enumerate Wayback-archived law pages, then fetch + parse each via Wayback.
//         The SCIJ site (196.40.56.11) times out from non-CR IPs, so all fetches go
//         through archive.org. CDX yields ~8,500 unique nValor2 IDs.
//
// PREVIOUS APPROACH (blocked 2026-05-21):
//   ASP.NET WebForms POST was tried first but SCIJ requires JS-driven session state;
//   all programmatic POST attempts returned the home page (0 results).
//
// Run:
//   set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-costa-rica-legislation.ts --dry-run
//   set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-costa-rica-legislation.ts --sample 5
//   set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-costa-rica-legislation.ts --full

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'costa_rica_legislation_v1'
const PIPELINE = 'Pipeline 88'
const CDX_API = 'https://web.archive.org/cdx/search/cdx'
const WAYBACK_BASE = 'https://web.archive.org/web'
const CDX_PATTERN = 'pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx*'
const REQUEST_DELAY_MS = 1200
const BATCH_SIZE = 25

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CdxEntry {
  nValor2: number
  timestamp: string
  originalUrl: string
}

interface CandidateRecord {
  nValor2: number
  title: string
  enteEmisor: string
  fechaVigencia: string
  enactedDate: Date
  sourceUrl: string
  waybackUrl: string
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
        console.error('Usage: --dry-run | --sample N | --full  [--verbose]')
        process.exit(1) as never
      })()
  const sai = args.indexOf('--sample')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '5', 10) || 5) : 5,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── HTTP ───────────────────────────────────────────────────────────────────────

async function fetchText(url: string, retries = 4): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'text/html,application/xhtml+xml,text/plain,*/*', 'Accept-Language': 'es,en' },
        signal: AbortSignal.timeout(45000),
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay = Math.min(delay * 2, 30000)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)
      return await res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay = Math.min(delay * 2, 30000)
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── CDX Enumeration ────────────────────────────────────────────────────────────

// Extract clean nValor2 integer from a SCIJ URL. Returns null for malformed values
// (e.g. "nValor2=8%204661" where the space makes it invalid).
function extractNValor2(url: string): number | null {
  const m = url.match(/[?&]nValor2=(\d+)(?:[&%\s]|$)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function fetchCDXIndex(verbose: boolean): Promise<Map<number, CdxEntry>> {
  const cdxUrl = `${CDX_API}?url=${encodeURIComponent(CDX_PATTERN)}&output=json&limit=0&fl=original,timestamp&filter=statuscode:200`
  console.log('  Fetching CDX index from archive.org...')
  if (verbose) console.log(`  CDX URL: ${cdxUrl}`)

  const raw = await fetchText(cdxUrl)

  let rows: string[][]
  try {
    rows = JSON.parse(raw)
  } catch {
    throw new Error(`CDX response not valid JSON (length: ${raw.length})`)
  }

  // Deduplicate by nValor2, keeping the most recent timestamp
  const index = new Map<number, CdxEntry>()
  let malformed = 0

  for (const row of rows.slice(1)) {
    const [originalUrl, timestamp] = row
    const nValor2 = extractNValor2(originalUrl)
    if (nValor2 === null) { malformed++; continue }
    const existing = index.get(nValor2)
    if (!existing || timestamp > existing.timestamp) {
      index.set(nValor2, { nValor2, timestamp, originalUrl })
    }
  }

  if (verbose) console.log(`  CDX raw rows: ${rows.length - 1}, malformed: ${malformed}`)
  return index
}

// ── Wayback Fetch & Parse ──────────────────────────────────────────────────────

function buildWaybackUrl(entry: CdxEntry): string {
  return `${WAYBACK_BASE}/${entry.timestamp}/${entry.originalUrl}`
}

function parseDate(ddmmyyyy: string): Date | null {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`)
  return isNaN(d.getTime()) ? null : d
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ParsedLaw {
  title: string
  enteEmisor: string
  fechaVigencia: string
  enactedDate: Date
}

function parseLawPage(html: string): ParsedLaw | null {
  // Title: between <!--Nombre de la norma--> comment and the next <br> or comment
  const titleM = html.match(/<!--Nombre de la norma-->\s*([\s\S]*?)(?:<br>|<!--)/)
  if (!titleM) return null
  const title = stripHtml(titleM[1])
  if (!title || title.length < 3) return null

  // Ente emisor (issuing body) — optional field
  let enteEmisor = ''
  const enteM = html.match(/Ente emisor:[\s\S]*?tabla_texto2[^>]*>\s*([\s\S]*?)\s*<\/td>/)
  if (enteM) enteEmisor = stripHtml(enteM[1])

  // Primary date: Fecha de vigencia desde (DD/MM/YYYY)
  let fechaVigencia = ''
  let enactedDate: Date | null = null

  const fechaM = html.match(/Fecha de vigencia desde:[\s\S]*?tabla_texto2[^>]*>\s*([\s\S]*?)\s*<\/td>/)
  if (fechaM) {
    const raw = stripHtml(fechaM[1])
    const d = parseDate(raw)
    if (d) { fechaVigencia = raw; enactedDate = d }
  }

  // Fallback: version date from "del DD/MM/YYYY"
  if (!enactedDate) {
    const verM = html.match(/\bdel\s+(\d{2}\/\d{2}\/\d{4})/)
    if (verM) {
      const d = parseDate(verM[1])
      if (d) { fechaVigencia = verM[1]; enactedDate = d }
    }
  }

  if (!enactedDate) return null

  return { title, enteEmisor, fechaVigencia, enactedDate }
}

async function fetchAndParse(entry: CdxEntry, verbose: boolean): Promise<CandidateRecord | null> {
  const waybackUrl = buildWaybackUrl(entry)
  if (verbose) console.log(`  Fetching nValor2=${entry.nValor2}: ${waybackUrl.slice(0, 100)}`)

  let html: string
  try {
    html = await fetchText(waybackUrl)
  } catch (err) {
    console.warn(`  nValor2=${entry.nValor2}: fetch failed — ${err instanceof Error ? err.message : err}`)
    return null
  }

  const parsed = parseLawPage(html)
  if (!parsed) {
    if (verbose) console.log(`  nValor2=${entry.nValor2}: parse failed (no title or date)`)
    return null
  }

  const { title, enteEmisor, fechaVigencia, enactedDate } = parsed
  const externalId = `cr_scij_${entry.nValor2}`
  const sourceExternalId = `cr_scij_src_${entry.nValor2}`
  const scijUrl = `https://pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx?param1=NRTC&nValor1=1&nValor2=${entry.nValor2}&strTipM=TC`

  return {
    nValor2: entry.nValor2,
    title,
    enteEmisor,
    fechaVigencia,
    enactedDate,
    sourceUrl: scijUrl,
    waybackUrl,
    externalId,
    sourceExternalId,
    sourceName: `SCIJ #${entry.nValor2}: ${title.slice(0, 80)}`,
  }
}

// ── Topic ──────────────────────────────────────────────────────────────────────

let cachedTopicId: string | null = null

async function ensureTopic(): Promise<string> {
  if (cachedTopicId) return cachedTopicId
  const slug = 'cr-scij'
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { cachedTopicId = existing.id; return existing.id }
  const created = await prisma.topic.create({ data: { slug, name: 'Costa Rica Legislation (SCIJ)', domain: 'government' } })
  console.log(`  Created topic: ${slug}`)
  cachedTopicId = created.id
  return created.id
}

// ── DB Write ───────────────────────────────────────────────────────────────────

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
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          nValor2: rec.nValor2,
          enteEmisor: rec.enteEmisor,
          fechaVigencia: rec.fechaVigencia,
          scijUrl: rec.sourceUrl,
          waybackUrl: rec.waybackUrl,
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
  const { mode, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: Costa Rica Legislation (costa_rica_legislation_v1) ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (N=${sampleN})` : ''}`)
  console.log('Source: CDX → Wayback Machine → pgrweb.go.cr/scij')

  // ── Step 1: CDX Enumeration ───────────────────────────────────────────────
  console.log('\nStep 1: Enumerating law IDs from CDX (archive.org)...')
  const cdxIndex = await fetchCDXIndex(verbose)
  const allEntries = Array.from(cdxIndex.values()).sort((a, b) => a.nValor2 - b.nValor2)
  const idMin = allEntries[0]?.nValor2 ?? 0
  const idMax = allEntries[allEntries.length - 1]?.nValor2 ?? 0
  console.log(`  Found ${allEntries.length} unique law IDs (nValor2 range: ${idMin}–${idMax})`)

  if (mode === 'dry-run') {
    const sample = allEntries.slice(0, 10).map(e => ({
      nValor2: e.nValor2,
      timestamp: e.timestamp,
      waybackUrl: buildWaybackUrl(e),
      scijUrl: `https://pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx?param1=NRTC&nValor1=1&nValor2=${e.nValor2}&strTipM=TC`,
    }))
    const out = {
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      mode: 'dry-run',
      totalCdxIds: allEntries.length,
      idRange: { min: idMin, max: idMax },
      sampleEntries: sample,
      note: 'No DB writes. Run --sample 5 to fetch and parse individual pages via Wayback.',
    }
    fs.writeFileSync('pipeline-88-dry-run-sample.json', JSON.stringify(out, null, 2))
    console.log('\nDry-run complete. Written: pipeline-88-dry-run-sample.json')
    await prisma.$disconnect()
    return
  }

  // ── Step 2: Fetch + Parse ─────────────────────────────────────────────────
  const targetEntries = mode === 'sample' ? allEntries.slice(0, sampleN) : allEntries
  console.log(`\nStep 2: Fetching ${targetEntries.length} pages from Wayback Machine...`)

  const candidates: CandidateRecord[] = []
  let failCount = 0

  for (let i = 0; i < targetEntries.length; i++) {
    const entry = targetEntries[i]
    const rec = await fetchAndParse(entry, verbose)
    if (rec) {
      candidates.push(rec)
      if (!verbose) process.stdout.write(`  [${i + 1}/${targetEntries.length}] ✓ ${rec.title.slice(0, 55)}...\r`)
    } else {
      failCount++
      if (!verbose) process.stdout.write(`  [${i + 1}/${targetEntries.length}] ✗ nValor2=${entry.nValor2}\r`)
    }
    if (i < targetEntries.length - 1) await sleep(REQUEST_DELAY_MS)
  }

  process.stdout.write('\n')
  console.log(`  Parsed: ${candidates.length} / ${targetEntries.length} (${failCount} failed)`)

  if (candidates.length === 0) {
    console.error('No candidates parsed. Aborting.')
    await prisma.$disconnect()
    process.exit(1)
  }

  if (mode === 'sample') {
    const sampleOut = candidates.map(r => ({
      nValor2: r.nValor2,
      title: r.title,
      enteEmisor: r.enteEmisor,
      fechaVigencia: r.fechaVigencia,
      enactedDate: r.enactedDate.toISOString().slice(0, 10),
      externalId: r.externalId,
      sourceUrl: r.sourceUrl,
      waybackUrl: r.waybackUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: false,
      humanReviewed: false,
    }))
    fs.writeFileSync('pipeline-88-dry-run-sample.json', JSON.stringify(sampleOut, null, 2))
    console.log('Written: pipeline-88-dry-run-sample.json')
  }

  // ── Step 3: Topic ─────────────────────────────────────────────────────────
  console.log('\nStep 3: Ensuring topic...')
  const topicId = await ensureTopic()
  console.log(`  Topic ID: ${topicId}`)

  // ── Step 4: Write to DB ───────────────────────────────────────────────────
  console.log('\nStep 4: Writing to database...')
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    await prisma.$transaction(async (tx) => {
      for (const rec of batch) {
        const result = await writeRow(tx, rec, topicId)
        if (result === 'ingested') counts.ingested++
        else if (result === 'skipped') counts.skipped++
        else counts.errors++
        if (verbose) console.log(`  [${result}] ${rec.externalId} — ${rec.title.slice(0, 70)}`)
      }
    }, { timeout: 30000 })

    const done = Math.min(i + BATCH_SIZE, candidates.length)
    if (!verbose) process.stdout.write(`  Batch ${Math.ceil(done / BATCH_SIZE)}: ${done}/${candidates.length} — ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}\r`)
  }

  process.stdout.write('\n')

  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`\n── ${PIPELINE} complete ──`)
  console.log(`Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
  console.log(`DB: Claims=${dbClaims} Sources=${dbSources}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
