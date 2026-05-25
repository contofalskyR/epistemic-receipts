// Pipeline 113 — UN General Assembly Resolutions
// Dataset: UN Digital Library Voting Data collection, symbol pattern A/RES/*
// API: https://digitallibrary.un.org/search (MARC21 text format, of=tm)
// Scope: All GA resolutions with Plenary vote records (both recorded and without-vote)
// Run: npx tsx scripts/ingest-un-ga-resolutions.ts --dry-run
//      npx tsx scripts/ingest-un-ga-resolutions.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'un_ga_v1'
const UNDL_SEARCH = 'https://digitallibrary.un.org/search'
const PAGE_SIZE = 100
const THROTTLE_MS = 400
const DRY_RUN_SAMPLE = 20

// ── MARC21 text format parser ──────────────────────────────────────────────────
// Line format: {recid:9} {tag:3}{ind1:1}{ind2:1} {value...}
//   where subfields in value are delimited by $a, $b, etc.

interface MarcLine {
  tag: string
  ind1: string
  ind2: string
  value: string
}

interface ParsedRecord {
  recId: string  // 9-digit left-padded numeric ID (key)
  cleanId: string  // trimmed numeric ID (for URL)
  lines: MarcLine[]
}

function parseMarcText(text: string): ParsedRecord[] {
  const byId = new Map<string, MarcLine[]>()
  const order: string[] = []

  for (const raw of text.split('\n')) {
    if (raw.length < 16) continue
    const recId = raw.slice(0, 9)
    if (!/^\d{9}$/.test(recId)) continue
    const tag  = raw.slice(10, 13)
    const ind1 = raw.slice(13, 14)
    const ind2 = raw.slice(14, 15)
    const value = raw.slice(16)
    if (!byId.has(recId)) { byId.set(recId, []); order.push(recId) }
    byId.get(recId)!.push({ tag, ind1, ind2, value })
  }

  return order.map(recId => ({
    recId,
    cleanId: String(parseInt(recId, 10)),
    lines: byId.get(recId)!,
  }))
}

function getField(rec: ParsedRecord, tag: string): MarcLine | null {
  return rec.lines.find(l => l.tag === tag) ?? null
}

function getFields(rec: ParsedRecord, tag: string): MarcLine[] {
  return rec.lines.filter(l => l.tag === tag)
}

function subfield(value: string, code: string): string | null {
  const marker = `$$${code}`
  const idx = value.indexOf(marker)
  if (idx === -1) return null
  const start = idx + marker.length
  const next = value.indexOf('$', start)
  const raw = next === -1 ? value.slice(start) : value.slice(start, next)
  return raw.trim() || null
}

// ── Candidate record ───────────────────────────────────────────────────────────

interface GaResolution {
  externalId: string
  cleanId: string
  symbol: string
  title: string
  adoptedDate: Date
  adoptedDateStr: string
  sessionNumber: string | null
  voteType: 'without-vote' | 'recorded' | 'unknown'
  voteYes: number
  voteNo: number
  voteAbstain: number
  voteNonVoting: number
  meetingRecord: string | null
  sourceUrl: string
  claimText: string
}

function buildResolution(rec: ParsedRecord): GaResolution | null {
  // Symbol from 791__ $a
  const f791 = getField(rec, '791')
  if (!f791) return null
  const symbol = subfield(f791.value, 'a')
  if (!symbol || !symbol.startsWith('A/RES/')) return null

  const sessionNumber = subfield(f791.value, 'c')

  // Clean record ID from 001__
  const f001 = getField(rec, '001')
  const cleanId = f001 ? f001.value.trim() : rec.cleanId

  // Title from 24510 $a
  const f245 = getField(rec, '245')
  const titleRaw = f245 ? (subfield(f245.value, 'a') ?? '') : ''
  const title = titleRaw.replace(/\s*:\s*$/, '').trim().slice(0, 300)
  if (!title) return null

  // Adoption date from 269__ $a
  const f269 = getField(rec, '269')
  const dateStr = f269 ? subfield(f269.value, 'a') : null
  if (!dateStr) return null
  const adoptedDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(adoptedDate.getTime())) return null

  // Vote type from 590__ $a
  const f590 = getField(rec, '590')
  const voteSummary = f590 ? (subfield(f590.value, 'a') ?? '').toLowerCase() : ''
  const voteType: GaResolution['voteType'] =
    voteSummary.includes('without vote') ? 'without-vote' :
    voteSummary.includes('vote') ? 'recorded' : 'unknown'

  // Vote counts from 967__ (individual country votes)
  let voteYes = 0, voteNo = 0, voteAbstain = 0, voteNonVoting = 0
  for (const f of getFields(rec, '967')) {
    const d = subfield(f.value, 'd')
    if (d === 'Y') voteYes++
    else if (d === 'N') voteNo++
    else if (d === 'A') voteAbstain++
    else voteNonVoting++
  }

  // Meeting record from 952__
  const f952 = getField(rec, '952')
  const meetingRecord = f952 ? subfield(f952.value, 'a') : null

  const sourceUrl = `https://digitallibrary.un.org/record/${cleanId}`
  const externalId = `un_ga_${symbol.replace(/\//g, '_')}`

  const voteSuffix = voteType === 'without-vote' ? ' without vote'
    : voteType === 'recorded' ? ` (${voteYes}-${voteNo}-${voteAbstain})`
    : ''

  const claimText = `UN General Assembly Resolution ${symbol}: ${title}, adopted ${dateStr}${voteSuffix}`

  return {
    externalId, cleanId, symbol, title,
    adoptedDate, adoptedDateStr: dateStr,
    sessionNumber, voteType,
    voteYes, voteNo, voteAbstain, voteNonVoting,
    meetingRecord, sourceUrl, claimText,
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --full  [--limit N] [--verbose]'); process.exit(1) as never })()

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }

  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting ──────────────────────────────────────────────────────────────

let lastReqAt = 0
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── HTTP fetch with retry ──────────────────────────────────────────────────────

function httpsGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'curl/7.84.0' } }, res => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString('utf8') })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchText(url: string, retries = 3): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const { status, body } = await httpsGet(url)
    if ([429, 502, 503, 504].includes(status) && attempt < retries) {
      console.warn(`  HTTP ${status} — retrying in ${delay}ms`)
      await sleep(delay); delay *= 2; continue
    }
    if (status < 200 || status >= 300) throw new Error(`UNDL HTTP ${status} at ${url}`)
    return body
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Fetch one page of MARC records ─────────────────────────────────────────────

async function fetchPage(jrec: number): Promise<GaResolution[]> {
  const url = `${UNDL_SEARCH}?p=symbol%3AA%2FRES&of=tm&rg=${PAGE_SIZE}&ln=en&c=Voting+Data&jrec=${jrec}`
  const text = await fetchText(url)
  const records = parseMarcText(text)
  const results: GaResolution[] = []
  for (const rec of records) {
    const r = buildResolution(rec)
    if (r) results.push(r)
  }
  return results
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureTopics(): Promise<string> {
  await ensureTopic('international-law', 'International Law', 'law')
  return ensureTopic('un-general-assembly', 'UN General Assembly', 'law', 'international-law')
}

// ── Write one record (inside transaction) ─────────────────────────────────────

async function writeRow(tx: TxClient, rec: GaResolution, topicId: string): Promise<'ingested' | 'skipped'> {
  const existing = await tx.source.findFirst({ where: { url: rec.sourceUrl } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `UN Digital Library — ${rec.symbol}`,
      url: rec.sourceUrl,
      publishedAt: rec.adoptedDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `un_ga_source_${rec.externalId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.adoptedDate,
      claimEmergedPrecision: 'DAY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        resolutionNumber: rec.symbol,
        adoptedDate: rec.adoptedDateStr,
        sessionNumber: rec.sessionNumber,
        voteType: rec.voteType,
        voteYes: rec.voteYes,
        voteNo: rec.voteNo,
        voteAbstain: rec.voteAbstain,
        voteNonVoting: rec.voteNonVoting,
        meetingRecord: rec.meetingRecord,
        undlRecordId: rec.cleanId,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'PROCEDURAL',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 95,
      reason: 'UN Digital Library official voting record — General Assembly resolution, HARD_FACT',
      changedAt: rec.adoptedDate,
    },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline 113: UN General Assembly Resolutions ──────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // ── Dry-run ──────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nFetching first page from UN Digital Library (no DB writes)...')
    const firstPage = await fetchPage(1)
    console.log(`  Parsed ${firstPage.length} records from first page`)

    const sample = firstPage.slice(0, DRY_RUN_SAMPLE).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      symbol: r.symbol,
      adoptedDate: r.adoptedDateStr,
      sessionNumber: r.sessionNumber,
      voteType: r.voteType,
      voteYes: r.voteYes,
      voteNo: r.voteNo,
      voteAbstain: r.voteAbstain,
      voteNonVoting: r.voteNonVoting,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      ingestedBy: INGESTED_BY,
      source: { url: r.sourceUrl, methodologyType: 'primary' },
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: INGESTED_BY,
      mode: 'dry-run',
      apiUrl: `${UNDL_SEARCH}?p=symbol%3AA%2FRES&of=tm&rg=${PAGE_SIZE}&ln=en&c=Voting+Data`,
      estimatedTotal: '~20,774 (from UNDL HTML search count)',
      firstPageCount: firstPage.length,
      sampleRecords: DRY_RUN_SAMPLE,
      sample,
    }
    fs.writeFileSync('pipeline-113-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-113-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ──────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const topicId = await ensureTopics()
  console.log(`  un-general-assembly topic ID: ${topicId}`)

  console.log('\nStep 2: Fetching + ingesting from UN Digital Library...')
  const startTime = Date.now()
  let ingested = 0, skipped = 0, errors = 0, page = 0

  for (let jrec = 1; ; jrec += PAGE_SIZE) {
    page++
    if (verbose || page % 10 === 0) console.log(`  Fetching page ${page} (jrec=${jrec})...`)

    let records: GaResolution[]
    try {
      records = await fetchPage(jrec)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Fetch failed at jrec=${jrec}: ${msg}`)
      errors++
      break
    }

    if (records.length === 0) {
      console.log(`  Page ${page} returned 0 records — end of corpus`)
      break
    }

    for (const rec of records) {
      if (limit > 0 && ingested + skipped + errors >= limit) break
      try {
        const result = await prisma.$transaction(
          async (tx) => writeRow(tx, rec, topicId),
          { timeout: 30000 },
        )
        if (result === 'ingested') ingested++
        else skipped++
        if (verbose || ingested % 500 === 0) {
          console.log(`  [${result}] ${rec.symbol} — ${rec.title.slice(0, 60)}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed: ${rec.externalId} — ${msg}`)
        errors++
      }
    }

    if (limit > 0 && ingested + skipped + errors >= limit) {
      console.log(`  Limit of ${limit} reached, stopping.`)
      break
    }

    if (records.length < PAGE_SIZE) {
      console.log(`  Page ${page} returned ${records.length} < ${PAGE_SIZE} — end of corpus`)
      break
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${ingested} | Skipped: ${skipped} | Errors: ${errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims  = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges   = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (dbClaims !== ingested) {
    console.error(`  WARNING: DB claim count (${dbClaims}) ≠ ingested counter (${ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
