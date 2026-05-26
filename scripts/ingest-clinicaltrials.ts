// ClinicalTrials.gov trial registration ingestion — Phase 2 clinical evidence layer
// Creates: Claims (EMPIRICAL HARD_FACT), Sources, Edges
// No CITES cross-references — ingesters produce facts, humans curate connections
// Docs: https://clinicaltrials.gov/data-api/api
// Run: npx tsx scripts/ingest-clinicaltrials.ts --bucket [case-study|pharma|pivotal] --limit N

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CT_BASE = 'https://clinicaltrials.gov/api/v2/studies'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CTDateStruct { date?: string; type?: string }

interface CTStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string
      briefTitle?: string
      acronym?: string
    }
    statusModule?: {
      overallStatus?: string
      startDateStruct?: CTDateStruct
      primaryCompletionDateStruct?: CTDateStruct
      studyFirstPostDateStruct?: CTDateStruct
    }
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string; class?: string }
    }
    conditionsModule?: { conditions?: string[] }
    armsInterventionsModule?: {
      interventions?: Array<{ type?: string; name?: string }>
    }
  }
  hasResults?: boolean
}

interface CTResponse {
  totalCount?: number
  nextPageToken?: string
  studies?: CTStudy[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { bucket: string; limit: number; dryRun: boolean } {
  const args = process.argv.slice(2)
  const bucketIdx = args.indexOf('--bucket')
  const limitIdx  = args.indexOf('--limit')
  const bucket = bucketIdx !== -1 ? (args[bucketIdx + 1] ?? 'case-study') : 'case-study'
  const limit  = limitIdx  !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  const dryRun = args.includes('--dry-run')
  return { bucket, limit, dryRun }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// ~4 req/sec — polite default, no documented hard limit

let lastReqAt = 0
const MIN_INTERVAL = 250

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── HTTP with retry ───────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url)
    if ([502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    return res
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── ClinicalTrials.gov API ────────────────────────────────────────────────────
// Fields param uses PascalCase; response uses camelCase — confirmed against live API

const FIELDS = [
  'NCTId', 'BriefTitle', 'Acronym', 'OverallStatus',
  'StartDate', 'PrimaryCompletionDate', 'StudyFirstPostDate',
  'LeadSponsor', 'Condition', 'Intervention', 'HasResults',
].join(',')

async function searchTrials(
  params: Record<string, string>,
  cap = 0,
): Promise<CTStudy[]> {
  const results: CTStudy[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(CT_BASE)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    url.searchParams.set('format', 'json')
    url.searchParams.set('fields', FIELDS)
    const pageSize = cap > 0 ? Math.min(100, cap - results.length) : 100
    url.searchParams.set('pageSize', String(pageSize))
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetchWithRetry(url.toString())
    if (!res.ok) {
      const text = await res.text()
      console.warn(`  ClinicalTrials API ${res.status}: ${text.slice(0, 200)}`)
      break
    }
    const data = await res.json() as CTResponse
    const studies = data.studies ?? []
    results.push(...studies)
    pageToken = data.nextPageToken

    if (!pageToken || (cap > 0 && results.length >= cap)) break
  } while (true)

  return cap > 0 ? results.slice(0, cap) : results
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidNCT(s: string): boolean {
  return /^NCT\d{8}$/.test(s)
}

function parseTrialDate(s: string | undefined | null): Date | null {
  if (!s) return null
  // Dates from API are YYYY-MM-DD but handle partial dates defensively
  const parts = s.split('-')
  const dateStr = parts.length === 1 ? `${s}-01-01`
    : parts.length === 2 ? `${s}-01`
    : s
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

// ── String helpers ────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function formatDateForText(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10)
    if (month >= 1 && month <= 12) return `${MONTHS[month - 1]} ${parts[0]}`
  }
  return parts[0]
}

// Extract generic name from openFDA claim text: "SEMAGLUTIDE (brand: OZEMPIC)..." → "semaglutide"
// Truncate and sanitize to avoid ClinicalTrials "Too complicated query" errors.
function extractGenericName(text: string): string | null {
  const m = text.match(/^(.+?)(?:\s*\(brand:|\s+demonstrated\s|\s+is\s|\s+was\s|\s+contains\s)/i)
  if (!m) return null
  let name = m[1].trim().toLowerCase()
  // Take only the first token (first word or hyphenated compound) to avoid complex multi-word names
  const firstToken = name.match(/^[a-z0-9]+(?:[-][a-z0-9]+)*/)
  if (!firstToken) return null
  name = firstToken[0]
  // Skip names that are too short or too long to be useful
  if (name.length < 4 || name.length > 40) return null
  return name
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string, name: string, domain: string, parentSlug?: string
): Promise<string> {
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

async function ensureCoreTopics(): Promise<{ clinicalTrials: string; trialRegistrations: string }> {
  const clinicalTrials     = await ensureTopic('clinical-trials', 'Clinical Trials', 'clinical-trials')
  const trialRegistrations = await ensureTopic('trial-registrations', 'Trial Registrations', 'clinical-trials', 'clinical-trials')
  return { clinicalTrials, trialRegistrations }
}

async function findTopic(slug: string): Promise<string | null> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const t = await prisma.topic.findUnique({ where: { slug } })
  if (t) { topicCache.set(slug, t.id); return t.id }
  return null
}

async function tagClaim(claimId: string, topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Core: ingest one trial ────────────────────────────────────────────────────

async function ingestTrial(
  study: CTStudy,
  extraTopicIds: string[],
  coreTopicIds: string[],
  dryRun = false,
): Promise<IngestResult> {
  const id     = study.protocolSection?.identificationModule
  const status = study.protocolSection?.statusModule
  const spons  = study.protocolSection?.sponsorCollaboratorsModule
  const conds  = study.protocolSection?.conditionsModule
  const arms   = study.protocolSection?.armsInterventionsModule

  const nctId = id?.nctId?.trim()
  if (!nctId || !isValidNCT(nctId)) {
    console.warn(`  Skipped (invalid NCT): ${nctId ?? 'undefined'}`)
    return 'skipped'
  }

  const sponsor = spons?.leadSponsor?.name?.trim()
  if (!sponsor) {
    console.warn(`  Skipped (no sponsor): ${nctId}`)
    return 'skipped'
  }

  const interventions = (arms?.interventions ?? [])
    .map(i => i.name?.trim())
    .filter(Boolean) as string[]
  if (interventions.length === 0) {
    console.warn(`  Skipped (no interventions): ${nctId}`)
    return 'skipped'
  }

  const startDate = parseTrialDate(status?.startDateStruct?.date)
  if (!startDate) {
    console.warn(`  Skipped (no start date): ${nctId}`)
    return 'skipped'
  }

  const externalId = `nct_${nctId}`
  if (!dryRun) {
    const existing = await prisma.claim.findUnique({ where: { externalId } })
    if (existing) {
      console.log(`  Skipped (exists): ${nctId}`)
      return 'skipped'
    }
  }

  const registrationDate = parseTrialDate(status?.studyFirstPostDateStruct?.date)
  const completionRaw    = status?.primaryCompletionDateStruct?.date

  const acronym       = id?.acronym?.trim()
  const displayTitle  = acronym ? ` (${acronym})` : ''
  const intrDisplay   = interventions.slice(0, 2).join(', ')
  const condDisplay   = (conds?.conditions ?? []).slice(0, 2).join(', ')
  const condStr       = condDisplay ? ` in ${condDisplay}` : ''
  const completionStr = completionRaw ? `, primary completion ${formatDateForText(completionRaw)}` : ''

  const claimText = `Clinical trial ${nctId}${displayTitle} registered to study ${intrDisplay}${condStr}, sponsored by ${sponsor}${completionStr}.`

  if (dryRun) {
    console.log(`  [DRY RUN] Would ingest: ${nctId} — ${intrDisplay}${acronym ? ` (${acronym})` : ''}`)
    return 'ingested'
  }

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name: `ClinicalTrials.gov ${nctId}`,
          url: `https://clinicaltrials.gov/study/${nctId}`,
          publishedAt: registrationDate,
          methodologyType: 'primary',
          ingestedBy: 'clinicaltrials_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: `ct_source_${nctId}`,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text: claimText,
          claimType: 'EMPIRICAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: startDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy: 'clinicaltrials_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId,
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId: source.id,
          claimId: claim.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: 'clinicaltrials_v1',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId: edge.id,
          priorScore: null,
          newScore: 90,
          reason: 'ClinicalTrials.gov registration — direct institutional record of trial conduct',
          changedAt: registrationDate ?? startDate,
        },
      })

      return { claimId: claim.id }
    })

    await tagClaim(claimId, [...coreTopicIds, ...extraTopicIds])

    console.log(`  Ingested: ${nctId} — ${intrDisplay}${acronym ? ` (${acronym})` : ''}`)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${nctId} — ${msg}`)
    return 'failed'
  }
}

// ── Case-study bucket ─────────────────────────────────────────────────────────

interface CaseStudyIntervention {
  name: string
  extraTopicSlugs: string[]
  cap: number
}

const CASE_STUDY_INTERVENTIONS: CaseStudyIntervention[] = [
  // GLP-1 / Ozempic case study
  { name: 'semaglutide',           extraTopicSlugs: ['drug-approval', 'medicine'], cap: 15 },
  { name: 'liraglutide',           extraTopicSlugs: ['drug-approval', 'medicine'], cap: 10 },
  { name: 'tirzepatide',           extraTopicSlugs: ['drug-approval', 'medicine'], cap: 10 },
  { name: 'exenatide',             extraTopicSlugs: ['drug-approval', 'medicine'], cap: 10 },
  // COVID antivirals — pandemic-origins case study
  { name: 'remdesivir',            extraTopicSlugs: ['pandemic-origins', 'drug-approval', 'medicine'], cap: 15 },
  { name: 'molnupiravir',          extraTopicSlugs: ['pandemic-origins', 'drug-approval', 'medicine'], cap: 10 },
  { name: 'paxlovid',              extraTopicSlugs: ['pandemic-origins', 'drug-approval', 'medicine'], cap: 10 },
  // COVID controversy — disputed efficacy
  { name: 'hydroxychloroquine',    extraTopicSlugs: ['pandemic-origins', 'medicine'], cap: 10 },
  { name: 'ivermectin',            extraTopicSlugs: ['pandemic-origins', 'medicine'], cap: 10 },
  // Tobacco cessation
  { name: 'varenicline',           extraTopicSlugs: ['tobacco-control', 'drug-approval', 'medicine'], cap: 10 },
  { name: 'bupropion',             extraTopicSlugs: ['tobacco-control', 'drug-approval', 'medicine'], cap: 10 },
  { name: 'nicotine replacement',  extraTopicSlugs: ['tobacco-control', 'medicine'], cap: 10 },
]

async function runCaseStudyBucket(limit: number, coreTopicIds: string[], dryRun: boolean): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const seenNCTs = new Set<string>()

  for (const intr of CASE_STUDY_INTERVENTIONS) {
    const cap = limit > 0 ? Math.min(limit, intr.cap) : intr.cap
    console.log(`\n  Intervention: ${intr.name} (cap ${cap})\n`)

    const studies = await searchTrials(
      { 'query.intr': intr.name, 'sort': 'LastUpdatePostDate:desc' },
      cap,
    )

    if (studies.length === 0) { console.log(`    No results`); continue }
    console.log(`    Fetched ${studies.length} trials\n`)

    const extraIds: string[] = []
    for (const slug of intr.extraTopicSlugs) {
      const id = await findTopic(slug)
      if (id) extraIds.push(id)
      else console.warn(`    Warning: topic '${slug}' not found`)
    }

    for (const study of studies) {
      const nctId = study.protocolSection?.identificationModule?.nctId
      if (nctId && seenNCTs.has(nctId)) continue
      if (nctId) seenNCTs.add(nctId)

      const result = await ingestTrial(study, extraIds, coreTopicIds, dryRun)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }
  }

  return counts
}

// ── Pharma bucket ─────────────────────────────────────────────────────────────
// For each FDA-approved drug in the DB: top 5 most recently completed trials

async function runPharmaBucket(limit: number, coreTopicIds: string[], dryRun: boolean): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  const fdaClaims = await prisma.claim.findMany({
    where: { ingestedBy: 'openfda_labels_v1', deleted: false },
    select: { text: true },
    ...(limit > 0 ? { take: limit } : {}),
  })
  console.log(`  Found ${fdaClaims.length} FDA claims to cross-reference\n`)

  const drugApprovalId = await findTopic('drug-approval')
  const extraIds = drugApprovalId ? [drugApprovalId] : []
  const seenNCTs = new Set<string>()

  for (const claim of fdaClaims) {
    const genericName = extractGenericName(claim.text)
    if (!genericName) continue

    const studies = await searchTrials({
      'query.intr': genericName,
      'filter.overallStatus': 'COMPLETED',
      'sort': 'LastUpdatePostDate:desc',
    }, 5)

    for (const study of studies) {
      const nctId = study.protocolSection?.identificationModule?.nctId
      if (nctId && seenNCTs.has(nctId)) continue
      if (nctId) seenNCTs.add(nctId)

      const result = await ingestTrial(study, extraIds, coreTopicIds, dryRun)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }
  }

  return counts
}

// ── Pivotal bucket ────────────────────────────────────────────────────────────
// Completed trials with results posted, by major therapeutic condition

interface PivotalCondition {
  condition: string
  extraTopicSlugs: string[]
  cap: number
}

const PIVOTAL_CONDITIONS: PivotalCondition[] = [
  { condition: 'type 2 diabetes',            extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'cardiovascular disease',     extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'breast cancer',              extraTopicSlugs: ['drug-approval', 'epidemiology'], cap: 10 },
  { condition: 'lung cancer',                extraTopicSlugs: ['drug-approval', 'epidemiology'], cap: 10 },
  { condition: 'rheumatoid arthritis',       extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'HIV infection',              extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'multiple sclerosis',         extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'atrial fibrillation',        extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'heart failure',              extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'non-small cell lung cancer', extraTopicSlugs: ['drug-approval', 'epidemiology'], cap: 10 },
  { condition: 'colorectal cancer',          extraTopicSlugs: ['drug-approval', 'epidemiology'], cap: 10 },
  { condition: 'major depressive disorder',  extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'hypertension',               extraTopicSlugs: ['drug-approval'], cap: 10 },
  { condition: 'COVID-19',                   extraTopicSlugs: ['pandemic-origins', 'drug-approval'], cap: 10 },
  { condition: 'obesity',                    extraTopicSlugs: ['drug-approval'], cap: 10 },
]

async function runPivotalBucket(limit: number, coreTopicIds: string[], dryRun: boolean): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const seenNCTs = new Set<string>()

  for (const cond of PIVOTAL_CONDITIONS) {
    const wantN = limit > 0 ? Math.min(limit, cond.cap) : cond.cap
    console.log(`\n  Condition: ${cond.condition} (want ${wantN} with results)\n`)

    // Fetch 5× cap to account for post-filter on hasResults
    const studies = await searchTrials({
      'query.cond': cond.condition,
      'filter.overallStatus': 'COMPLETED',
      'sort': 'LastUpdatePostDate:desc',
    }, Math.min(wantN * 5, 100))

    const withResults = studies.filter(s => s.hasResults === true).slice(0, wantN)
    if (withResults.length === 0) {
      console.log(`    No completed trials with results posted`)
      continue
    }
    console.log(`    ${withResults.length} trials with results\n`)

    const extraIds: string[] = []
    for (const slug of cond.extraTopicSlugs) {
      const id = await findTopic(slug)
      if (id) extraIds.push(id)
      else console.warn(`    Warning: topic '${slug}' not found`)
    }

    for (const study of withResults) {
      const nctId = study.protocolSection?.identificationModule?.nctId
      if (nctId && seenNCTs.has(nctId)) continue
      if (nctId) seenNCTs.add(nctId)

      const result = await ingestTrial(study, extraIds, coreTopicIds, dryRun)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }
  }

  return counts
}

// ── Bulk Phase 3/4 bucket ────────────────────────────────────────────────────
// Broad sweep of completed Phase 3 + 4 trials with results posted.
// Target: 5,000–50,000 records. Paginate the full dataset by phase.

const PHASE3_THERAPEUTIC_AREAS = [
  { area: 'oncology',         slugs: ['medicine', 'epidemiology'] },
  { area: 'cardiology',       slugs: ['medicine'] },
  { area: 'infectious',       slugs: ['medicine', 'epidemiology'] },
  { area: 'neurology',        slugs: ['medicine'] },
  { area: 'endocrinology',    slugs: ['medicine'] },
  { area: 'psychiatry',       slugs: ['medicine'] },
  { area: 'pulmonology',      slugs: ['medicine'] },
  { area: 'gastroenterology', slugs: ['medicine'] },
  { area: 'rheumatology',     slugs: ['medicine'] },
  { area: 'hematology',       slugs: ['medicine'] },
]

async function runPhase3Bucket(limit: number, coreTopicIds: string[], dryRun: boolean): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const seenNCTs = new Set<string>()

  const perArea = limit > 0 ? Math.ceil(limit / PHASE3_THERAPEUTIC_AREAS.length) : 500
  const medicineId = await findTopic('medicine')
  const drugApprovalId = await findTopic('drug-approval')
  const baseExtraIds = [medicineId, drugApprovalId].filter(Boolean) as string[]

  console.log(`\n  Phase 3/4 bulk sweep — target ${perArea} per therapeutic area\n`)

  for (const ta of PHASE3_THERAPEUTIC_AREAS) {
    if (limit > 0 && counts.ingested >= limit) break
    const remaining = limit > 0 ? limit - counts.ingested : perArea
    const fetchCap = Math.min(remaining * 4, 2000)

    console.log(`\n  Area: ${ta.area} (fetching up to ${fetchCap})\n`)

    const studies = await searchTrials({
      'query.cond': ta.area,
      'filter.overallStatus': 'COMPLETED',
      'filter.advanced': 'AREA[Phase]Phase 3 OR AREA[Phase]Phase 4',
      'sort': 'LastUpdatePostDate:desc',
    }, fetchCap)

    const withResults = studies.filter(s => s.hasResults === true)
    const batch = withResults.slice(0, Math.min(remaining, perArea))
    console.log(`    ${withResults.length} with results → taking ${batch.length}\n`)

    const extraIds: string[] = [...baseExtraIds]
    for (const slug of ta.slugs) {
      const id = await findTopic(slug)
      if (id && !extraIds.includes(id)) extraIds.push(id)
    }

    for (const study of batch) {
      if (limit > 0 && counts.ingested >= limit) break
      const nctId = study.protocolSection?.identificationModule?.nctId
      if (nctId && seenNCTs.has(nctId)) continue
      if (nctId) seenNCTs.add(nctId)

      const result = await ingestTrial(study, extraIds, coreTopicIds, dryRun)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }

    if (counts.ingested % 100 === 0 && counts.ingested > 0) {
      console.log(`  Progress: ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
    }
  }

  return counts
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { bucket, limit, dryRun } = parseArgs()
  console.log(`\n=== ClinicalTrials Ingestion — bucket: ${bucket}, limit: ${limit || 'all'}${dryRun ? ' [DRY RUN]' : ''} ===\n`)

  const { clinicalTrials, trialRegistrations } = await ensureCoreTopics()
  const coreTopicIds = [clinicalTrials, trialRegistrations]

  let result: Counts

  switch (bucket) {
    case 'case-study':
      result = await runCaseStudyBucket(limit, coreTopicIds, dryRun)
      break
    case 'pharma':
      result = await runPharmaBucket(limit, coreTopicIds, dryRun)
      break
    case 'pivotal':
      result = await runPivotalBucket(limit, coreTopicIds, dryRun)
      break
    case 'phase3':
      result = await runPhase3Bucket(limit, coreTopicIds, dryRun)
      break
    default:
      console.error(`Unknown bucket: ${bucket}. Use: case-study | pharma | pivotal | phase3`)
      await prisma.$disconnect()
      process.exit(1)
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${result.ingested}`)
  console.log(`  Skipped  : ${result.skipped}`)
  console.log(`  Errors   : ${result.errors}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
