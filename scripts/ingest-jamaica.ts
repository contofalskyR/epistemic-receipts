// Pipeline 79 — Jamaica National Acts of Parliament (jamaica_legislation_v1)
// Dataset: Laws of Jamaica (Ministry of Justice authoritative repository)
// Source: https://laws.moj.gov.jm/library/acts-of-parliament/{YYYY}
// No API key required. The library uses a DataTables AJAX endpoint:
//   POST /library/acts-of-parliament/{YYYY}
//   body: _dt=dt&draw=1&start=0&length=1000
//   headers: X-Requested-With: XMLHttpRequest
//   returns: {draw, recordsTotal, recordsFiltered, data:[{DT_RowId, shortTitle, legalAreas, year, actions}, ...]}
// (The Omines DataTables init request with _init=1 only returns the default page
// size of 10 rows — passing explicit start/length yields the full set per year.)
// Scope: every Act of Parliament listed for years 2000-2023 (the years exposed by
// the year-selector on laws.moj.gov.jm/library/acts-of-parliament). Detail pages
// occasionally carry "Operational Date" / "Last Amendment" but the field is
// almost always empty in the public site — the listing year is the only
// reliable date and so claimEmergedAt is set to Jan 1 of the act's year with
// YEAR precision.
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-jamaica.ts --dry-run
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-jamaica.ts --sample 10
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-jamaica.ts --full [--limit N] [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'jamaica_legislation_v1'
const PIPELINE = 'Pipeline 79'
const BASE_URL = 'https://laws.moj.gov.jm'
const YEAR_START = 2000
const YEAR_END = 2023
const REQUEST_DELAY_MS = 600

// ── Types ──────────────────────────────────────────────────────────────────────

interface JamaicaDtRow {
  DT_RowId: string
  shortTitle: string
  legalAreas: string
  year: string
  actions: string
}

interface JamaicaDtResponse {
  draw: number
  recordsTotal: number
  recordsFiltered: number
  data: JamaicaDtRow[]
}

interface CandidateRecord {
  slug: string
  rawTitle: string
  cleanedTitle: string
  actNumber: string | null
  year: number
  dtRowId: string
  pdfUrl: string | null
  externalId: string
  sourceExternalId: string
  sourceUrl: string
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

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── HTTP ───────────────────────────────────────────────────────────────────────

function httpsPostJson(url: string, body: string, timeoutMs = 30000): Promise<JamaicaDtResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Content-Length': Buffer.byteLength(body),
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false, // moj.gov.jm chain has cert-validation quirks for some clients
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const respBody = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}: ${respBody.slice(0, 200)}`))
            return
          }
          try { resolve(JSON.parse(respBody) as JamaicaDtResponse) }
          catch (e) { reject(new Error(`JSON parse failed (${url}): ${(e as Error).message}; body[0:200]=${respBody.slice(0, 200)}`)) }
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timed out: ${url}`)) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Parsers ────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Title strings in the listing use several historic prefix formats:
//   "No.1.-The Telecommunications Act, 2000."
//   "1_2023-The Road Traffic..."
//   "1_2010- The Finanacial Administration and..."
//   "1 of 2015 - The Disaster Risk Management Act"
//   "1 of 2020-The Patents and Designs Act"
//   "The Parliament (Integrity of Members) (Amendment) Act"          // no number prefix
function cleanTitle(raw: string): { cleaned: string; numberFromTitle: string | null } {
  let title = raw.replace(/\s+/g, ' ').trim()
  let actNum: string | null = null

  // "No.N.-…" or "No.N -…"
  let m = title.match(/^No\.(\d+[A-Z]?)\.?\s*[-–]\s*/i)
  if (m) { actNum = m[1]!; title = title.slice(m[0].length); }

  // "N_YYYY-…" or "N_YYYY -…"
  if (!actNum) {
    m = title.match(/^(\d+[A-Z]?)_\d{4}\s*[-–]?\s*/)
    if (m) { actNum = m[1]!; title = title.slice(m[0].length); }
  }

  // "N of YYYY -…"
  if (!actNum) {
    m = title.match(/^(\d+[A-Z]?)\s+of\s+\d{4}\s*[-–]?\s*/i)
    if (m) { actNum = m[1]!; title = title.slice(m[0].length); }
  }

  // Trailing year suffix that just repeats the listing year, e.g. ", 2000."
  title = title.replace(/,\s*\d{4}\.?$/, '').trim()
  // Trailing period
  title = title.replace(/\.$/, '').trim()
  // Collapse double spaces
  title = title.replace(/\s+/g, ' ').trim()

  return { cleaned: title, numberFromTitle: actNum }
}

// Slug → act-number fallback. Slugs encountered:
//   1-2023-the-road-traffic-…           → "1"
//   no-1-the-telecommunications-act-2000 → "1"
//   1-of-2015-the-disaster-risk-…       → "1"
//   the-parliament-integrity-of-…-1     → null (trailing -N is a row-disambiguator, not an act number)
function numberFromSlug(slug: string): string | null {
  let m = slug.match(/^(\d+[a-z]?)-/)
  if (m) return m[1]!.toUpperCase()
  m = slug.match(/^no-(\d+[a-z]?)-/)
  if (m) return m[1]!.toUpperCase()
  return null
}

function parsePdfPath(actionsHtml: string): string | null {
  const m = actionsHtml.match(/href="([^"]*\/download)"/)
  return m ? m[1]! : null
}

function parseRow(row: JamaicaDtRow): CandidateRecord | null {
  const decoded = decodeEntities(row.shortTitle)
  // <a href="/library/act-of-parliament/{slug}">{title}<a>   (note: opening <a> with closing <a>, not </a>)
  const m = decoded.match(/<a[^>]*href="\/library\/act-of-parliament\/([^"]+)"[^>]*>([\s\S]*?)<\/?a>/)
  if (!m) return null
  const slug = m[1]!.trim()
  if (!slug) return null
  const rawTitle = stripHtml(m[2]!)
  if (!rawTitle || rawTitle.length < 3) return null

  const year = parseInt(row.year, 10)
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null

  const { cleaned, numberFromTitle } = cleanTitle(rawTitle)
  const actNumber = numberFromTitle ?? numberFromSlug(slug)

  const externalId = `jm_aop_${slug}`
  const sourceExternalId = `src_jm_aop_${slug}`
  const sourceUrl = `${BASE_URL}/library/act-of-parliament/${slug}`

  return {
    slug, rawTitle, cleanedTitle: cleaned, actNumber, year,
    dtRowId: row.DT_RowId,
    pdfUrl: parsePdfPath(decodeEntities(row.actions)),
    externalId, sourceExternalId, sourceUrl,
  }
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const seen = new Set<string>()
  const records: CandidateRecord[] = []
  let serverReportedTotal = 0
  let parsedTotal = 0

  for (let year = YEAR_END; year >= YEAR_START; year--) {
    const url = `${BASE_URL}/library/acts-of-parliament/${year}`
    try {
      const resp = await httpsPostJson(url, '_dt=dt&draw=1&start=0&length=1000')
      serverReportedTotal += resp.recordsTotal
      let added = 0
      for (const row of resp.data) {
        const rec = parseRow(row)
        if (!rec) continue
        parsedTotal++
        if (seen.has(rec.externalId)) continue
        seen.add(rec.externalId); records.push(rec); added++
      }
      if (verbose) console.log(`  ${year}: server=${resp.recordsTotal} parsed=${resp.data.length} new=${added} — total ${records.length}`)
      else console.log(`  ${year}: ${added} acts (server reported ${resp.recordsTotal})`)
      if (limit > 0 && records.length >= limit) return records.slice(0, limit)
    } catch (err) {
      console.error(`  ${year} fetch failed: ${(err as Error).message}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`\n  Server-reported total across years: ${serverReportedTotal}`)
  console.log(`  Parsed rows (pre-dedup):            ${parsedTotal}`)
  console.log(`  Unique candidates after dedup:      ${records.length}`)
  return records
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    if (parentSlug && !existing.parentTopicId) {
      const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
      if (parent) {
        await prisma.topic.update({ where: { id: existing.id }, data: { parentTopicId: parent.id } })
        console.log(`  Reconciled parent on existing topic ${slug} → ${parentSlug}`)
      }
    }
    topicCache.set(slug, existing.id)
    return existing.id
  }
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

// ── Write one row ─────────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const enactedDate = new Date(`${rec.year}-01-01T00:00:00Z`)
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `Laws of Jamaica — ${rec.cleanedTitle.slice(0, 100)}`,
        url: rec.sourceUrl,
        publishedAt: enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const numberFragment = rec.actNumber ? ` (Act No. ${rec.actNumber} of ${rec.year})` : ` (${rec.year})`
    const claimText = `Jamaica enacted the ${rec.cleanedTitle}${numberFragment}.`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt: enactedDate,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          slug: rec.slug,
          dtRowId: rec.dtRowId,
          actNumber: rec.actNumber,
          year: rec.year,
          title: rec.cleanedTitle,
          rawTitle: rec.rawTitle,
          pdfUrl: rec.pdfUrl,
          country: 'Jamaica',
          source: 'laws.moj.gov.jm',
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
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: Jamaica National Acts of Parliament (Laws of Jamaica) ─────────`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}${limit ? ` limit=${limit}` : ''}`)
  console.log(`Source: laws.moj.gov.jm (Ministry of Justice) — Acts of Parliament ${YEAR_START}–${YEAR_END}`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true is required for sample/full modes (refusing to write to DB).')
    process.exit(2)
  }

  console.log('\nStep 1: Fetching Acts of Parliament catalogue (per year)...')
  const candidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal unique candidates: ${candidates.length}`)
  if (candidates.length === 0) {
    console.error('\nERROR: 0 candidates parsed — laws.moj.gov.jm markup may have changed.')
    process.exit(1)
  }

  // ── Dry-run ──────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const byYear: Record<string, number> = {}
    const byDecade: Record<string, number> = {}
    let withActNumber = 0, withPdf = 0
    for (const r of candidates) {
      byYear[r.year] = (byYear[r.year] ?? 0) + 1
      const decade = `${Math.floor(r.year / 10) * 10}s`
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
      if (r.actNumber) withActNumber++
      if (r.pdfUrl) withPdf++
    }

    const sample = candidates.slice(0, 15).map(r => ({
      externalId: r.externalId,
      slug: r.slug,
      year: r.year,
      actNumber: r.actNumber,
      cleanedTitle: r.cleanedTitle,
      rawTitle: r.rawTitle,
      pdfUrl: r.pdfUrl,
      sourceUrl: r.sourceUrl,
      claimText: `Jamaica enacted the ${r.cleanedTitle}${r.actNumber ? ` (Act No. ${r.actNumber} of ${r.year})` : ` (${r.year})`}.`,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      coverage: {
        actNumberExtractable: withActNumber,
        pdfLinkAvailable: withPdf,
      },
      distribution: { byDecade, byYear },
      sample,
    }

    fs.writeFileSync('pipeline-79-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-79-dry-run-sample.json')

    console.log('\nDecade distribution:')
    Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    console.log('\nYear distribution:')
    Object.entries(byYear).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    console.log('\nCoverage:')
    console.log(`  Act number parseable:      ${withActNumber} / ${candidates.length} (${(100 * withActNumber / candidates.length).toFixed(1)}%)`)
    console.log(`  PDF download link present: ${withPdf} / ${candidates.length} (${(100 * withPdf / candidates.length).toFixed(1)}%)`)

    console.log('\nSample (first 5):')
    candidates.slice(0, 5).forEach((r, i) => console.log(
      `  ${i + 1}. ${r.cleanedTitle.slice(0, 75)}${r.cleanedTitle.length > 75 ? '…' : ''}\n     Act ${r.actNumber ?? '?'} of ${r.year} · slug=${r.slug.slice(0, 60)}`
    ))
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // ── Sample / Full ────────────────────────────────────────────────────────────
  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('jm-parliament', 'Parliament of Jamaica', 'government', 'gov-region-americas')

  const rows = mode === 'sample' ? candidates.slice(0, sampleN) : candidates
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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.cleanedTitle.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length} processed...\r`)
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

  if (mode === 'sample') console.log('\nAwaiting explicit go-ahead before full run.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
