// Pipeline 22 — Austria Nationalrat Enacted Laws (nationalrat_v1)
// Dataset: Austrian Parliament Open Data Filter API
//   POST https://www.parlament.gv.at/Filter/api/filter/data/101?showAll=true
//   Free, no API key required. CC BY 4.0.
// Scope: All "Beschluss des Nationalrates" (DOKTYP=BNR) records — the formal
//   National Council adoption decision for federal laws. Filter the Filter API
//   with {NRBR:["NR"], VHG:["BNR"]} then keep rows where DOKTYP==="BNR" (drops
//   "Sonstiger Beschluss"/BS, BSE, BSESM, BSESMP which are not enacted laws).
// Topic: at-nationalrat (Austrian Nationalrat, domain=government).
// Run: npx tsx scripts/ingest-nationalrat.ts --dry-run
//      npx tsx scripts/ingest-nationalrat.ts --sample 10
//      npx tsx scripts/ingest-nationalrat.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'nationalrat_v1'
const PIPELINE = 'Pipeline 22'
const FILTER_URL = 'https://www.parlament.gv.at/Filter/api/filter/data/101?showAll=true'
const SITE_BASE = 'https://www.parlament.gv.at'

// ── Types ──────────────────────────────────────────────────────────────────────

interface FilterHeader {
  label: string
  feld_name?: string
  rnr?: number
}

interface FilterApiResponse {
  pages: number
  count: number
  header: FilterHeader[]
  rows: unknown[][]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  gpCode: string
  inr: number
  nummer: string
  doktyp: string
  doktypLang: string
  betreff: string
  themen: string[]
  hisUrl: string
  claimText: string
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

async function fetchAllBeschluesse(retries = 4): Promise<FilterApiResponse> {
  // The Filter API accepts a JSON body of dimension→values filters. Combined
  // with showAll=true the server returns the full result set in a single page.
  // We narrow to the National Council ("NR") + the VHG dimension "BNR" (all
  // resolution-style subjects). We further filter to DOKTYP=BNR at the client
  // because VHG=BNR includes a handful of BS/BSE/BSESM variants that are not
  // enacted laws (e.g. Rechnungshof report acknowledgments, ESM agreements).
  const body = JSON.stringify({ NRBR: ['NR'], VHG: ['BNR'] })
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(FILTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} from filter API — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Filter API ${res.status}: ${await res.text().catch(() => '')}`)
      return await res.json() as FilterApiResponse
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error on filter API: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Filter API failed after ${retries} retries`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function parseTopics(raw: unknown): string[] {
  // Column 22 (THEMEN) arrives as a JSON-encoded array string, e.g.
  // "[\"Gesundheit und Ernährung\",\"Soziales\"]". Single-string '[""]' = empty.
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(s => String(s).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function buildCandidate(
  row: unknown[],
  idx: Record<string, number>,
  verbose: boolean,
): CandidateRecord | null {
  const gpCode = String(row[idx.GP_CODE] ?? '').trim()
  const inrRaw = row[idx.INRNUM]
  const inr = typeof inrRaw === 'number' ? inrRaw : parseInt(String(inrRaw ?? ''), 10)
  const doktyp = String(row[idx.DOKTYP] ?? '').trim()
  if (doktyp !== 'BNR') return null  // strict: only Beschluss des Nationalrates
  if (!gpCode || !inr || isNaN(inr)) {
    if (verbose) console.log(`  Skip row: missing gpCode/inr (gp=${gpCode}, inr=${inrRaw})`)
    return null
  }

  const datumVon = String(row[idx.DATUM_VON] ?? '')
  const datumStr = datumVon.slice(0, 10)
  if (!datumStr) {
    if (verbose) console.log(`  Skip ${gpCode}/${inr}: no DATUM_VON`)
    return null
  }
  const enactedDate = new Date(datumStr + 'T00:00:00Z')
  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip ${gpCode}/${inr}: invalid date=${datumVon}`)
    return null
  }

  const betreff = cleanText(String(row[idx.Betreff] ?? ''))
  if (!betreff) {
    if (verbose) console.log(`  Skip ${gpCode}/${inr}: no Betreff`)
    return null
  }

  const nummer = cleanText(String(row[idx.Nummer] ?? '')) || `${inr}/BNR`
  const doktypLang = cleanText(String(row[idx['DOKTYP_LANG']] ?? '')) || 'Beschluss des Nationalrates'
  const hisUrl = String(row[idx['HIS_URL']] ?? '').trim() || `/gegenstand/${gpCode}/BNR/${inr}`
  const themen = parseTopics(row[idx.THEMEN])

  const claimText = `${betreff} — Beschluss des Nationalrates ${nummer} (${gpCode}. GP)`
  const sourceUrl = `${SITE_BASE}${hisUrl.startsWith('/') ? '' : '/'}${hisUrl}`
  const externalId = `nationalrat_bnr_${gpCode}_${inr}`
  const sourceExternalId = `nationalrat_source_${gpCode}_${inr}`

  return {
    gpCode,
    inr,
    nummer,
    doktyp,
    doktypLang,
    betreff,
    themen,
    hisUrl,
    claimText,
    enactedDate,
    enactedDateStr: datumStr,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: `Beschluss des Nationalrates ${nummer} (${gpCode}. GP)`,
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
          doktyp: rec.doktyp,
          doktypLang: rec.doktypLang,
          gpCode: rec.gpCode,
          inr: rec.inr,
          nummer: rec.nummer,
          betreff: rec.betreff,
          themen: rec.themen,
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

  console.log(`\n── ${PIPELINE}: Austria Nationalrat Enacted Laws ──────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('at-nationalrat', 'Austrian Nationalrat', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Beschlüsse des Nationalrates from Parlament.gv.at Filter API...')
  const page = await fetchAllBeschluesse()
  const idx: Record<string, number> = Object.fromEntries(page.header.map((h, i) => [h.label, i]))
  for (const required of ['GP_CODE', 'DOKTYP', 'DATUM_VON', 'Betreff', 'Nummer', 'HIS_URL', 'INRNUM', 'THEMEN', 'DOKTYP_LANG']) {
    if (!(required in idx)) {
      throw new Error(`Filter API header missing column ${required}: ${page.header.map(h => h.label).join(',')}`)
    }
  }
  console.log(`  API reports ${page.count} rows across VHG=BNR (will keep DOKTYP=BNR only)`)

  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skippedNonBnr = 0
  let skippedMalformed = 0
  for (const row of page.rows) {
    const rec = buildCandidate(row, idx, verbose)
    if (!rec) {
      const doktyp = String(row[idx.DOKTYP] ?? '')
      if (doktyp && doktyp !== 'BNR') skippedNonBnr++
      else skippedMalformed++
      continue
    }
    if (seenIds.has(rec.externalId)) continue
    seenIds.add(rec.externalId)
    candidates.push(rec)
    if (limit > 0 && candidates.length >= limit) break
  }
  // Sort newest-first to make sample previews intuitive.
  candidates.sort((a, b) => b.enactedDateStr.localeCompare(a.enactedDateStr))

  console.log(`  Filtered out ${skippedNonBnr} non-BNR doktyps (BS/BSE/BSESM/BSESMP)`)
  if (skippedMalformed > 0) console.log(`  Skipped ${skippedMalformed} malformed/incomplete rows`)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      gpCode: r.gpCode,
      inr: r.inr,
      nummer: r.nummer,
      doktyp: r.doktyp,
      doktypLang: r.doktypLang,
      betreff: r.betreff,
      themen: r.themen,
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

    fs.writeFileSync('pipeline-22-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-22-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles (newest first):')
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
