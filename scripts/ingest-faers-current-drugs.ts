// Pipeline 8 — FAERS Current Drugs ingester
// Dataset: openFDA FAERS via patient.drug.openfda.generic_name.exact
// Creates: Claims (INSTITUTIONAL HARD_FACT), Sources, Edges, ClaimTopic edges
// Run: npx tsx scripts/ingest-faers-current-drugs.ts --dry-run
//      npx tsx scripts/ingest-faers-current-drugs.ts --sample 10
//      npx tsx scripts/ingest-faers-current-drugs.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const INGESTED_BY = 'faers_normalized_drugs_v1'
const BATCH_SIZE = 100
const QUERY_DATE = new Date().toISOString().split('T')[0]
const QUERY_DATE_NO_DASHES = QUERY_DATE.replace(/-/g, '')
const OPENFDA_BASE = 'https://api.fda.gov/drug/event.json'
const API_KEY = process.env.OPENFDA_API_KEY ?? ''
const CACHE_DIR = 'data/faers'
const CACHE_FILE = path.join(CACHE_DIR, `drug-list-${QUERY_DATE}.json`)

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpenFDAMeta {
  last_updated?: string
  results?: { skip?: number; limit?: number; total?: number }
}

interface OpenFDAListResponse {
  meta?: OpenFDAMeta
  results?: DrugEntry[]
  error?: { code: string; message: string }
}

interface OpenFDACountResponse {
  meta?: OpenFDAMeta
  results?: { term: string | number; count: number }[]
  error?: { code: string; message: string }
}

interface DrugEntry {
  term: string
  count: number
}

interface DrugRecord {
  drug_name: string
  drug_name_slug: string
  total_reports: number
  query_date: string
  query_url: string
  externalId: string
  sourceExternalId: string
  claimText: string
  sourceName: string
}

interface DeadLetter {
  drug_name: string | null
  count: number | null
  reason: string
}

interface DrugListCache {
  drugs: DrugEntry[]
  lastUpdated: string
  fetchedAt: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : args.includes('--sample') ? 'sample'
    : null

  if (!mode) {
    console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]')
    process.exit(1)
  }

  const limitIdx  = args.indexOf('--limit')
  const sampleIdx = args.indexOf('--sample')

  return {
    mode,
    limit:   limitIdx  !== -1 ? parseInt(args[limitIdx  + 1] ?? '0',  10) : 0,
    sampleN: sampleIdx !== -1 ? parseInt(args[sampleIdx + 1] ?? '10', 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function buildQueryUrl(drugName: string): string {
  const encodedName = encodeURIComponent(drugName).replace(/%20/g, '+')
  return `${OPENFDA_BASE}?search=patient.drug.openfda.generic_name.exact:%22${encodedName}%22+AND+receivedate:%5B20040101+TO+${QUERY_DATE_NO_DASHES}%5D&limit=1`
}

async function fetchJSON<T>(url: string): Promise<T> {
  const apiUrl = API_KEY ? `${url}&api_key=${encodeURIComponent(API_KEY)}` : url
  const res = await fetch(apiUrl)
  return res.json() as Promise<T>
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Phase 1: Fetch drug list ──────────────────────────────────────────────────

async function fetchDrugList(): Promise<{ drugs: DrugEntry[]; lastUpdated: string }> {
  if (fs.existsSync(CACHE_FILE)) {
    console.log(`  Using cached drug list: ${CACHE_FILE}`)
    const cached: DrugListCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    console.log(`  Cached entry count: ${cached.drugs.length}`)
    return { drugs: cached.drugs, lastUpdated: cached.lastUpdated }
  }

  console.log('  Fetching drug list from openFDA...')
  const allDrugs: DrugEntry[] = []
  let lastUpdated = ''
  const MAX_PAGES = 100

  for (let page = 0; page < MAX_PAGES; page++) {
    const skip = page * 1000
    let url = `${OPENFDA_BASE}?search=receivedate:%5B20040101+TO+${QUERY_DATE_NO_DASHES}%5D&count=patient.drug.openfda.generic_name.exact&limit=1000`
    if (skip > 0) url += `&skip=${skip}`

    const data = await fetchJSON<OpenFDAListResponse>(url)

    if (data.error) {
      if (data.error.code === 'BAD_REQUEST') {
        // openFDA count endpoint does not support pagination via skip — expected per verification report
        console.log(`  NOTE: openFDA count endpoint returned BAD_REQUEST at skip=${skip}.`)
        console.log(`  This is a known API limitation (see pipeline-8-verification.md Q7).`)
        console.log(`  Drug list is bounded at top-${allDrugs.length} terms by report count.`)
        break
      }
      if (data.error.code === 'NOT_FOUND') {
        console.log(`  NOT_FOUND at page ${page} — list fetch complete.`)
        break
      }
      throw new Error(`openFDA list query error (page=${page}): ${JSON.stringify(data.error)}`)
    }

    if (!lastUpdated && data.meta?.last_updated) {
      lastUpdated = data.meta.last_updated
    }

    const results = (data.results as DrugEntry[] | undefined) ?? []
    if (results.length === 0) {
      console.log(`  Empty results at page ${page} — list fetch complete.`)
      break
    }

    allDrugs.push(...results)
    console.log(`  Page ${page + 1}: ${results.length} drugs (total so far: ${allDrugs.length})`)
    await sleep(250)

    if (results.length < 1000) {
      console.log(`  Last page (${results.length} < 1000) — list fetch complete.`)
      break
    }
  }

  if (allDrugs.length === 0) {
    throw new Error('openFDA returned no drugs — check API key and query')
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const cacheData: DrugListCache = { drugs: allDrugs, lastUpdated, fetchedAt: new Date().toISOString() }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2))
  console.log(`  Cached ${allDrugs.length} drugs to: ${CACHE_FILE}`)

  return { drugs: allDrugs, lastUpdated }
}

// ── Spot check ────────────────────────────────────────────────────────────────

function spotCheckDrugList(drugs: DrugEntry[]): void {
  const n = drugs.length
  const indices = [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1]
  console.log('  Spot-check entries (spread across full list):')
  for (const i of indices) {
    const entry = drugs[i]
    console.log(`  [${i}] term="${entry.term}" count=${entry.count.toLocaleString('en-US')}`)
  }
}

// ── Record builder ────────────────────────────────────────────────────────────

function buildDrugRecord(entry: DrugEntry): DrugRecord | DeadLetter {
  const { term, count } = entry

  if (!term || term.trim().length === 0) {
    return { drug_name: null, count: count ?? null, reason: 'empty or null term' }
  }
  if (!Number.isInteger(count) || count <= 0) {
    return { drug_name: term, count: count ?? null, reason: `invalid count: ${count}` }
  }

  const drug_name = term
  const drug_name_slug = toSlug(drug_name)
  const externalId = `faers_${drug_name_slug}`
  const sourceExternalId = `openfda_faers_${drug_name_slug}`
  const query_url = buildQueryUrl(drug_name)
  const claimText = `${drug_name} has ${count.toLocaleString('en-US')} adverse event reports in FDA FAERS as of ${QUERY_DATE} (drugs with openFDA generic_name normalization only).`
  const sourceName = `openFDA FAERS — ${drug_name}`

  return { drug_name, drug_name_slug, total_reports: count, query_date: QUERY_DATE, query_url, externalId, sourceExternalId, claimText, sourceName }
}

// ── Claim metadata builder ────────────────────────────────────────────────────

function buildClaimMetadata(r: DrugRecord, lastUpdated: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    drug_name: r.drug_name,
    drug_name_slug: r.drug_name_slug,
    total_reports: r.total_reports,
    query_date: r.query_date,
    query_url: r.query_url,
    data_source: 'openFDA FAERS',
    openfda_field: 'patient.drug.openfda.generic_name.exact',
    scope_limitation: 'Drugs with openFDA generic_name.exact normalization entries only. Drugs without canonical normalization (including some withdrawn drugs like rofecoxib/Vioxx) may not appear in this dataset. Result set is limited to 1,000 drugs per query (openFDA pagination constraint).',
    caveat: 'FAERS reports are voluntary submissions. Counts reflect reported associations, not confirmed causation. Reports may include duplicate submissions, incomplete entries, and reports filed without medical confirmation.',
  }
  if (lastUpdated) meta['data_last_updated'] = lastUpdated
  return meta
}

// ── Query URL verification (dry-run only) ─────────────────────────────────────

async function verifyQueryUrls(
  records: DrugRecord[],
  dead: DeadLetter[],
): Promise<void> {
  console.log('\n  Verifying 3 query URLs against openFDA...')
  const n = records.length
  const toTest = [records[0], records[Math.floor(n * 0.5)], records[n - 1]].filter(Boolean)

  for (const r of toTest) {
    await sleep(250)
    const data = await fetchJSON<OpenFDACountResponse>(r.query_url)

    if (data.error) {
      const reason = `query_url verification failed: ${data.error.code} — ${data.error.message}`
      console.log(`  [FAIL] ${r.drug_name}: ${reason}`)
      dead.push({ drug_name: r.drug_name, count: r.total_reports, reason })
      continue
    }

    const apiTotal = data.meta?.results?.total ?? null
    if (apiTotal === null) {
      const reason = `query_url verification: no meta.results.total in response`
      console.log(`  [FAIL] ${r.drug_name}: ${reason}`)
      dead.push({ drug_name: r.drug_name, count: r.total_reports, reason })
      continue
    }

    const listCount = r.total_reports
    const match = apiTotal === listCount
    if (match) {
      console.log(`  [OK]   ${r.drug_name}: list=${listCount.toLocaleString('en-US')}, url_total=${apiTotal.toLocaleString('en-US')}`)
    } else {
      const reason = `count mismatch: list query=${listCount}, per-drug url=${apiTotal}`
      console.log(`  [MISMATCH] ${r.drug_name}: ${reason}`)
      dead.push({ drug_name: r.drug_name, count: r.total_reports, reason })
    }
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
  description?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    topicCache.set(slug, existing.id)
    console.log(`  Topic exists: ${slug} (${existing.id})`)
    return existing.id
  }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (!parent) throw new Error(`Parent topic not found: ${parentSlug}`)
    parentTopicId = parent.id
  }
  const created = await prisma.topic.create({
    data: { slug, name, domain, description: description ?? null, parentTopicId },
  })
  console.log(`  Created topic: ${slug} (${created.id})`)
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureP8Topics(): Promise<string> {
  const medicineCount = await prisma.topic.count({ where: { domain: 'medicine' } })
  if (medicineCount === 0) {
    throw new Error('medicine domain has no topics — confirm seed was run before proceeding')
  }
  console.log(`  medicine domain confirmed (${medicineCount} existing topics)`)

  await ensureTopic(
    'pharmacovigilance',
    'Pharmacovigilance',
    'medicine',
    undefined,
    'Post-market surveillance of drug safety, including adverse event reporting systems and pharmacovigilance databases.',
  )

  const adverseEventsId = await ensureTopic(
    'adverse-events',
    'Adverse Events',
    'medicine',
    'pharmacovigilance',
    'Reported adverse events for marketed drugs.',
  )

  // Confirm parent relationship
  const adverseEventsTopic = await prisma.topic.findUnique({
    where: { slug: 'adverse-events' },
    include: { parentTopic: true },
  })
  const parentSlug = adverseEventsTopic?.parentTopic?.slug
  if (parentSlug !== 'pharmacovigilance') {
    throw new Error(`adverse-events parent is '${parentSlug}', expected 'pharmacovigilance'`)
  }
  console.log(`  Confirmed: adverse-events → pharmacovigilance → medicine domain`)

  return adverseEventsId
}

// ── Single row write (within transaction) ─────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  record: DrugRecord,
  adverseEventsTopicId: string,
  lastUpdated: string,
): Promise<'ingested' | 'skipped' | 'conflict'> {
  const existing = await tx.claim.findUnique({
    where: { externalId: record.externalId },
    select: { externalId: true, ingestedBy: true },
  })
  if (existing) {
    if (existing.ingestedBy === INGESTED_BY) return 'skipped'
    return 'conflict'
  }

  const claimDate = new Date(record.query_date)

  const claim = await tx.claim.create({
    data: {
      text: record.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'PROVISIONAL',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      externalId: record.externalId,
      claimEmergedAt: claimDate,
      claimEmergedPrecision: 'DAY',
      metadata: buildClaimMetadata(record, lastUpdated),
    },
  })

  const source = await tx.source.create({
    data: {
      name: record.sourceName,
      url: record.query_url,
      publishedAt: claimDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      externalId: record.sourceExternalId,
      autoApproved: true,
    },
  })

  const edge = await tx.edge.create({
    data: {
      claimId: claim.id,
      sourceId: source.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: { edgeId: edge.id, newScore: 1, reason: 'initial ingestion' },
  })

  await tx.claimTopic.create({
    data: { claimId: claim.id, topicId: adverseEventsTopicId },
  })

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── Pipeline 8: FAERS Current Drugs ──────────────────────────────────`)
  console.log(`Mode: ${mode} | Query date: ${QUERY_DATE}`)

  if (!API_KEY) {
    console.error('ERROR: OPENFDA_API_KEY not set in environment. Cannot proceed.')
    process.exit(1)
  }

  // Step 1: Topic creation (all modes — idempotent)
  console.log('\nStep 1: Ensuring P8 topics...')
  const adverseEventsTopicId = await ensureP8Topics()
  console.log(`  pharmacovigilance ID: ${topicCache.get('pharmacovigilance')}`)
  console.log(`  adverse-events ID:    ${adverseEventsTopicId}`)

  // Step 2: Phase 1 — get drug list
  console.log('\nStep 2: Fetching drug list...')
  const { drugs: rawDrugs, lastUpdated } = await fetchDrugList()
  console.log(`  Total drugs from openFDA: ${rawDrugs.length}`)
  console.log(`  Dataset last_updated: ${lastUpdated}`)

  // Step 3: Sanity check
  console.log('\nStep 3: Sanity check...')
  spotCheckDrugList(rawDrugs)

  // Validate and build records (deduplicates by externalId within this run)
  const records: DrugRecord[] = []
  const dead: DeadLetter[] = []
  const externalIdsSeen = new Set<string>()

  for (const entry of rawDrugs) {
    const result = buildDrugRecord(entry)
    if ('reason' in result) {
      dead.push(result as DeadLetter)
      continue
    }
    const rec = result as DrugRecord
    if (externalIdsSeen.has(rec.externalId)) {
      dead.push({ drug_name: rec.drug_name, count: rec.total_reports, reason: `slug collision: externalId '${rec.externalId}' already assigned in this run` })
      continue
    }
    externalIdsSeen.add(rec.externalId)
    records.push(rec)
  }

  const rows = limit > 0 ? records.slice(0, limit) : records

  console.log(`\nValidation: ${records.length} valid, ${dead.length} dead-lettered`)
  if (dead.length > 0) {
    console.log('Dead-letter entries:')
    dead.forEach(d => console.log(`  ${d.drug_name ?? '(null)'} (count=${d.count}): ${d.reason}`))
  }

  if (dead.length > 50) {
    fs.writeFileSync('pipeline-8-dead-letter.json', JSON.stringify(dead, null, 2))
    console.error(`\nABORTED: ${dead.length} dead-letter entries exceeds threshold of 50. Human review required.`)
    process.exit(1)
  }

  // ── Dry-run ──────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Running dry-run (no DB writes for claims/sources/edges)...')

    await verifyQueryUrls(rows, dead)

    fs.writeFileSync('pipeline-8-dead-letter.json', JSON.stringify(dead, null, 2))

    const sample = rows.slice(0, 5).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'PROVISIONAL',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      claimEmergedAt: new Date(QUERY_DATE).toISOString(),
      claimEmergedPrecision: 'DAY',
      metadata: buildClaimMetadata(r, lastUpdated),
      source: {
        name: r.sourceName,
        url: r.query_url,
        publishedAt: new Date(QUERY_DATE).toISOString(),
        methodologyType: 'primary',
        externalId: r.sourceExternalId,
        ingestedBy: INGESTED_BY,
      },
      edge: {
        type: 'FOR',
        evidenceType: 'EVIDENTIARY',
        ingestedBy: INGESTED_BY,
      },
      claimTopic: { topicId: adverseEventsTopicId, topicSlug: 'adverse-events' },
    }))
    fs.writeFileSync('pipeline-8-dry-run-sample.json', JSON.stringify(sample, null, 2))

    const summary = [
      `Pipeline 8 Dry-Run Summary — ${new Date().toISOString()}`,
      `Query date: ${QUERY_DATE}`,
      `Dataset last_updated: ${lastUpdated}`,
      ``,
      `## Drug List`,
      `  Raw entries from openFDA: ${rawDrugs.length}`,
      `  Valid records built: ${records.length}`,
      `  Dead-lettered: ${dead.length}`,
      `  Rows to process (after --limit): ${rows.length}`,
      ``,
      `## Topic IDs (confirmed in DB)`,
      `  pharmacovigilance: ${topicCache.get('pharmacovigilance')}`,
      `  adverse-events:    ${adverseEventsTopicId}`,
      ``,
      `## Estimated DB rows (full run)`,
      `  Claims:        ${rows.length}`,
      `  Sources:       ${rows.length}`,
      `  Edges:         ${rows.length}`,
      `  EdgeRevisions: ${rows.length}`,
      `  ClaimTopics:   ${rows.length}`,
      `  Total:         ~${rows.length * 5}`,
      ``,
      `## Spec Conflicts Noted`,
      ``,
      `1. SPEC CONFLICT — Source.metadata field.`,
      `   Spec specifies a metadata object on Source (openfda_endpoint, data_freshness,`,
      `   query_date). The Source model in schema.prisma has no metadata column (confirmed`,
      `   in pipeline-8-verification.md §4). Per AGENTS.md, source-level provenance goes`,
      `   in Claim.metadata. Resolution: data_last_updated stored in Claim.metadata`,
      `   as 'data_last_updated'. No data lost. If Source.metadata is required, a`,
      `   schema migration is needed before it can be written.`,
      ``,
      `2. SPEC CONFLICT — openFDA count endpoint pagination.`,
      `   Spec says to paginate using skip parameter (increment by 1000). The openFDA API`,
      `   returns BAD_REQUEST when skip is used with count= queries (confirmed in`,
      `   pipeline-8-verification.md Q7: "Should not use skip param when using count.").`,
      `   Resolution: single-page fetch with limit=1000 (API max for authenticated tier).`,
      `   Pagination loop catches BAD_REQUEST and stops gracefully. All ${rawDrugs.length}`,
      `   returned terms are processed. No data lost within the API's maximum.`,
      ``,
      `## API Key`,
      `  OPENFDA_API_KEY: present (loaded from .env)`,
      ``,
      `## Next step (after Robert approves)`,
      `  npx tsx scripts/ingest-faers-current-drugs.ts --sample 10`,
    ].join('\n')

    fs.writeFileSync('pipeline-8-dry-run-summary.txt', summary)

    console.log('\nDry-run complete.')
    console.log('  Written: pipeline-8-dry-run-sample.json (first 5 drugs)')
    console.log('  Written: pipeline-8-dry-run-summary.txt')
    console.log('  Written: pipeline-8-dead-letter.json')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample run.')
    return
  }

  // ── Sample run ────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const sampleRows = rows.slice(0, sampleN)
    console.log(`\nSample run: writing ${sampleRows.length} rows in rolled-back transaction...`)
    let sampleIngested = 0
    let sampleSkipped = 0
    let sampleConflicts = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of sampleRows) {
          const result = await writeRow(tx, row, adverseEventsTopicId, lastUpdated)
          if (result === 'ingested') sampleIngested++
          else if (result === 'skipped') sampleSkipped++
          else sampleConflicts++
          if (verbose) console.log(`  [${result}] ${row.drug_name}`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nTransaction rolled back successfully.`)
        console.log(`  Would have ingested: ${sampleIngested}, skipped: ${sampleSkipped}, conflicts: ${sampleConflicts}`)
      } else {
        throw e
      }
    }

    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback claim count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    if (afterCount > 0) {
      console.error(`  WARNING: Rollback may have failed — ${afterCount} rows remain in DB`)
    } else {
      console.log(`  Rollback verified.`)
    }
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ──────────────────────────────────────────────────────────────
  console.log(`\nFull ingestion: ${rows.length} rows in batches of ${BATCH_SIZE}...`)
  const startTime = Date.now()
  let totalIngested = 0
  let totalSkipped = 0
  let totalConflicts = 0
  let totalErrors = 0
  const errorLog: Array<{ drug_name: string; error: string }> = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    let batchIngested = 0
    let batchSkipped = 0
    let batchConflicts = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, adverseEventsTopicId, lastUpdated)
          if (result === 'ingested') batchIngested++
          else if (result === 'skipped') batchSkipped++
          else batchConflicts++
        }
      }, { timeout: 30000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  Batch ${i}–${i + batch.length - 1} FAILED: ${msg}`)
      for (const row of batch) {
        try {
          await prisma.$transaction(async (tx) => {
            const result = await writeRow(tx, row, adverseEventsTopicId, lastUpdated)
            if (result === 'ingested') batchIngested++
            else if (result === 'skipped') batchSkipped++
            else batchConflicts++
          }, { timeout: 30000 })
        } catch (rowErr) {
          const rowMsg = rowErr instanceof Error ? rowErr.message : String(rowErr)
          errorLog.push({ drug_name: row.drug_name, error: rowMsg })
          totalErrors++
          console.error(`    Row failed: ${row.drug_name} — ${rowMsg}`)
        }
      }
    }

    totalIngested   += batchIngested
    totalSkipped    += batchSkipped
    totalConflicts  += batchConflicts

    if (verbose || i % 200 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} — ingested ${totalIngested}, skipped ${totalSkipped}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${totalIngested} | Skipped: ${totalSkipped} | Conflicts: ${totalConflicts} | Errors: ${totalErrors}`)

  console.log('\nPost-ingestion DB verification...')
  const claimCount  = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const sourceCount = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const edgeCount   = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  const ctCount     = await prisma.claimTopic.count({ where: { topicId: adverseEventsTopicId } })
  const provCount   = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, verificationStatus: 'PROVISIONAL' } })

  console.log(`  Claims:                       ${claimCount}`)
  console.log(`  Sources:                      ${sourceCount}`)
  console.log(`  Edges:                        ${edgeCount}`)
  console.log(`  ClaimTopic (adverse-events):  ${ctCount}`)
  console.log(`  verificationStatus=PROVISIONAL: ${provCount}`)

  if (dead.length > 0 || errorLog.length > 0) {
    fs.writeFileSync('pipeline-8-dead-letter.json', JSON.stringify(dead, null, 2))
    console.log('  Written: pipeline-8-dead-letter.json')
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
