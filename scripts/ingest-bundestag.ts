// Pipeline 21 — German Bundestag Enacted Laws (bundestag_v1)
// Dataset: Bundestag DIP (Dokumentations- und Informationssystem) REST API
//          (search.dip.bundestag.de/api/v1). Free, public API key.
// Scope: All Vorgänge of type "Gesetzgebung" with beratungsstand="Verkündet"
//        (promulgated — i.e., signed and published in the Bundesgesetzblatt).
// Topic: de-bundestag (German Bundestag, domain=government).
// Run: npx tsx scripts/ingest-bundestag.ts --dry-run
//      npx tsx scripts/ingest-bundestag.ts --sample 10
//      npx tsx scripts/ingest-bundestag.ts --full [--limit N] [--verbose]
//
// Note on the API key: the DIP API requires a key. The Bundestag publishes a
// rolling public demo key at https://dip.bundestag.de/über-dip/hilfe/api which
// is rotated periodically. The value below is the current public key as
// surfaced by the official bundesAPI/dip-bundestag-api community wrapper. If
// the API starts returning HTTP 401, refresh this constant from that page.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'bundestag_v1'
const PIPELINE = 'Pipeline 21'
const API_BASE = 'https://search.dip.bundestag.de/api/v1'
const API_KEY = process.env.BUNDESTAG_API_KEY ?? ''
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

interface Verkuendung {
  jahrgang?: string
  heftnummer?: string
  ausfertigungsdatum?: string
  verkuendungsdatum?: string
  einleitungstext?: string
  pdf_url?: string
  verkuendungsblatt_bezeichnung?: string
  verkuendungsblatt_kuerzel?: string
  fundstelle?: string
}

interface DipVorgang {
  id: string
  titel: string
  datum?: string
  beratungsstand?: string
  vorgangstyp: string
  wahlperiode?: number
  gesta?: string
  abstract?: string | null
  verkuendung?: Verkuendung[]
  inkrafttreten?: { datum: string }[]
}

interface DipPage {
  numFound: number
  documents: DipVorgang[]
  cursor: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  id: string
  claimText: string
  enactedDate: Date
  enactedDateStr: string        // ISO YYYY-MM-DD
  dateSource: 'verkuendungsdatum' | 'ausfertigungsdatum' | 'datum'
  wahlperiode: number | null
  vorgangstyp: string
  beratungsstand: string
  gesta: string | null
  bglFundstelle: string | null
  bglPdfUrl: string | null
  sourceUrl: string
  externalId: string
  sourceExternalId: string
}

// ── HTML / text helpers ────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim()
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

async function fetchPage(cursor: string | null, retries = 3): Promise<DipPage> {
  const params = new URLSearchParams({
    'f.vorgangstyp': 'Gesetzgebung',
    'f.beratungsstand': 'Verkündet',
    format: 'json',
    apikey: API_KEY,
  })
  if (cursor) params.set('cursor', cursor)
  const url = `${API_BASE}/vorgang?${params.toString()}`

  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} (cursor=${cursor ?? 'start'}) — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`DIP API ${res.status} at cursor=${cursor ?? 'start'}: ${body.slice(0, 200)}`)
    }
    return res.json() as Promise<DipPage>
  }
  throw new Error(`Failed after ${retries} retries at cursor=${cursor ?? 'start'}`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function pickEnactedDate(v: DipVorgang): { iso: string; source: CandidateRecord['dateSource'] } | null {
  const v0 = v.verkuendung?.[0]
  if (v0?.verkuendungsdatum && /^\d{4}-\d{2}-\d{2}$/.test(v0.verkuendungsdatum)) {
    return { iso: v0.verkuendungsdatum, source: 'verkuendungsdatum' }
  }
  if (v0?.ausfertigungsdatum && /^\d{4}-\d{2}-\d{2}$/.test(v0.ausfertigungsdatum)) {
    return { iso: v0.ausfertigungsdatum, source: 'ausfertigungsdatum' }
  }
  if (v.datum && /^\d{4}-\d{2}-\d{2}$/.test(v.datum)) {
    return { iso: v.datum, source: 'datum' }
  }
  return null
}

function buildCandidate(v: DipVorgang, verbose: boolean): CandidateRecord | null {
  if (!v.id) return null
  const rawTitle = v.titel ?? ''
  const claimText = stripHtml(rawTitle)
  if (!claimText) {
    if (verbose) console.log(`  Skip ${v.id}: no titel`)
    return null
  }
  const picked = pickEnactedDate(v)
  if (!picked) {
    if (verbose) console.log(`  Skip ${v.id}: no usable date`)
    return null
  }
  const enactedDate = new Date(picked.iso + 'T00:00:00Z')
  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip ${v.id}: invalid date ${picked.iso}`)
    return null
  }

  const v0 = v.verkuendung?.[0]
  const sourceUrl = `https://dip.bundestag.de/vorgang/${v.id}`
  const externalId = `bundestag_vorgang_${v.id}`
  const sourceExternalId = `bundestag_source_${v.id}`

  return {
    id: v.id,
    claimText,
    enactedDate,
    enactedDateStr: picked.iso,
    dateSource: picked.source,
    wahlperiode: typeof v.wahlperiode === 'number' ? v.wahlperiode : null,
    vorgangstyp: v.vorgangstyp,
    beratungsstand: v.beratungsstand ?? '',
    gesta: v.gesta ?? null,
    bglFundstelle: v0?.fundstelle ?? null,
    bglPdfUrl: v0?.pdf_url ?? null,
    sourceUrl,
    externalId,
    sourceExternalId,
  }
}

// ── Fetch all enacted laws ─────────────────────────────────────────────────────

async function fetchAllEnacted(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let cursor: string | null = null
  let prevCursor: string | null = null
  let total = -1
  let skippedMalformed = 0
  let pagesFetched = 0

  for (;;) {
    const page = await fetchPage(cursor)
    pagesFetched++
    if (total === -1) {
      total = page.numFound
      console.log(`  API reports ${total} enacted Gesetzgebung records (beratungsstand=Verkündet)`)
    }
    const docs = page.documents ?? []
    if (docs.length === 0) break

    let newOnPage = 0
    for (const v of docs) {
      const rec = buildCandidate(v, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break

    // DIP signals end-of-results by repeating the previous cursor.
    if (page.cursor && page.cursor === prevCursor) break
    if (!page.cursor) break

    prevCursor = cursor
    cursor = page.cursor

    if (verbose) console.log(`  ...page ${pagesFetched}: ${docs.length} docs, total candidates so far ${candidates.length}`)
    if (newOnPage === 0) break
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
        name: `Bundestag Drucksache ${rec.id}`,
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
          wahlperiode: rec.wahlperiode,
          vorgangstyp: rec.vorgangstyp,
          beratungsstand: rec.beratungsstand,
          gesta: rec.gesta,
          bglFundstelle: rec.bglFundstelle,
          bglPdfUrl: rec.bglPdfUrl,
          dateSource: rec.dateSource,
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

  console.log(`\n── ${PIPELINE}: German Bundestag Enacted Laws ─────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // Step 1: Topics (skipped in dry-run)
  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('de-bundestag', 'German Bundestag', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch enacted laws
  console.log('\nStep 2: Fetching enacted Gesetzgebung from DIP API...')
  const candidates = await fetchAllEnacted(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const byWahlperiode = new Map<number | null, number>()
    for (const c of candidates) {
      byWahlperiode.set(c.wahlperiode, (byWahlperiode.get(c.wahlperiode) ?? 0) + 1)
    }
    const wpSummary = [...byWahlperiode.entries()]
      .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))
      .map(([wp, n]) => ({ wahlperiode: wp, count: n }))

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      vorgangId: r.id,
      wahlperiode: r.wahlperiode,
      vorgangstyp: r.vorgangstyp,
      beratungsstand: r.beratungsstand,
      gesta: r.gesta,
      enactedDate: r.enactedDateStr,
      dateSource: r.dateSource,
      bglFundstelle: r.bglFundstelle,
      bglPdfUrl: r.bglPdfUrl,
      sourceUrl: r.sourceUrl,
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
      byWahlperiode: wpSummary,
      sample,
    }

    fs.writeFileSync('pipeline-21-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-21-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
      )
      console.log('\nBy Wahlperiode:')
      wpSummary.forEach(({ wahlperiode, count }) => console.log(`  WP ${wahlperiode ?? '—'}: ${count}`))
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full run share batch write logic ──────────────────────────────
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
