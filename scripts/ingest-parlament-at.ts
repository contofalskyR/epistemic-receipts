// Pipeline 22 — Austrian Parliament Enacted Laws (parlament_at_v1)
//
// Dataset: Republic of Austria Federal Law Gazette (Bundesgesetzblatt, BGBl Part I),
//          via the official RIS OGD JSON API of the Federal Chancellery (data.bka.gv.at).
//          Free, no API key required.
//
// Why the Federal Chancellery's RIS API rather than parlament.gv.at?
//   The Austrian Parliament's own JSON API (/Filter/api/json/post) tracks
//   "Verhandlungsgegenstände" — parliamentary process items (motions, ministry
//   drafts, government bills, opposition initiatives, committee reports, etc.)
//   — but does not expose a clean filter for *enacted* federal laws. The
//   authoritative record of enacted Bundesgesetze is the Bundesgesetzblatt
//   (Federal Law Gazette), published by the Federal Chancellery and indexed
//   via the official RIS OGD API. Every record there carries the Nationalrat
//   vote date (DatumNationalrat) and parliamentary term (Gesetzgebungsperiode),
//   tying the law back to the Austrian Parliament that enacted it.
//
// Scope: All federal laws (Typ=Bundesgesetz) in Bundesgesetzblatt Part I.
//        ~3,500 records.
//
// Topic: at-nationalrat (Austrian Nationalrat, domain=government).
//
// Run: npx tsx scripts/ingest-parlament-at.ts --dry-run
//      npx tsx scripts/ingest-parlament-at.ts --sample 10
//      npx tsx scripts/ingest-parlament-at.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'parlament_at_v1'
const PIPELINE = 'Pipeline 22'
const API_BASE = 'https://data.bka.gv.at/ris/api/v2.6/Bundesrecht'
const PAGE_SIZE_ENUM = 'OneHundred'   // RIS API enum: Ten | Twenty | Fifty | OneHundred
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

interface RisDoc {
  Data: {
    Metadaten: {
      Technisch?: { ID?: string; Applikation?: string; Organ?: string; Einbringer?: string }
      Allgemein?: { DokumentUrl?: string }
      Bundesrecht?: {
        Kurztitel?: string
        Titel?: string
        Eli?: string
        BgblAuth?: {
          Bgblnummer?: string
          Teil?: string
          Ausgabedatum?: string             // BGBl publication date (YYYY-MM-DD)
          Typ?: string                      // "Bundesgesetz" for enacted laws
          Gesetzgebungsperiode?: string     // e.g., "XXVIII"
          DatumNationalrat?: string         // National Council vote date
          NummerNationalrat?: string
          DatumBundesrat?: string           // Federal Council date
          NummerBundesrat?: string
          AlteDokumentnummer?: string
        }
      }
    }
  }
}

interface RisPage {
  OgdSearchResult: {
    OgdDocumentResults?: {
      Hits: { '@pageNumber': string; '@pageSize': string; '#text': string }
      OgdDocumentReference?: RisDoc | RisDoc[]
    }
    Error?: { Applikation?: string; Message?: string }
  }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  docId: string                  // e.g., BGBLA_2026_I_33
  docType: string                // "BG" (Bundesgesetz)
  claimText: string
  enactedDate: Date
  enactedDateStr: string         // ISO YYYY-MM-DD
  enactedDateSource: 'nationalrat' | 'ausgabe'  // which date we used
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  metadata: {
    dataset: string
    docId: string
    typ: string                  // Bundesgesetz
    gesetzgebungsperiode?: string
    bgblnummer?: string
    ausgabedatum?: string
    datumNationalrat?: string
    nummerNationalrat?: string
  }
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

function buildPageUrl(pageNumber: number): string {
  const params = new URLSearchParams({
    Applikation: 'BgblAuth',
    'Typ.SucheInGesetzen': 'true',
    'Typ.SucheInVerordnungen': 'false',
    'Typ.SucheInKundmachungen': 'false',
    'Typ.SucheInSonstiges': 'false',
    'Teil.SucheInTeil1': 'true',
    Seitennummer: String(pageNumber),
    DokumenteProSeite: PAGE_SIZE_ENUM,
  })
  return `${API_BASE}?${params.toString()}`
}

async function fetchPage(pageNumber: number, retries = 3): Promise<RisPage> {
  const url = buildPageUrl(pageNumber)
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} at page=${pageNumber} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`RIS API ${res.status} at ${url}`)
    const data = await res.json() as RisPage
    if (data.OgdSearchResult.Error) {
      throw new Error(`RIS API error: ${data.OgdSearchResult.Error.Message}`)
    }
    return data
  }
  throw new Error(`Failed after ${retries} retries at page=${pageNumber}`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(doc: RisDoc, verbose: boolean): CandidateRecord | null {
  const md = doc.Data?.Metadaten
  if (!md) return null
  const tech = md.Technisch ?? {}
  const br = md.Bundesrecht ?? {}
  const bg = br.BgblAuth ?? {}

  const docId = tech.ID
  if (!docId) {
    if (verbose) console.log('  Skip: no Technisch.ID')
    return null
  }

  // Belt-and-suspenders type guard even though we filtered server-side.
  if (bg.Typ !== 'Bundesgesetz') {
    if (verbose) console.log(`  Skip ${docId}: Typ=${bg.Typ} (not Bundesgesetz)`)
    return null
  }

  const rawTitle = br.Titel || br.Kurztitel || ''
  const claimText = rawTitle.replace(/\s+/g, ' ').trim()
  if (!claimText) {
    if (verbose) console.log(`  Skip ${docId}: no title`)
    return null
  }

  // Prefer the Nationalrat vote date (the moment Parliament enacted the law).
  // Fall back to BGBl publication date.
  const nrDate = bg.DatumNationalrat
  const augDate = bg.Ausgabedatum
  const dateStr = nrDate || augDate
  if (!dateStr) {
    if (verbose) console.log(`  Skip ${docId}: no DatumNationalrat / Ausgabedatum`)
    return null
  }
  const enactedDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip ${docId}: invalid date ${dateStr}`)
    return null
  }

  const sourceUrl = br.Eli || md.Allgemein?.DokumentUrl
    || `https://www.ris.bka.gv.at/Dokumente/BgblAuth/${docId}/${docId}.html`

  const externalId = `parlament_at_BG_${docId}`
  const sourceExternalId = `parlament_at_source_${docId}`

  return {
    docId,
    docType: 'BG',
    claimText,
    enactedDate,
    enactedDateStr: dateStr,
    enactedDateSource: nrDate ? 'nationalrat' : 'ausgabe',
    sourceUrl,
    externalId,
    sourceExternalId,
    metadata: {
      dataset: INGESTED_BY,
      docId,
      typ: 'Bundesgesetz',
      gesetzgebungsperiode: bg.Gesetzgebungsperiode,
      bgblnummer: bg.Bgblnummer,
      ausgabedatum: bg.Ausgabedatum,
      datumNationalrat: bg.DatumNationalrat,
      nummerNationalrat: bg.NummerNationalrat,
    },
  }
}

// ── Fetch all Bundesgesetze ────────────────────────────────────────────────────

async function fetchAllEnacted(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let pageNumber = 1
  let total = -1
  let pageSize = 0
  let skippedMalformed = 0

  for (;;) {
    const page = await fetchPage(pageNumber)
    const results = page.OgdSearchResult.OgdDocumentResults
    if (!results) break
    if (total === -1) {
      total = parseInt(results.Hits['#text'], 10) || 0
      pageSize = parseInt(results.Hits['@pageSize'], 10) || 0
      console.log(`  API reports ${total} Bundesgesetze available`)
    }

    const refs = results.OgdDocumentReference
    const docs: RisDoc[] = Array.isArray(refs) ? refs : refs ? [refs] : []
    if (docs.length === 0) break

    let newOnPage = 0
    for (const doc of docs) {
      const rec = buildCandidate(doc, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue  // defensive against duplicates
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break
    if (newOnPage === 0) break
    if (docs.length < pageSize) break
    if (total > 0 && candidates.length + skippedMalformed >= total) break

    pageNumber++
    if (verbose) console.log(`  ...fetched ${candidates.length}/${total}`)
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
        name: rec.metadata.bgblnummer || rec.docId,
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
        metadata: rec.metadata,
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

  console.log(`\n── ${PIPELINE}: Austrian Parliament Enacted Laws ─────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // Step 1: Topics (skipped in dry-run)
  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('at-nationalrat', 'Austrian Nationalrat', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch Bundesgesetze
  console.log('\nStep 2: Fetching enacted Bundesgesetze from RIS BGBl API...')
  const candidates = await fetchAllEnacted(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      docId: r.docId,
      docType: r.docType,
      gesetzgebungsperiode: r.metadata.gesetzgebungsperiode,
      bgblnummer: r.metadata.bgblnummer,
      enactedDate: r.enactedDateStr,
      enactedDateSource: r.enactedDateSource,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byGp = new Map<string, number>()
    for (const r of candidates) {
      const gp = r.metadata.gesetzgebungsperiode || '(unknown)'
      byGp.set(gp, (byGp.get(gp) ?? 0) + 1)
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      apiEndpoint: API_BASE,
      totalCandidates: candidates.length,
      countsByGesetzgebungsperiode: Object.fromEntries([...byGp.entries()].sort()),
      sample,
    }

    fs.writeFileSync('pipeline-22-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-22-dry-run-sample.json')

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
