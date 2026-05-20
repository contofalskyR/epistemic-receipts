// Pipeline 31 — Iceland Althingi Enacted Legislation (iceland_legislation_v1)
// Dataset: Althingi Open Data XML API (https://www.althingi.is/altext/xml/)
// Scope: Bills with summaries (samantektir) — sessions 142+, enacted legislation
// Topic: is-althingi (Althingi Iceland, domain=government)
// Run: npx tsx scripts/ingest-iceland-legislation.ts --dry-run
//      npx tsx scripts/ingest-iceland-legislation.ts --sample 10
//      npx tsx scripts/ingest-iceland-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'iceland_legislation_v1'
const PIPELINE = 'Pipeline 31'
const API_BASE = 'https://www.althingi.is/altext/xml'
const PAGE_DELAY_MS = 300
const MIN_SESSION = 142

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionInfo {
  number: number
  startDate: string
  endDate: string
}

interface CandidateRecord {
  sessionNumber: number
  billNumber: number
  billType: string
  claimText: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

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

async function fetchXml(url: string, retries = 4): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/xml, text/xml, */*' } })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at ${url} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Althingi API ${res.status} at ${url}`)
      return await res.text()
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

// ── XML helpers ────────────────────────────────────────────────────────────────

function extractText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`)
  const m = xml.match(re)
  if (!m) return ''
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function parseDMY(dmy: string): string | null {
  if (!dmy) return null
  const parts = dmy.split('.')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function ensureHttps(url: string): string {
  if (url.startsWith('http://')) return 'https://' + url.slice(7)
  return url
}

// ── Sessions ───────────────────────────────────────────────────────────────────

async function fetchSessions(): Promise<SessionInfo[]> {
  const xml = await fetchXml(`${API_BASE}/loggjafarthing/`)
  const sessions: SessionInfo[] = []
  const chunks = xml.split('<þing ')
  for (const chunk of chunks.slice(1)) {
    const numMatch = chunk.match(/númer='(\d+)'/)
    if (!numMatch) continue
    const number = parseInt(numMatch[1], 10)
    if (number < MIN_SESSION) continue
    const startRaw = extractText(chunk, 'þingsetning')
    const endRaw = extractText(chunk, 'þinglok')
    const startDate = parseDMY(startRaw)
    if (!startDate) continue
    const endDate = parseDMY(endRaw) ?? startDate
    sessions.push({ number, startDate, endDate })
  }
  return sessions.sort((a, b) => a.number - b.number)
}

// ── Fetch enacted bills for one session ───────────────────────────────────────

async function fetchSessionBills(session: SessionInfo, verbose: boolean): Promise<CandidateRecord[]> {
  const xml = await fetchXml(`${API_BASE}/samantektir/?lthing=${session.number}`)
  const records: CandidateRecord[] = []

  const chunks = xml.split('<samantekt ')
  for (const chunk of chunks.slice(1)) {
    const billNumMatch = chunk.match(/málsnúmer='(\d+)'/)
    if (!billNumMatch) continue
    const billNumber = parseInt(billNumMatch[1], 10)

    // Extract <mál> block; falls back to full chunk if not found
    const malBlockMatch = chunk.match(/<mál [^>]*>([\s\S]*?)<\/mál>/)
    const malBlock = malBlockMatch ? malBlockMatch[0] : chunk

    const title = extractText(malBlock, 'málsheiti')
    if (!title) {
      if (verbose) console.log(`  Skip session ${session.number} bill ${billNumber}: no title`)
      continue
    }

    const description = extractText(malBlock, 'efnisgreining')
    const billTypeMatch = malBlock.match(/málstegund='([^']*)'/)
    const billType = billTypeMatch?.[1] ?? ''

    const htmlMatch = malBlock.match(/<html>([^<]+)<\/html>/)
    let sourceUrl = htmlMatch?.[1]?.trim() ?? ''
    if (!sourceUrl) sourceUrl = `https://www.althingi.is/dba-bin/ferill.pl?ltg=${session.number}&mnr=${billNumber}`
    sourceUrl = ensureHttps(sourceUrl)

    const claimText = description ? `${title}: ${description}` : title
    const enactedDate = new Date(session.endDate + 'T00:00:00Z')
    const externalId = `iceland_law_${session.number}_${billNumber}`
    const sourceExternalId = `iceland_source_${session.number}_${billNumber}`
    const sourceName = `Althingi ${session.number}. þing #${billNumber}`

    records.push({
      sessionNumber: session.number,
      billNumber,
      billType,
      claimText,
      enactedDate,
      enactedDateStr: session.endDate,
      sourceUrl,
      externalId,
      sourceExternalId,
      sourceName,
    })
  }
  return records
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const sessions = await fetchSessions()
  console.log(`  Found ${sessions.length} sessions (${MIN_SESSION}+)`)

  const all: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skippedDup = 0

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]
    const bills = await fetchSessionBills(session, verbose)
    let newCount = 0
    for (const b of bills) {
      if (seenIds.has(b.externalId)) { skippedDup++; continue }
      seenIds.add(b.externalId)
      all.push(b)
      newCount++
      if (hardLimit > 0 && all.length >= hardLimit) break
    }
    if (verbose || newCount > 0) {
      console.log(`  Session ${session.number} (ends ${session.endDate}): ${newCount} bills`)
    }
    if (hardLimit > 0 && all.length >= hardLimit) break
    if (i < sessions.length - 1) await sleep(PAGE_DELAY_MS)
  }

  if (skippedDup > 0) console.log(`  Skipped ${skippedDup} duplicate bill IDs`)
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
          sessionNumber: rec.sessionNumber,
          billNumber: rec.billNumber,
          billType: rec.billType,
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
  console.log(`\n── ${PIPELINE}: Iceland Althingi Enacted Legislation ──────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('is-althingi', 'Althingi (Iceland)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching enacted bills from Althingi XML API...')
  const candidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      sessionNumber: r.sessionNumber,
      billNumber: r.billNumber,
      billType: r.billType,
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

    fs.writeFileSync('pipeline-31-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-31-dry-run-sample.json')

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
