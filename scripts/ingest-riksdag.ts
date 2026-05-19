// Pipeline 19 — Sweden Riksdag Enacted Laws (riksdag_v1)
// Dataset: Riksdag Open Data API (data.riksdagen.se). Free, no API key required.
// Scope: Riksdagsskrivelser (doktyp=rskr) — formal adoption decisions sent from
//        Riksdag to the government when a bill is approved. One rskr per enacted law.
// Topic: se-riksdag (Swedish Riksdag, domain=government).
// Run: npx tsx scripts/ingest-riksdag.ts --dry-run
//      npx tsx scripts/ingest-riksdag.ts --sample 10
//      npx tsx scripts/ingest-riksdag.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'riksdag_v1'
const PIPELINE = 'Pipeline 19'
const API_BASE = 'https://data.riksdagen.se/dokumentlista/'
const PAGE_SIZE = 200
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

interface RiksdagDokument {
  id?: string
  dok_id?: string
  datum?: string
  titel?: string
  doktyp?: string
  rm?: string
  nummer?: string
  beteckning?: string
  relaterat_id?: string
  dokument_url_html?: string
}

interface RiksdagPage {
  dokumentlista: {
    '@traffar'?: string
    '@nasta_sida'?: string
    '@sida'?: string
    '@sidor'?: string
    dokument?: RiksdagDokument[]
  }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  doktyp: string
  rm: string
  nummer: string
  relatedId: string
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

function ensureHttps(url: string): string {
  if (url.startsWith('//')) return 'https:' + url
  if (url.startsWith('http://')) return 'https://' + url.slice('http://'.length)
  return url
}

async function fetchPage(url: string, retries = 4): Promise<RiksdagPage> {
  const target = ensureHttps(url)
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(target, { headers: { Accept: 'application/json' } })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at ${target} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Riksdag API ${res.status} at ${target}`)
      return await res.json() as RiksdagPage
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error at ${target}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at ${target}`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function escapeRm(rm: string): string {
  return rm.replace(/\//g, '_')
}

function buildCandidate(doc: RiksdagDokument, verbose: boolean): CandidateRecord | null {
  const rm = doc.rm?.trim() ?? ''
  const nummer = (doc.nummer ?? doc.beteckning ?? '').trim()
  const doktyp = doc.doktyp?.trim() ?? 'rskr'
  if (!rm || !nummer) {
    if (verbose) console.log(`  Skip ${doc.dok_id || doc.id}: missing rm/nummer (rm=${rm}, nummer=${nummer})`)
    return null
  }

  const dateStr = doc.datum?.slice(0, 10)
  if (!dateStr) {
    if (verbose) console.log(`  Skip rskr ${rm}:${nummer}: no datum`)
    return null
  }
  const enactedDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip rskr ${rm}:${nummer}: invalid datum=${dateStr}`)
    return null
  }

  const claimText = (doc.titel ?? '').trim()
  if (!claimText) {
    if (verbose) console.log(`  Skip rskr ${rm}:${nummer}: no titel`)
    return null
  }

  const rmEsc = escapeRm(rm)
  const externalId = `riksdag_rskr_${rmEsc}_${nummer}`
  const sourceExternalId = `riksdag_source_${rmEsc}_${nummer}`
  const sourceUrl = ensureHttps(doc.dokument_url_html ?? `https://data.riksdagen.se/dokument/${doc.dok_id ?? doc.id ?? ''}.html`)

  return {
    doktyp,
    rm,
    nummer,
    relatedId: doc.relaterat_id ?? '',
    claimText,
    enactedDate,
    enactedDateStr: dateStr,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: `Riksdag ${rm} #${nummer}`,
  }
}

// ── Fetch all rskr ─────────────────────────────────────────────────────────────

async function fetchAllRskr(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let total = -1
  let skippedMalformed = 0

  // Start from page 1, descending by date (newest first).
  let nextUrl: string | null = `${API_BASE}?doktyp=rskr&utformat=json&sort=datum&sortorder=desc&sz=${PAGE_SIZE}&p=1`
  let pagesFetched = 0

  while (nextUrl) {
    const page = await fetchPage(nextUrl)
    pagesFetched++
    const dl = page.dokumentlista
    if (total === -1) {
      total = parseInt(dl['@traffar'] ?? '0', 10) || 0
      console.log(`  API reports ${total} rskr documents available (${dl['@sidor'] ?? '?'} pages)`)
    }
    const docs = dl.dokument ?? []
    if (docs.length === 0) break

    let newOnPage = 0
    for (const d of docs) {
      const rec = buildCandidate(d, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break
    if (!dl['@nasta_sida']) break
    if (newOnPage === 0) break  // defensive: avoid infinite loop on duplicate page

    if (verbose) console.log(`  ...page ${pagesFetched}: cumulative ${candidates.length}/${total}`)
    nextUrl = dl['@nasta_sida']
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
          rm: rec.rm,
          nummer: rec.nummer,
          relaterat_id: rec.relatedId,
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

  console.log(`\n── ${PIPELINE}: Sweden Riksdag Enacted Laws ───────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('se-riksdag', 'Swedish Riksdag', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching riksdagsskrivelser from Riksdag API...')
  const candidates = await fetchAllRskr(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      doktyp: r.doktyp,
      rm: r.rm,
      nummer: r.nummer,
      relaterat_id: r.relatedId,
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

    fs.writeFileSync('pipeline-19-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-19-dry-run-sample.json')

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
