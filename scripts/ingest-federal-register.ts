// Pipeline 14 — Federal Register Significant Final Rules
// Dataset: Federal Register API (federalregister.gov/api/v1) — no auth required.
// Scope: significant final rules (EO 12866 3(f)(1)/(4)) from key agencies since 1994.
// Agencies: EPA, FDA, OSHA, CMS, DEA, FTC, FCC.
// Run: npx tsx scripts/ingest-federal-register.ts --dry-run
//      npx tsx scripts/ingest-federal-register.ts --sample 10
//      npx tsx scripts/ingest-federal-register.ts --full [--agency epa|fda|osha|cms|dea|ftc|fcc|all] [--since YYYY] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { makeLogger } from '../lib/log'

const prisma = new PrismaClient()

const INGESTED_BY = 'fr_rules_v1'
const log = makeLogger(INGESTED_BY)
const FR_BASE = 'https://www.federalregister.gov/api/v1'
const PAGE_SIZE = 1000

// ── Agency config ─────────────────────────────────────────────────────────────

interface AgencyDef {
  slug: string          // FR API agency slug
  shortName: string     // for claim text and topic names
  topicSlug: string
  domain: string
}

const AGENCIES: AgencyDef[] = [
  { slug: 'environmental-protection-agency',      shortName: 'EPA',  topicSlug: 'fr-rules-epa',  domain: 'environment' },
  { slug: 'food-and-drug-administration',         shortName: 'FDA',  topicSlug: 'fr-rules-fda',  domain: 'medicine'    },
  { slug: 'occupational-safety-and-health-administration', shortName: 'OSHA', topicSlug: 'fr-rules-osha', domain: 'labor' },
  { slug: 'centers-for-medicare-medicaid-services', shortName: 'CMS', topicSlug: 'fr-rules-cms', domain: 'medicine'   },
  { slug: 'drug-enforcement-administration',      shortName: 'DEA',  topicSlug: 'fr-rules-dea',  domain: 'law'         },
  { slug: 'federal-trade-commission',             shortName: 'FTC',  topicSlug: 'fr-rules-ftc',  domain: 'economics'   },
  { slug: 'federal-communications-commission',    shortName: 'FCC',  topicSlug: 'fr-rules-fcc',  domain: 'technology'  },
]

const AGENCY_BY_CLI = new Map(AGENCIES.map(a => [a.shortName.toLowerCase(), a]))

// ── Types ─────────────────────────────────────────────────────────────────────

interface FrAgency {
  name: string
  slug: string
}

interface FrDocument {
  document_number: string
  title: string
  abstract: string | null
  publication_date: string    // YYYY-MM-DD
  effective_on: string | null // YYYY-MM-DD
  agencies: FrAgency[]
  html_url: string
  action: string | null
}

interface FrPage {
  count: number
  total_pages: number
  next_page_url: string | null
  results: FrDocument[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  documentNumber: string
  externalId: string
  title: string
  abstract: string | null
  publicationDate: Date
  effectiveDate: Date | null
  agencyShortName: string
  agencySlug: string
  sourceUrl: string
  action: string | null
  claimText: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --sample N | --full  [--agency all|epa|...] [--since YYYY] [--limit N] [--verbose]'); process.exit(1) as never })()

  const ai = args.indexOf('--agency')
  const si = args.indexOf('--since')
  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  const agencyArg = ai !== -1 ? (args[ai + 1] ?? 'all') : 'all'
  const sinceArg = si !== -1 ? (args[si + 1] ?? '1994-01-01') : '1994-01-01'

  const agenciesToRun: AgencyDef[] = agencyArg === 'all'
    ? AGENCIES
    : (() => {
        const a = AGENCY_BY_CLI.get(agencyArg.toLowerCase())
        if (!a) { console.error(`Unknown agency: ${agencyArg}. Valid: all, ${AGENCIES.map(x => x.shortName.toLowerCase()).join(', ')}`); process.exit(1) as never }
        return [a]
      })()

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    agencies: agenciesToRun,
    since: sinceArg,
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 500

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function frFetch(url: string, retries = 3): Promise<FrPage> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`FR API ${res.status} at ${url}`)
    return res.json() as Promise<FrPage>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Fetch all rules for one agency (paginated) ────────────────────────────────

async function fetchAgencyRules(agencySlug: string, since: string): Promise<FrDocument[]> {
  const all: FrDocument[] = []
  const fields = [
    'document_number', 'title', 'abstract', 'publication_date',
    'effective_on', 'agencies', 'html_url', 'action',
  ]
  const fieldParams = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&')
  const baseParams = `conditions[type][]=RULE&conditions[significant]=1&conditions[agencies][]=${encodeURIComponent(agencySlug)}&conditions[publication_date][gte]=${since}&per_page=${PAGE_SIZE}&${fieldParams}`

  let page = 1
  for (;;) {
    const url = `${FR_BASE}/documents.json?${baseParams}&page=${page}`
    const data = await frFetch(url)
    const results = data.results ?? []
    all.push(...results)
    if (page >= data.total_pages || results.length < PAGE_SIZE) break
    page++
  }

  return all
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstSentence(text: string | null, maxLen = 220): string {
  if (!text) return ''
  const match = text.match(/^[^.!?]+[.!?]/)
  const sentence = match ? match[0]! : text
  return sentence.length > maxLen ? sentence.slice(0, maxLen - 1) + '…' : sentence
}

function buildClaimText(doc: FrDocument, agencyShortName: string): string {
  const dateStr = doc.publication_date
  const effectiveStr = doc.effective_on ? `, effective ${doc.effective_on}` : ''
  const summary = firstSentence(doc.abstract)
  const summaryPart = summary ? ` ${summary}` : ''
  return `The ${agencyShortName} published "${doc.title}" as a final rule on ${dateStr}${effectiveStr}.${summaryPart}`
}

function buildCandidate(doc: FrDocument, agency: AgencyDef): CandidateRecord | null {
  if (!doc.document_number || !doc.title || !doc.publication_date || !doc.html_url) return null
  let publicationDate: Date
  try { publicationDate = new Date(doc.publication_date + 'T00:00:00Z') } catch { return null }
  if (isNaN(publicationDate.getTime())) return null

  return {
    documentNumber: doc.document_number,
    externalId: `fr_rule_${doc.document_number}`,
    title: doc.title,
    abstract: doc.abstract ?? null,
    publicationDate,
    effectiveDate: doc.effective_on ? new Date(doc.effective_on + 'T00:00:00Z') : null,
    agencyShortName: agency.shortName,
    agencySlug: agency.slug,
    sourceUrl: doc.html_url,
    action: doc.action ?? null,
    claimText: buildClaimText(doc, agency.shortName),
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

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

async function ensureAllTopics(): Promise<Map<string, { rootId: string; agencyId: string }>> {
  const rootId = await ensureTopic('federal-register-significant-rules', 'Federal Register — Significant Final Rules', 'government')
  const map = new Map<string, { rootId: string; agencyId: string }>()
  for (const agency of AGENCIES) {
    const agencyId = await ensureTopic(
      agency.topicSlug,
      `${agency.shortName} Final Rules`,
      agency.domain,
      'federal-register-significant-rules',
    )
    map.set(agency.slug, { rootId, agencyId })
  }
  return map
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  topicIds: string[],
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `Federal Register: ${rec.agencyShortName} — ${rec.documentNumber}`,
      url: rec.sourceUrl,
      publishedAt: rec.publicationDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `fr_rule_source_${rec.documentNumber}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.publicationDate,
      claimEmergedPrecision: 'DAY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        documentNumber: rec.documentNumber,
        agency: rec.agencyShortName,
        agencySlug: rec.agencySlug,
        title: rec.title,
        publicationDate: rec.publicationDate.toISOString().split('T')[0],
        effectiveDate: rec.effectiveDate ? rec.effectiveDate.toISOString().split('T')[0] : null,
        action: rec.action,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
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
      reason: 'Federal Register official publication — significant final rule, HARD_FACT',
      changedAt: rec.publicationDate,
    },
  })

  for (const topicId of topicIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, agencies, since, limit, sampleN, verbose } = parseArgs()

  log.info('pipeline_start', { mode, agencies: agencies.map(a => a.shortName), since, limit: limit ?? null })
  console.log(`\n── Pipeline 14: Federal Register Significant Final Rules ──────────────`)
  console.log(`Mode: ${mode} | Agencies: ${agencies.map(a => a.shortName).join(', ')} | Since: ${since} | Limit: ${limit || 'all'}`)

  // Step 1: Topics (skipped in dry-run)
  let topicMap = new Map<string, { rootId: string; agencyId: string }>()
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicMap = await ensureAllTopics()
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch all documents
  console.log('\nStep 2: Fetching documents from Federal Register API...')
  const allCandidates: CandidateRecord[] = []
  const agencyBreakdown = new Map<string, number>()
  let skippedMalformed = 0

  for (const agency of agencies) {
    console.log(`  Fetching ${agency.shortName} (${agency.slug})...`)
    const docs = await fetchAgencyRules(agency.slug, since)
    console.log(`    Retrieved ${docs.length} raw documents`)

    let agencyCount = 0
    for (const doc of docs) {
      const rec = buildCandidate(doc, agency)
      if (!rec) { skippedMalformed++; continue }
      allCandidates.push(rec)
      agencyCount++
    }
    agencyBreakdown.set(agency.shortName, agencyCount)
    console.log(`    Candidates: ${agencyCount}`)
  }

  console.log(`\nTotal candidates: ${allCandidates.length} (skipped malformed: ${skippedMalformed})`)
  console.log('Per-agency breakdown:')
  for (const [name, count] of agencyBreakdown) {
    console.log(`  ${name}: ${count}`)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      documentNumber: r.documentNumber,
      agency: r.agencyShortName,
      publicationDate: r.publicationDate.toISOString().split('T')[0],
      effectiveDate: r.effectiveDate ? r.effectiveDate.toISOString().split('T')[0] : null,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      source: { url: r.sourceUrl, methodologyType: 'primary' },
    }))

    const output = {
      runDate: new Date().toISOString(),
      since,
      agencies: agencies.map(a => a.shortName),
      totalCandidates: allCandidates.length,
      agencyBreakdown: Object.fromEntries(agencyBreakdown),
      sample,
    }

    fs.writeFileSync('pipeline-14-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-14-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample run.')
    return
  }

  // ── Sample run ─────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const rows = allCandidates.slice(0, sampleN)
    console.log(`\nSample run: ${rows.length} rows in rolled-back transaction...`)
    let ingested = 0, skipped = 0, errors = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const topics = topicMap.get(row.agencySlug)
          const topicIds = topics ? [topics.rootId, topics.agencyId] : []
          const result = await writeRow(tx, row, topicIds)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] ${row.agencyShortName} ${row.documentNumber} — ${row.title.slice(0, 60)}`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nRolled back. Would have ingested: ${ingested}, skipped: ${skipped}, errors: ${errors}`)
      } else {
        throw e
      }
    }

    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback DB count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  const rows = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nFull ingestion: ${rows.length} rows (per-row transactions)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const row of rows) {
    try {
      const topics = topicMap.get(row.agencySlug)
      const topicIds = topics ? [topics.rootId, topics.agencyId] : []
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, row, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 100 === 0) {
        console.log(`  Progress: ${counts.ingested}/${rows.length} — ${row.agencyShortName} ${row.documentNumber}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${row.externalId} — ${msg}`)
      counts.errors++
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

  if (dbClaims !== counts.ingested) {
    console.error(`  WARNING: DB claim count (${dbClaims}) does not match ingested counter (${counts.ingested})`)
    log.warn('counter_mismatch', { dbClaims, ingestedCounter: counts.ingested })
  }

  log.info('pipeline_done', {
    elapsedSeconds: parseFloat(elapsed),
    rowsWritten: counts.ingested,
    skipped: counts.skipped,
    errors: counts.errors,
    dbClaims,
    dbSources,
    dbEdges,
  })
}

main().catch(async err => {
  log.error('pipeline_fatal', { message: err instanceof Error ? err.message : String(err) })
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
