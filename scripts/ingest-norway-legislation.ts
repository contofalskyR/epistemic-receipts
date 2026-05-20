// Pipeline 28 — Norway Storting Enacted Laws (norway_legislation_v1)
// Dataset: Stortinget Open Data API (data.stortinget.no). Free, no API key required.
// Scope: type=1 (lovsaker) — law cases enacted by the Norwegian parliament.
// Topic: no-storting (Storting (Norway), domain=government).
// Run: npx tsx scripts/ingest-norway-legislation.ts --dry-run
//      npx tsx scripts/ingest-norway-legislation.ts --sample 10
//      npx tsx scripts/ingest-norway-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'norway_legislation_v1'
const PIPELINE = 'Pipeline 28'
const API_BASE = 'https://data.stortinget.no/eksport'
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

interface StoringSak {
  id: number
  tittel?: string
  korttittel?: string
  type?: number
  status?: number
  behandlet_sesjon_id?: string
  sist_oppdatert_dato?: string
  dokumentgruppe?: number
  innstilling_kode?: number
  henvisning?: string
}

interface StortingSakerResponse {
  saker_liste?: StoringSak[]
  sesjon_id?: string
}

interface StortingSession {
  id?: string
}

interface StortingSessionsResponse {
  sesjoner_liste?: StortingSession[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  sakId: number
  sesjonId: string
  tittel: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
  henvisning: string
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
        console.warn(`  HTTP ${res.status} at ${url} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Stortinget API ${res.status} at ${url}`)
      return await res.json() as T
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error at ${url}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at ${url}`)
}

// ── Date parsing ───────────────────────────────────────────────────────────────

// Microsoft JSON Date: "/Date(1750111200000+0200)/"
function parseMsDate(val: string | undefined): Date | null {
  if (!val) return null
  const m = /\/Date\((\d+)[+-]\d+\)\//.exec(val)
  if (!m) return null
  const ms = parseInt(m[1], 10)
  return new Date(ms)
}

// Derive a date from session ID like "2024-2025" → Jan 1 of the end year
function sessionToDate(sesjonId: string): Date {
  const parts = sesjonId.split('-')
  const lastPart = parts[parts.length - 1]
  // "1998-99" → 1999, "2024-2025" → 2025
  let year = parseInt(lastPart, 10)
  if (year < 100) year += (year >= 86 ? 1900 : 2000)
  return new Date(`${year}-06-01T00:00:00Z`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(sak: StoringSak, sesjonId: string, verbose: boolean): CandidateRecord | null {
  const sakId = sak.id
  if (!sakId) {
    if (verbose) console.log(`  Skip sak: missing id`)
    return null
  }

  const tittel = (sak.tittel ?? sak.korttittel ?? '').trim()
  if (!tittel) {
    if (verbose) console.log(`  Skip sak ${sakId}: no tittel`)
    return null
  }

  // Use sist_oppdatert_dato with fallback to session year
  let enactedDate = parseMsDate(sak.sist_oppdatert_dato)
  if (!enactedDate || isNaN(enactedDate.getTime())) {
    enactedDate = sessionToDate(sesjonId)
  }

  const enactedDateStr = enactedDate.toISOString().slice(0, 10)
  const externalId = `norway_legislation_${sakId}`
  const sourceExternalId = `norway_legislation_source_${sakId}`
  const sourceUrl = `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${sakId}`
  const sourceName = `Stortinget ${sesjonId} #${sakId}`

  return {
    sakId,
    sesjonId,
    tittel,
    enactedDate,
    enactedDateStr,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName,
    henvisning: sak.henvisning ?? '',
  }
}

// ── Fetch all lovsaker across all sessions ─────────────────────────────────────

async function fetchAllSessions(): Promise<string[]> {
  const data = await fetchJson<StortingSessionsResponse>(`${API_BASE}/sesjoner?format=json`)
  const sessions = (data.sesjoner_liste ?? []).map(s => s.id).filter(Boolean) as string[]
  // Newest first, skip future sessions (e.g. 2026-2027, 2027-2028, 2028-2029)
  const currentYear = new Date().getFullYear()
  return sessions.filter(sid => {
    const parts = sid.split('-')
    const startYear = parseInt(parts[0], 10)
    return startYear <= currentYear
  })
}

async function fetchAllLovsaker(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skippedMalformed = 0

  const sessions = await fetchAllSessions()
  console.log(`  Found ${sessions.length} sessions to fetch`)

  for (let si = 0; si < sessions.length; si++) {
    const sesjonId = sessions[si]
    const url = `${API_BASE}/saker?sesjonid=${sesjonId}&format=json`
    let data: StortingSakerResponse
    try {
      data = await fetchJson<StortingSakerResponse>(url)
    } catch (err) {
      console.warn(`  Failed to fetch session ${sesjonId}: ${err}`)
      await sleep(PAGE_DELAY_MS)
      continue
    }

    const saker = (data.saker_liste ?? []).filter(s => s.type === 1)
    let newOnSession = 0

    for (const sak of saker) {
      const rec = buildCandidate(sak, sesjonId, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnSession++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (verbose) console.log(`  Session ${sesjonId}: ${saker.length} lovsaker, ${newOnSession} new (cumulative: ${candidates.length})`)

    if (hardLimit > 0 && candidates.length >= hardLimit) break

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
        text: rec.tittel,
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
          sakId: rec.sakId,
          sesjonId: rec.sesjonId,
          henvisning: rec.henvisning,
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

  console.log(`\n── ${PIPELINE}: Norway Storting Enacted Laws ──────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('no-storting', 'Storting (Norway)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching lovsaker from Stortinget API...')
  const candidates = await fetchAllLovsaker(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      tittel: r.tittel,
      externalId: r.externalId,
      sakId: r.sakId,
      sesjonId: r.sesjonId,
      henvisning: r.henvisning,
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

    fs.writeFileSync('pipeline-28-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-28-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] [${r.sesjonId}] ${r.tittel.slice(0, 100)}${r.tittel.length > 100 ? '…' : ''}`)
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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.tittel.slice(0, 70)}`)
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
