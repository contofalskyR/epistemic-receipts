// Pipeline 78 — Georgia (Country) National Laws (georgia_legislation_v1)
// Dataset: Legislative Herald of Georgia (Matsne)
// Source: https://matsne.gov.ge/en/document/search?group=1000003&type=main
// No API key required — Matsne's public Drupal search exposes an XHR JSON wrapper
// that returns {pagination, documents_list} chunks of result HTML when the
// `is-ajax=1` query param is present (see document_search.js → filterDocs()).
// Scope: All Laws of Georgia (`group=1000003`), consolidated main documents only
// (`type=main`). English translation URL is recorded when the result row exposes
// a `?impose=translateEn` link; otherwise the canonical English /view/{id} page
// is used (which itself falls back to the Georgian original in-place).
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-georgia.ts --dry-run
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-georgia.ts --sample 10
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-georgia.ts --full [--limit N] [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'georgia_legislation_v1'
const PIPELINE = 'Pipeline 78'
const BASE_URL = 'https://matsne.gov.ge'
const SEARCH_PATH = '/en/document/search'
const GROUP_LAW = '1000003'        // "Law" group from the Matsne <select>
const TYPE_MAIN = 'main'           // consolidated main documents only
const REQUEST_DELAY_MS = 700       // polite to a small national gazette

// ── Types ──────────────────────────────────────────────────────────────────────

interface MatsneAjaxResponse {
  pagination: string
  documents_list: string
}

interface CandidateRecord {
  docId: string
  title: string
  docType: string        // e.g. "Law of Georgia"
  issuer: string         // e.g. "Parliament of Georgia"
  docNumber: string      // e.g. "N1451-Vმს-XIმპ"
  enactedDate: Date
  enactedDateStr: string // DD/MM/YYYY
  enactedYear: number
  hasEnglish: boolean
  hasParallelEnglish: boolean
  externalId: string
  sourceExternalId: string
  sourceUrl: string      // English-preferred URL
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

function httpsGetJson(url: string, timeoutMs = 30000): Promise<MatsneAjaxResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-GB,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGetJson(res.headers.location as string, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}: ${body.slice(0, 200)}`))
            return
          }
          try { resolve(JSON.parse(body) as MatsneAjaxResponse) }
          catch (e) { reject(new Error(`JSON parse failed (${url}): ${(e as Error).message}`)) }
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timed out: ${url}`)) })
    req.on('error', reject)
  })
}

// ── Parsers ────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function parseDdMmYyyy(raw: string): { date: Date | null; year: number } {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return { date: null, year: 0 }
  const [_, dd, mm, yyyy] = m
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`)
  if (isNaN(d.getTime())) return { date: null, year: 0 }
  return { date: d, year: parseInt(yyyy!, 10) }
}

function extractLastPage(paginationHtml: string): number {
  const m = paginationHtml.match(/page=(\d+)[^"]*"[^>]*>Last/)
  if (m) return parseInt(m[1]!, 10)
  const all = [...paginationHtml.matchAll(/data-pagenumber="(\d+)"/g)].map(x => parseInt(x[1]!, 10))
  return all.length ? Math.max(...all) : 1
}

function parsePanel(panel: string): CandidateRecord | null {
  // Title: <p><a href="/en/document/view/{id}">{title-may-have-newlines}</a></p>
  const titleMatch = panel.match(/<p><a href="\/en\/document\/view\/(\d+)">([\s\S]*?)<\/a><\/p>/)
  if (!titleMatch) return null
  const docId = titleMatch[1]!
  const title = decodeEntities(titleMatch[2]!).replace(/\s+/g, ' ').trim()
  if (!title || title.length < 3) return null

  // panel-body holds a list of <small> entries separated by ● bullets:
  //   small[0] = doc type ("Law of Georgia")
  //   small[1] = "●"
  //   small[2] = issuer ("Parliament of Georgia")
  //   small[3] = "●"
  //   small[4] = doc number (e.g. "N1451-Vმს-XIმპ")
  //   small[5] = "●"
  //   small[6] = date "DD/MM/YYYY"
  const bodyMatch = panel.match(/<div class="panel-body">([\s\S]*?)<\/div>/)
  if (!bodyMatch) return null
  const smalls = [...bodyMatch[1]!.matchAll(/<small>([\s\S]*?)<\/small>/g)]
    .map(m => decodeEntities(m[1]!).replace(/\s+/g, ' ').trim())
    .filter(s => s && s !== '●')

  if (smalls.length < 4) return null
  const [docType, issuer, docNumber, dateStr] = [smalls[0]!, smalls[1]!, smalls[2]!, smalls[3]!]

  const { date, year } = parseDdMmYyyy(dateStr)
  if (!date) return null

  const footer = panel.match(/<div class="panel-footer">([\s\S]*?)<\/div>/)?.[1] ?? ''
  const hasEnglish = footer.includes('impose=translateEn')
  const hasParallelEnglish = footer.includes('impose=parallelEn')

  const sourceUrl = hasEnglish
    ? `${BASE_URL}/en/document/view/${docId}?impose=translateEn`
    : `${BASE_URL}/en/document/view/${docId}`

  return {
    docId, title, docType, issuer, docNumber,
    enactedDate: date, enactedDateStr: dateStr, enactedYear: year,
    hasEnglish, hasParallelEnglish,
    externalId: `ge_law_${docId}`,
    sourceExternalId: `src_ge_law_${docId}`,
    sourceUrl,
  }
}

function parseDocsList(html: string): CandidateRecord[] {
  const records: CandidateRecord[] = []
  const panels = html
    .split('<div class="panel panel-success document-search-result-item">')
    .filter(p => p.includes('glyphicon-record'))
  for (const panel of panels) {
    const rec = parsePanel(panel)
    if (rec) records.push(rec)
  }
  return records
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const seen = new Set<string>()
  const records: CandidateRecord[] = []

  const page1Url = `${BASE_URL}${SEARCH_PATH}?is-ajax=1&page=1&group=${GROUP_LAW}&type=${TYPE_MAIN}`
  console.log(`  GET ${page1Url}`)
  const first = await httpsGetJson(page1Url)
  const lastPage = extractLastPage(first.pagination)
  console.log(`  Pagination: pages 1..${lastPage}`)

  const firstRecs = parseDocsList(first.documents_list)
  for (const r of firstRecs) {
    if (seen.has(r.externalId)) continue
    seen.add(r.externalId); records.push(r)
  }
  if (verbose) console.log(`  page 1: ${firstRecs.length} parsed`)
  if (limit > 0 && records.length >= limit) return records.slice(0, limit)

  for (let page = 2; page <= lastPage; page++) {
    await sleep(REQUEST_DELAY_MS)
    const url = `${BASE_URL}${SEARCH_PATH}?is-ajax=1&page=${page}&group=${GROUP_LAW}&type=${TYPE_MAIN}`
    try {
      const r = await httpsGetJson(url)
      const recs = parseDocsList(r.documents_list)
      let added = 0
      for (const rec of recs) {
        if (seen.has(rec.externalId)) continue
        seen.add(rec.externalId); records.push(rec); added++
      }
      if (verbose) console.log(`  page ${page}: ${recs.length} parsed (${added} new) — total ${records.length}`)
      else if (page % 5 === 0) console.log(`  ...page ${page}/${lastPage}, ${records.length} so far`)
      if (limit > 0 && records.length >= limit) return records.slice(0, limit)
    } catch (err) {
      console.error(`  page ${page} fetch failed: ${(err as Error).message}`)
    }
  }
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
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `Matsne (Georgia) — ${rec.title.slice(0, 100)}`,
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Georgia enacted the ${rec.title} (${rec.docNumber}) on ${rec.enactedDateStr}.`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          docId: rec.docId,
          docType: rec.docType,
          issuer: rec.issuer,
          docNumber: rec.docNumber,
          title: rec.title,
          enactedDate: rec.enactedDateStr,
          enactedYear: rec.enactedYear,
          hasEnglish: rec.hasEnglish,
          hasParallelEnglish: rec.hasParallelEnglish,
          country: 'Georgia',
          source: 'Matsne',
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

  console.log(`\n── ${PIPELINE}: Georgia (Country) National Laws (Matsne) ─────────`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}${limit ? ` limit=${limit}` : ''}`)
  console.log(`Source: matsne.gov.ge (Legislative Herald of Georgia) — group=Law, type=main`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true is required for sample/full modes (refusing to write to DB).')
    process.exit(2)
  }

  console.log('\nStep 1: Fetching law catalogue from Matsne...')
  const candidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)
  if (candidates.length === 0) {
    console.error('\nERROR: 0 candidates parsed — Matsne markup may have changed; inspect /en/document/search HTML.')
    process.exit(1)
  }

  // ── Dry-run ──────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const byYear: Record<string, number> = {}
    const byDecade: Record<string, number> = {}
    const byIssuer: Record<string, number> = {}
    const byDocType: Record<string, number> = {}
    let englishCount = 0, parallelEnglishCount = 0
    for (const r of candidates) {
      byYear[r.enactedYear] = (byYear[r.enactedYear] ?? 0) + 1
      const decade = `${Math.floor(r.enactedYear / 10) * 10}s`
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
      byIssuer[r.issuer] = (byIssuer[r.issuer] ?? 0) + 1
      byDocType[r.docType] = (byDocType[r.docType] ?? 0) + 1
      if (r.hasEnglish) englishCount++
      if (r.hasParallelEnglish) parallelEnglishCount++
    }

    const sample = candidates.slice(0, 15).map(r => ({
      externalId: r.externalId,
      docId: r.docId,
      title: r.title,
      docType: r.docType,
      issuer: r.issuer,
      docNumber: r.docNumber,
      enactedDate: r.enactedDateStr,
      hasEnglish: r.hasEnglish,
      hasParallelEnglish: r.hasParallelEnglish,
      sourceUrl: r.sourceUrl,
      claimText: `Georgia enacted the ${r.title} (${r.docNumber}) on ${r.enactedDateStr}.`,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      coverage: {
        englishTranslationAvailable: englishCount,
        parallelEnglishAvailable: parallelEnglishCount,
      },
      distribution: { byDocType, byIssuer, byDecade, byYear },
      sample,
    }

    fs.writeFileSync('pipeline-78-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-78-dry-run-sample.json')

    console.log('\nDocument-type distribution:')
    Object.entries(byDocType).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
    console.log('\nIssuer distribution (top 10):')
    Object.entries(byIssuer).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
    console.log('\nDecade distribution:')
    Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    console.log('\nEnglish coverage:')
    console.log(`  English translation link available: ${englishCount} / ${candidates.length} (${((100 * englishCount / candidates.length).toFixed(1))}%)`)
    console.log(`  Parallel English-Georgian view: ${parallelEnglishCount} / ${candidates.length} (${((100 * parallelEnglishCount / candidates.length).toFixed(1))}%)`)

    console.log('\nSample (first 5):')
    candidates.slice(0, 5).forEach((r, i) => console.log(
      `  ${i + 1}. ${r.title.slice(0, 75)}${r.title.length > 75 ? '…' : ''}\n     ${r.docNumber} · ${r.enactedDateStr} · ${r.issuer}${r.hasEnglish ? ' · [EN]' : ''}`
    ))
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // ── Sample / Full ────────────────────────────────────────────────────────────
  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('ge-parliament', 'Parliament of Georgia', 'government', 'gov-region-europe')

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 70)}`)
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
