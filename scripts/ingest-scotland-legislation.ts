// Pipeline 57 — Scottish Parliament Enacted Acts (scotland_legislation_v1)
// Dataset: Scottish Parliament Open Data (data.parliament.scot). Free, no API key required.
// Scope: Bills that reached their final parliamentary stage (Sequence=3 — "Stage 3" or
// "Final Stage" depending on bill type). Parliamentary passage at Stage 3 is the
// authoritative enactment signal — Royal Assent follows automatically after the 4-week
// challenge window. The data.parliament.scot API does not expose a Royal Assent field;
// the parliamentary final-stage date is the canonical passage date.
// Run: npx tsx scripts/ingest-scotland-legislation.ts --dry-run
//      npx tsx scripts/ingest-scotland-legislation.ts --sample 10
//      npx tsx scripts/ingest-scotland-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'scotland_legislation_v1'
const PIPELINE = 'Pipeline 57'
const API_BASE = 'https://data.parliament.scot/api'
const PAGE_DELAY_MS = 300
const FINAL_STAGE_SEQUENCE = 3

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScotBill {
  ID: number
  Reference: string | null
  ShortName: string | null
  FullName: string | null
  BillTypeID: number
  PersonID: number | null
  ThirdPartyOrganisation: string | null
}

interface ScotBillStage {
  ID: number
  BillID: number
  BillStageTypeID: number
  StageDate: string
}

interface ScotBillStageType {
  ID: number
  Name: string
  BillTypeID: number
  Sequence: number
}

interface ScotBillType {
  ID: number
  Name: string
}

interface CandidateRecord {
  billId: number
  reference: string | null
  title: string
  shortName: string | null
  fullName: string | null
  billTypeId: number
  billTypeName: string
  finalStageName: string
  enactedDate: Date
  enactedDateStr: string
  parliamentarySession: string
  externalId: string
  sourceExternalId: string
  sourceUrl: string
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

function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': 'application/json',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${parsed.hostname}${res.headers.location}`
          res.resume()
          httpsGet(nextUrl, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchJson<T>(url: string, retries = 4, timeoutMs = 30_000): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, timeoutMs)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`)
      return JSON.parse(res.body) as T
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Fetch error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Parliamentary session lookup ───────────────────────────────────────────────
// Scottish Parliament sessions (post-devolution):
//   1: 1999-05-12 to 2003-04-01
//   2: 2003-05-07 to 2007-04-02
//   3: 2007-05-09 to 2011-03-22
//   4: 2011-05-11 to 2016-03-24
//   5: 2016-05-12 to 2021-05-05
//   6: 2021-05-13 to (current)
// Source: parliament.scot session boundaries.
function sessionFor(dateIso: string): string {
  const d = dateIso.slice(0, 10)
  if (d < '2003-05-07') return '1'
  if (d < '2007-05-09') return '2'
  if (d < '2011-05-11') return '3'
  if (d < '2016-05-12') return '4'
  if (d < '2021-05-13') return '5'
  return '6'
}

// ── Build candidates ───────────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  console.log('  Fetching Bills...')
  const bills = await fetchJson<ScotBill[]>(`${API_BASE}/Bills`)
  await sleep(PAGE_DELAY_MS)
  console.log(`    ${bills.length} bills`)

  console.log('  Fetching BillStages...')
  const stages = await fetchJson<ScotBillStage[]>(`${API_BASE}/BillStages`)
  await sleep(PAGE_DELAY_MS)
  console.log(`    ${stages.length} stage rows`)

  console.log('  Fetching BillStageTypes...')
  const stageTypes = await fetchJson<ScotBillStageType[]>(`${API_BASE}/BillStageTypes`)
  await sleep(PAGE_DELAY_MS)
  console.log(`    ${stageTypes.length} stage types`)

  console.log('  Fetching BillTypes...')
  const billTypes = await fetchJson<ScotBillType[]>(`${API_BASE}/BillTypes`)
  console.log(`    ${billTypes.length} bill types`)

  // Index: BillTypeID → final-stage BillStageTypeIDs (Sequence=3). Some bill types have
  // multiple Sequence=3 entries (rare quirk); we accept any of them as a "passed" signal.
  const finalStageIds = new Map<number, { ids: Set<number>; name: string }>()
  for (const st of stageTypes) {
    if (st.Sequence !== FINAL_STAGE_SEQUENCE) continue
    const entry = finalStageIds.get(st.BillTypeID) ?? { ids: new Set<number>(), name: st.Name }
    entry.ids.add(st.ID)
    if (!entry.name) entry.name = st.Name
    finalStageIds.set(st.BillTypeID, entry)
  }

  const billTypeName = new Map<number, string>()
  for (const bt of billTypes) billTypeName.set(bt.ID, bt.Name)

  // Index: BillID → earliest StageDate at final stage.
  const billPassageDate = new Map<number, { date: string; stageTypeId: number }>()
  for (const s of stages) {
    const finals = finalStageIds.get(
      bills.find(b => b.ID === s.BillID)?.BillTypeID ?? -1
    )
    if (!finals || !finals.ids.has(s.BillStageTypeID)) continue
    const existing = billPassageDate.get(s.BillID)
    if (!existing || s.StageDate < existing.date) {
      billPassageDate.set(s.BillID, { date: s.StageDate, stageTypeId: s.BillStageTypeID })
    }
  }

  const candidates: CandidateRecord[] = []
  let malformed = 0
  for (const b of bills) {
    const passage = billPassageDate.get(b.ID)
    if (!passage) continue

    const dateStr = passage.date.slice(0, 10)
    const enactedDate = new Date(dateStr + 'T00:00:00Z')
    if (isNaN(enactedDate.getTime())) { malformed++; continue }

    const title = (b.FullName?.trim()) || (b.ShortName?.trim()) || ''
    if (!title) { malformed++; continue }

    const typeName = billTypeName.get(b.BillTypeID) ?? `Type ${b.BillTypeID}`
    const finalStageName = finalStageIds.get(b.BillTypeID)?.name ?? 'Final Stage'

    candidates.push({
      billId: b.ID,
      reference: b.Reference ?? null,
      title,
      shortName: b.ShortName ?? null,
      fullName: b.FullName ?? null,
      billTypeId: b.BillTypeID,
      billTypeName: typeName,
      finalStageName,
      enactedDate,
      enactedDateStr: dateStr,
      parliamentarySession: sessionFor(passage.date),
      externalId: `scotland_act_${b.ID}`,
      sourceExternalId: `scotland_source_${b.ID}`,
      sourceUrl: `https://data.parliament.scot/api/Bills/${b.ID}`,
      sourceName: b.Reference
        ? `Scottish Parliament ${b.Reference}`
        : `Scottish Parliament Bill ${b.ID}`,
    })

    if (limit > 0 && candidates.length >= limit) break
  }

  if (verbose) {
    console.log(`    ${candidates.length} candidates, ${malformed} malformed dropped`)
  }
  // Sort newest-first so the JSON sample is the most recent acts.
  candidates.sort((a, b) => b.enactedDateStr.localeCompare(a.enactedDateStr))
  return candidates
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
    else console.warn(`  Parent topic ${parentSlug} not found — creating ${slug} without parent`)
  }

  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}${parentTopicId ? ` (parent: ${parentSlug})` : ''}`)
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
        text: rec.title,
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
          billId: rec.billId,
          reference: rec.reference,
          billType: rec.billTypeName,
          billTypeId: rec.billTypeId,
          billStatus: 'Passed',
          finalStageReached: rec.finalStageName,
          parliamentarySession: rec.parliamentarySession,
          shortName: rec.shortName,
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

  console.log(`\n── ${PIPELINE}: Scottish Parliament Enacted Acts ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('sc-parliament', 'Scottish Parliament', 'government', 'gov-region-europe')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching bills + stages from data.parliament.scot...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal enacted candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      reference: r.reference,
      billType: r.billTypeName,
      finalStageReached: r.finalStageName,
      parliamentarySession: r.parliamentarySession,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byType: Record<string, number> = {}
    const bySession: Record<string, number> = {}
    for (const r of allCandidates) {
      byType[r.billTypeName] = (byType[r.billTypeName] ?? 0) + 1
      bySession[r.parliamentarySession] = (bySession[r.parliamentarySession] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byBillType: byType, byParliamentarySession: bySession },
      sample,
    }

    fs.writeFileSync('pipeline-57-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-57-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by bill type:')
      for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k}: ${v}`)
      }
      console.log('\nDistribution by session:')
      for (const [k, v] of Object.entries(bySession).sort()) {
        console.log(`  Session ${k}: ${v}`)
      }
      console.log('\nSample titles (newest first):')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.title.slice(0, 110)}${r.title.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCandidates.slice(0, sampleN) : allCandidates

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
