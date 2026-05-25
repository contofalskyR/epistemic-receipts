// Pipeline 114 — ECHR (European Court of Human Rights) Judgments
// Dataset: HUDOC case database, importance 1 (Grand Chamber) and 2 (Chamber)
// API: https://hudoc.echr.coe.int/app/query/results
// Scope: English full judgments (HEJUD) where importance IN (1, 2)
// Run: npx tsx scripts/ingest-echr.ts --dry-run
//      npx tsx scripts/ingest-echr.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'echr_v1'
const HUDOC_BASE = 'https://hudoc.echr.coe.int/app/query/results'
const PAGE_SIZE = 500
const THROTTLE_MS = 400
const DRY_RUN_SAMPLE = 20

// ── HUDOC record types ─────────────────────────────────────────────────────────

interface HudocResult {
  itemid: string
  docname: string
  respondent: string
  article: string      // pipe-separated articles, e.g. "6|6-1|13"
  conclusion: string   // pipe-separated conclusions
  judgementdate: string
  importance: string   // "1" | "2"
  kpdate: string
}

interface EchrJudgment {
  externalId: string
  itemid: string
  docname: string
  respondent: string
  articles: string[]
  conclusion: string
  judgmentDate: Date
  judgmentDateStr: string
  importance: 1 | 2
  importanceLabel: string
  sourceUrl: string
  claimText: string
}

function buildJudgment(r: HudocResult): EchrJudgment | null {
  if (!r.itemid || !r.docname) return null

  const importanceNum = parseInt(r.importance, 10)
  if (importanceNum !== 1 && importanceNum !== 2) return null

  // judgementdate is "MM/DD/YYYY HH:mm:ss" — convert to ISO
  const raw = r.judgementdate ?? ''
  const dateParts = raw.split(' ')[0]?.split('/') // ["MM", "DD", "YYYY"]
  if (!dateParts || dateParts.length !== 3) return null
  const dateStr = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`
  const judgmentDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(judgmentDate.getTime())) return null

  const articles = r.article
    ? r.article.split(';').map(a => a.trim()).filter(Boolean)
    : []

  const importanceLabel = importanceNum === 1 ? 'Grand Chamber' : 'Chamber'
  const respondent = r.respondent || 'Unknown respondent'
  const docname = r.docname.slice(0, 300)

  // Build article summary for claim text
  // Use only top-level articles (no sub-articles like "6-1", "P1-1"), deduplicated
  const topArticles = [...new Set(articles.filter(a => /^\d+$|^P\d+-\d+$/.test(a) || /^P\d+$/.test(a)))]
  const articleSummary = topArticles.length > 0
    ? topArticles.slice(0, 3).join(', ') + (topArticles.length > 3 ? ' +more' : '')
    : articles.slice(0, 3).join(', ') || 'multiple articles'

  const claimText = `${docname} — ${respondent} judgment (${importanceLabel}, ${dateStr}), ECHR Article ${articleSummary}`
  const sourceUrl = `https://hudoc.echr.coe.int/eng?i=${encodeURIComponent(r.itemid)}`
  const externalId = `echr_${r.itemid.replace(/[^a-zA-Z0-9_-]/g, '_')}`

  return {
    externalId, itemid: r.itemid, docname, respondent,
    articles, conclusion: r.conclusion || '',
    judgmentDate, judgmentDateStr: dateStr,
    importance: importanceNum as 1 | 2, importanceLabel,
    sourceUrl, claimText,
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

// ── HTTP fetch (https module, avoids HTTP/2 issues) ───────────────────────────

function httpsGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'curl/7.84.0', 'Accept': 'application/json' } }, res => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString('utf8') })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const { status, body } = await httpsGet(url)
    if ([429, 502, 503, 504].includes(status) && attempt < retries) {
      console.warn(`  HTTP ${status} — retrying in ${delay}ms`)
      await sleep(delay); delay *= 2; continue
    }
    if (status < 200 || status >= 300) throw new Error(`HUDOC HTTP ${status} at ${url}`)
    return JSON.parse(body) as T
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Fetch one page of HUDOC results ───────────────────────────────────────────

interface HudocResponse {
  resultcount: number
  results: Array<{ columns: HudocResult }>
}

async function fetchPage(start: number): Promise<{ total: number; items: EchrJudgment[] }> {
  const query = encodeURIComponent(
    'contentsitename:ECHR AND doctype:HEJUD AND (importance:1 OR importance:2)'
  )
  const fields = encodeURIComponent('itemid,docname,respondent,article,conclusion,judgementdate,importance,kpdate')
  const sort = encodeURIComponent('kpdate Descending')
  const url = `${HUDOC_BASE}?query=${query}&select=${fields}&sort=${sort}&start=${start}&length=${PAGE_SIZE}`

  const data = await fetchJson<HudocResponse>(url)
  const items: EchrJudgment[] = []
  for (const row of data.results ?? []) {
    const j = buildJudgment(row.columns)
    if (j) items.push(j)
  }
  return { total: data.resultcount ?? 0, items }
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
  await ensureTopic('human-rights', 'Human Rights', 'law', 'international-law')
  return ensureTopic('echr-judgments', 'ECHR Judgments', 'law', 'human-rights')
}

// ── Write one record (inside transaction) ─────────────────────────────────────

async function writeRow(tx: TxClient, rec: EchrJudgment, topicId: string): Promise<'ingested' | 'skipped'> {
  const existing = await tx.source.findFirst({ where: { url: rec.sourceUrl } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `HUDOC — ${rec.docname.slice(0, 200)}`,
      url: rec.sourceUrl,
      publishedAt: rec.judgmentDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `echr_source_${rec.externalId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.judgmentDate,
      claimEmergedPrecision: 'DAY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        itemid: rec.itemid,
        respondent: rec.respondent,
        articles: rec.articles,
        conclusion: rec.conclusion,
        importance: rec.importance,
        importanceLabel: rec.importanceLabel,
        judgmentDate: rec.judgmentDateStr,
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
      reason: 'HUDOC official judgment record — ECHR Grand Chamber or Chamber, HARD_FACT',
      changedAt: rec.judgmentDate,
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

  console.log(`\n── Pipeline 114: ECHR Judgments ──────────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // ── Dry-run ──────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nFetching first page from HUDOC (no DB writes)...')
    const { total, items } = await fetchPage(0)
    console.log(`  Total corpus: ${total} | Parsed from first page: ${items.length}`)

    const sample = items.slice(0, DRY_RUN_SAMPLE).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      itemid: r.itemid,
      respondent: r.respondent,
      articles: r.articles,
      judgmentDate: r.judgmentDateStr,
      importance: r.importance,
      importanceLabel: r.importanceLabel,
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
      apiUrl: HUDOC_BASE,
      query: 'contentsitename:ECHR AND doctype:HEJUD AND (importance:1 OR importance:2)',
      totalCorpus: total,
      firstPageCount: items.length,
      sampleRecords: DRY_RUN_SAMPLE,
      sample,
    }
    fs.writeFileSync('pipeline-114-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-114-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ──────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const topicId = await ensureTopics()
  console.log(`  echr-judgments topic ID: ${topicId}`)

  console.log('\nStep 2: Fetching + ingesting from HUDOC...')
  const startTime = Date.now()
  let ingested = 0, skipped = 0, errors = 0, total = 0, page = 0

  for (let start = 0; ; start += PAGE_SIZE) {
    page++
    if (verbose || page % 5 === 0) console.log(`  Fetching page ${page} (start=${start})...`)

    let items: EchrJudgment[]
    try {
      const result = await fetchPage(start)
      if (page === 1) {
        total = result.total
        console.log(`  Total corpus: ${total}`)
      }
      items = result.items
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Fetch failed at start=${start}: ${msg}`)
      errors++
      break
    }

    if (items.length === 0) {
      console.log(`  Page ${page} returned 0 records — end of corpus`)
      break
    }

    for (const rec of items) {
      if (limit > 0 && ingested + skipped + errors >= limit) break
      try {
        const result = await prisma.$transaction(
          async (tx) => writeRow(tx, rec, topicId),
          { timeout: 30000 },
        )
        if (result === 'ingested') ingested++
        else skipped++
        if (verbose || ingested % 250 === 0) {
          console.log(`  [${result}] ${rec.itemid} — ${rec.docname.slice(0, 60)}`)
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

    if (start + PAGE_SIZE >= total && total > 0) {
      console.log(`  Reached end of corpus (${total} total)`)
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
