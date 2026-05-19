// Pipeline 17 — NATO Official Texts (nato_official_texts_v1)
// Dataset: NATO CPS (www.nato.int/cps/en/natohq/official_texts_NNNNN.htm)
// Document-ID enumeration: Wayback CDX API (prefix match)
// Scope: NATO official texts — summit communiqués, strategic concepts, declarations,
//        policy guidelines, etc. (~343 documents).
// Run: npx tsx scripts/ingest-nato-official-texts.ts --dry-run
//      npx tsx scripts/ingest-nato-official-texts.ts --sample 10
//      npx tsx scripts/ingest-nato-official-texts.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'nato_official_texts_v1'
const CDX_ENDPOINT = 'https://web.archive.org/cdx/search/cdx'
const CPS_BASE = 'https://www.nato.int/cps/en/natohq'
const USER_AGENT = 'epistemic-receipts/1.0 (academic research; robert.contofalsky@rutgers.edu)'
const FETCH_DELAY_MS = 500
const BATCH = 50

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number; notFound: number }

interface NatoDocument {
  docId: string                 // numeric CPS id, e.g. "210907"
  externalId: string            // "nato_official_texts_210907"
  cpsUrl: string                // canonical CPS URL
  finalUrl: string              // URL after redirects
  title: string
  documentDate: Date            // ISO date
  documentDateStr: string       // original string from page
  documentDatePrecision: 'DAY' | 'MONTH' | 'YEAR'
  claimText: string
}

// ── Wayback CDX enumeration ────────────────────────────────────────────────────

async function fetchCdxDocIds(verbose: boolean): Promise<string[]> {
  const params = new URLSearchParams({
    url: 'nato.int/cps/en/natohq/official_texts_',
    matchType: 'prefix',
    output: 'json',
    fl: 'original',
    collapse: 'urlkey',
    filter: 'statuscode:200',
  })
  const url = `${CDX_ENDPOINT}?${params}`
  if (verbose) console.log(`  CDX query: ${url}`)

  const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!resp.ok) throw new Error(`CDX error ${resp.status}: ${await resp.text()}`)
  const rows = await resp.json() as string[][]

  // First row is the header
  const data = rows.slice(1)
  if (verbose) console.log(`  CDX raw rows: ${data.length}`)

  const idRegex = /\/official_texts_(\d+)\.htm/i
  const seen = new Set<string>()
  for (const row of data) {
    const original = row[0]
    if (!original) continue
    const m = original.match(idRegex)
    if (!m) continue
    seen.add(m[1]!)
  }
  return Array.from(seen).sort((a, b) => Number(a) - Number(b))
}

// ── HTML fetching + parsing ────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

const MONTH_LOOKUP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

function parseHumanDate(raw: string): { date: Date; precision: 'DAY' | 'MONTH' | 'YEAR' } | null {
  const clean = raw.replace(/^\s*Updated:\s*/i, '').trim()

  // "04 April 1949" or "29 June 2022"
  const dmy = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (dmy) {
    const day = parseInt(dmy[1]!, 10)
    const month = MONTH_LOOKUP[dmy[2]!.toLowerCase()]
    const year = parseInt(dmy[3]!, 10)
    if (month) {
      const d = new Date(Date.UTC(year, month - 1, day))
      if (!isNaN(d.getTime())) return { date: d, precision: 'DAY' }
    }
  }

  // "April 1949"
  const my = clean.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (my) {
    const month = MONTH_LOOKUP[my[1]!.toLowerCase()]
    const year = parseInt(my[2]!, 10)
    if (month) {
      const d = new Date(Date.UTC(year, month - 1, 1))
      if (!isNaN(d.getTime())) return { date: d, precision: 'MONTH' }
    }
  }

  // "1949"
  const y = clean.match(/^(\d{4})$/)
  if (y) {
    const year = parseInt(y[1]!, 10)
    const d = new Date(Date.UTC(year, 0, 1))
    if (!isNaN(d.getTime())) return { date: d, precision: 'YEAR' }
  }

  return null
}

function parseDdMmYyyy(raw: string): { date: Date; precision: 'DAY' | 'MONTH' | 'YEAR' } | null {
  // "13/11/2025"
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const day = parseInt(m[1]!, 10)
  const month = parseInt(m[2]!, 10)
  const year = parseInt(m[3]!, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (isNaN(d.getTime())) return null
  return { date: d, precision: 'DAY' }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

interface ParsedPage {
  title: string | null
  documentDate: { date: Date; precision: 'DAY' | 'MONTH' | 'YEAR'; raw: string } | null
}

function parsePage(html: string): ParsedPage {
  // Title: prefer dedicated h1 over generic CMS chrome
  const h1 = html.match(/<h1[^>]*class="[^"]*\bh2-style\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
  let title: string | null = null
  if (h1) {
    const inner = h1[1]!.replace(/<[^>]+>/g, '').trim()
    title = decodeEntities(inner).replace(/\s+/g, ' ').trim() || null
  }

  // Date: prefer dateTime-created, fall back to dateTime-updated, then JS lastupdated_date
  let documentDate: ParsedPage['documentDate'] = null

  const created = html.match(/<p[^>]*class="[^"]*heading-template__dateTime-created[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
  if (created) {
    const raw = decodeEntities(created[1]!.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    const parsed = parseHumanDate(raw)
    if (parsed) documentDate = { ...parsed, raw }
  }

  if (!documentDate) {
    const updated = html.match(/<p[^>]*class="[^"]*heading-template__dateTime-updated[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    if (updated) {
      const raw = decodeEntities(updated[1]!.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
      const parsed = parseHumanDate(raw)
      if (parsed) documentDate = { ...parsed, raw }
    }
  }

  if (!documentDate) {
    // JS template var: lastupdated_date: "DD\/MM\/YYYY"
    const js = html.match(/lastupdated_date:\s*"(\d{1,2})\\?\/(\d{1,2})\\?\/(\d{4})"/)
    if (js) {
      const raw = `${js[1]}/${js[2]}/${js[3]}`
      const parsed = parseDdMmYyyy(raw)
      if (parsed) documentDate = { ...parsed, raw }
    }
  }

  return { title, documentDate }
}

async function fetchDoc(docId: string, verbose: boolean): Promise<{ status: 'ok'; doc: NatoDocument } | { status: '404' } | { status: 'error'; reason: string }> {
  const cpsUrl = `${CPS_BASE}/official_texts_${docId}.htm`
  let resp: Response
  try {
    resp = await fetch(cpsUrl, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' }, redirect: 'follow' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: 'error', reason: `fetch failed: ${msg}` }
  }

  if (resp.status === 404) return { status: '404' }
  if (!resp.ok) return { status: 'error', reason: `HTTP ${resp.status}` }

  const finalUrl = resp.url || cpsUrl
  const html = await resp.text()

  // Some NATO 404s return HTTP 200 with a 404 title — guard against that.
  if (/<title>\s*404\s*<\/title>/i.test(html)) return { status: '404' }

  const parsed = parsePage(html)
  if (!parsed.title) return { status: 'error', reason: 'no title found' }
  if (!parsed.documentDate) return { status: 'error', reason: 'no document date found' }

  const externalId = `nato_official_texts_${docId}`
  const isoDate = parsed.documentDate.date.toISOString().slice(0, 10)
  const claimText = `NATO official text "${parsed.title}" was issued on ${isoDate}.`

  if (verbose) console.log(`  ${docId} → ${parsed.title.slice(0, 80)} (${isoDate})`)

  return {
    status: 'ok',
    doc: {
      docId,
      externalId,
      cpsUrl,
      finalUrl,
      title: parsed.title,
      documentDate: parsed.documentDate.date,
      documentDateStr: parsed.documentDate.raw,
      documentDatePrecision: parsed.documentDate.precision,
      claimText,
    },
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function ensureTopic(tx: TxClient, slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await tx.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await tx.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one record ──────────────────────────────────────────────────────────

async function writeRow(tx: TxClient, doc: NatoDocument, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: doc.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.create({
      data: {
        externalId: `${doc.externalId}_source`,
        name: doc.title,
        url: doc.cpsUrl,
        publishedAt: doc.documentDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        humanReviewed: false,
        autoApproved: true,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: doc.claimText,
        currentStatus: 'HARD_FACT',
        claimType: 'INSTITUTIONAL',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: doc.documentDate,
        claimEmergedPrecision: doc.documentDatePrecision,
        ingestedBy: INGESTED_BY,
        humanReviewed: false,
        autoApproved: true,
        externalId: doc.externalId,
        metadata: {
          dataset: INGESTED_BY,
          docId: doc.docId,
          cpsUrl: doc.cpsUrl,
          finalUrl: doc.finalUrl,
          documentDate: doc.documentDate.toISOString().slice(0, 10),
          documentDateRaw: doc.documentDateStr,
          documentDatePrecision: doc.documentDatePrecision,
        },
      },
    })

    await tx.edge.create({
      data: {
        sourceId: source.id,
        claimId: claim.id,
        type: 'CITES',
        evidenceType: 'EVIDENTIARY',
        ingestedBy: INGESTED_BY,
        humanReviewed: false,
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
    console.error(`  Error writing ${doc.externalId}: ${err}`)
    return 'failed'
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample [N] | --full [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const sampleIdx = args.indexOf('--sample')
  const limitIdx = args.indexOf('--limit')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    sampleN: sampleIdx !== -1 ? parseInt(args[sampleIdx + 1] ?? '10', 10) : 10,
    limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '0', 10) : 0,
    verbose: args.includes('--verbose'),
  }
}

async function main() {
  const { mode, sampleN, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline 17: NATO Official Texts ───────────────────────────────────`)
  console.log(`Mode: ${mode} | Sample/limit: ${sampleN}/${limit || 'all'} | Verbose: ${verbose}`)

  // Phase 1: enumerate document IDs from Wayback CDX
  console.log('\nPhase 1: Enumerating document IDs from Wayback CDX...')
  const docIds = await fetchCdxDocIds(verbose)
  console.log(`  Unique numeric IDs: ${docIds.length}`)

  // Decide how many to process based on mode
  let idsToProcess: string[]
  if (mode === 'dry-run') idsToProcess = docIds.slice(0, Math.min(10, docIds.length))
  else if (mode === 'sample') idsToProcess = docIds.slice(0, sampleN)
  else idsToProcess = limit > 0 ? docIds.slice(0, limit) : docIds

  // Phase 2: fetch + parse each page
  console.log(`\nPhase 2: Fetching ${idsToProcess.length} CPS pages (${FETCH_DELAY_MS}ms between requests)...`)
  const docs: NatoDocument[] = []
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0, notFound: 0 }
  const fetchErrors: { docId: string; reason: string }[] = []

  for (let i = 0; i < idsToProcess.length; i++) {
    const docId = idsToProcess[i]!
    if (i > 0) await sleep(FETCH_DELAY_MS)
    const result = await fetchDoc(docId, verbose)
    if (result.status === 'ok') docs.push(result.doc)
    else if (result.status === '404') counts.notFound++
    else { counts.errors++; fetchErrors.push({ docId, reason: result.reason }) }

    if ((i + 1) % 25 === 0 || i + 1 === idsToProcess.length) {
      process.stdout.write(`  ${i + 1}/${idsToProcess.length} fetched (${docs.length} ok, ${counts.notFound} 404s, ${counts.errors} errors)\r`)
    }
  }
  console.log('')

  console.log(`\n  Live docs:   ${docs.length}`)
  console.log(`  404/dead:    ${counts.notFound}`)
  console.log(`  Fetch errs:  ${counts.errors}`)

  // ── Dry run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const sample = docs.slice(0, 10).map(d => ({
      externalId: d.externalId,
      claimText: d.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      metadata: {
        docId: d.docId,
        cpsUrl: d.cpsUrl,
        finalUrl: d.finalUrl,
        title: d.title,
        documentDate: d.documentDate.toISOString().slice(0, 10),
        documentDateRaw: d.documentDateStr,
        documentDatePrecision: d.documentDatePrecision,
      },
    }))

    const output = {
      runDate: new Date().toISOString(),
      mode: 'dry-run',
      cdxTotalIds: docIds.length,
      docsFetched: idsToProcess.length,
      docsParsedOk: docs.length,
      notFound: counts.notFound,
      fetchErrors: counts.errors,
      fetchErrorDetails: fetchErrors,
      sample,
    }

    fs.writeFileSync('pipeline-17-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-17-dry-run-sample.json')
    console.log('\nSample claims:')
    docs.slice(0, 5).forEach((d, i) => {
      console.log(`  ${i + 1}. ${d.externalId} — ${d.title.slice(0, 80)} (${d.documentDate.toISOString().slice(0, 10)})`)
    })
    console.log('\nDry-run complete. STOP — awaiting explicit go-ahead before sample/full run.')
    return
  }

  // ── Sample (rolled-back transaction) ───────────────────────────────────────
  if (mode === 'sample') {
    console.log(`\nPhase 3: Sample run (${docs.length} rows in rolled-back transaction)...`)
    let ingested = 0, skipped = 0, errors = 0
    try {
      await prisma.$transaction(async (tx) => {
        const topicId = await ensureTopic(tx, 'nato-official-texts', 'NATO Official Texts', 'government')
        for (const doc of docs) {
          const result = await writeRow(tx, doc, topicId)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] ${doc.externalId}`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\n  Rolled back. Would have ingested: ${ingested}, skipped: ${skipped}, errors: ${errors}`)
      } else {
        throw e
      }
    }
    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback DB count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ────────────────────────────────────────────────────────────────
  console.log('\nPhase 3: Ensuring topic...')
  const topicId = await ensureTopic(prisma as unknown as TxClient, 'nato-official-texts', 'NATO Official Texts', 'government')

  console.log(`\nPhase 4: Writing ${docs.length} records (batch ${BATCH}, transaction timeout 30s)...`)
  const startTime = Date.now()

  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH)
    await prisma.$transaction(async (tx) => {
      for (const doc of batch) {
        const result = await writeRow(tx, doc, topicId)
        if (result === 'ingested') counts.ingested++
        else if (result === 'skipped') counts.skipped++
        else counts.errors++
      }
    }, { timeout: 30000 })
    process.stdout.write(`  ${Math.min(i + BATCH, docs.length)}/${docs.length} written...\r`)
  }
  console.log('')

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Not Found: ${counts.notFound} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)
  if (dbClaims !== counts.ingested) {
    console.error(`  WARNING: DB claim count (${dbClaims}) does not match ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
