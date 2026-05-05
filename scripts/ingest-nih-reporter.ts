// NIH RePORTER research grant ingestion — Phase 2 institutional layer
// Creates: Claims (INSTITUTIONAL HARD_FACT), Sources, Edges, SourceRelationships
// First ingester to populate SourceRelationship (funder_of, employed_by)
// Docs: https://api.reporter.nih.gov/
// Run: npx tsx scripts/ingest-nih-reporter.ts --bucket [case-study|prestige|reference] --limit N

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const NIH_API_URL = 'https://api.reporter.nih.gov/v2/projects/search'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NIHOrg {
  org_name: string
  org_city?: string
  org_state?: string
  org_country?: string
  org_uei?: string
  org_duns?: string
}

interface NIHPI {
  profile_id?: number
  first_name?: string
  last_name?: string
  full_name?: string   // "LASTNAME, FIRSTNAME" format from RePORTER
  is_contact_pi?: boolean
  orcid_id?: string
}

interface NIHProject {
  project_num: string
  appl_id: number
  project_title: string
  abstract_text?: string
  principal_investigators?: NIHPI[]
  organization?: NIHOrg
  award_amount?: number
  project_start_date?: string   // "2014-06-01T00:00:00"
  project_end_date?: string
  fiscal_year?: number
  activity_code?: string
}

interface NIHResponse {
  meta: { total: number; offset: number; limit: number }
  results: NIHProject[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { bucket: string; limit: number } {
  const args = process.argv.slice(2)
  const bucketIdx = args.indexOf('--bucket')
  const limitIdx  = args.indexOf('--limit')
  const bucket = bucketIdx !== -1 ? (args[bucketIdx + 1] ?? 'case-study') : 'case-study'
  const limit  = limitIdx  !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  return { bucket, limit }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// NIH RePORTER allows 1 req/sec per IP

let lastReqAt = 0
const MIN_INTERVAL = 1100

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── HTTP with retry ───────────────────────────────────────────────────────────

async function postWithRetry(body: object, retries = 3): Promise<Response> {
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(NIH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    })
    if ([502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    return res
  }
  throw new Error('NIH API: failed after retries')
}

// ── NIH API ───────────────────────────────────────────────────────────────────

const INCLUDE_FIELDS = [
  'ProjectNum', 'ApplId', 'ProjectTitle',
  'PrincipalInvestigators', 'Organization',
  'AwardAmount', 'ProjectStartDate', 'ProjectEndDate',
  'FiscalYear', 'ActivityCode',
]

async function searchPage(
  criteria: object,
  offset: number,
  pageSize: number,
): Promise<NIHResponse | null> {
  const res = await postWithRetry({
    criteria,
    include_fields: INCLUDE_FIELDS,
    offset,
    limit: pageSize,
    sort_field: 'project_start_date',
    sort_order: 'desc',
  })
  if (!res.ok) {
    const text = await res.text()
    console.warn(`  NIH API ${res.status}: ${text.slice(0, 300)}`)
    return null
  }
  return (await res.json()) as NIHResponse
}

async function fetchAllGrants(criteria: object, cap = 0): Promise<NIHProject[]> {
  const PAGE_SIZE = 100
  const first = await searchPage(criteria, 0, PAGE_SIZE)
  if (!first || !first.results?.length) return []

  const effectiveTotal = cap > 0 ? Math.min(first.meta.total, cap) : first.meta.total
  const results: NIHProject[] = [...first.results]

  let offset = PAGE_SIZE
  while (results.length < effectiveTotal) {
    const toFetch = Math.min(PAGE_SIZE, effectiveTotal - results.length)
    const page = await searchPage(criteria, offset, toFetch)
    if (!page || page.results.length === 0) break
    results.push(...page.results)
    offset += PAGE_SIZE
  }

  return results.slice(0, cap > 0 ? cap : undefined)
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidProjectNum(num: string): boolean {
  return typeof num === 'string' && num.length >= 6 && /[A-Za-z]/.test(num) && /[0-9]/.test(num)
}

function parseGrantDate(s: string | undefined | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ── String helpers ────────────────────────────────────────────────────────────

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// RePORTER returns "LASTNAME, FIRSTNAME" → "Firstname Lastname"
function formatPIName(pi: NIHPI): string | null {
  const raw = pi.full_name?.trim()
  if (!raw) {
    const parts = [pi.first_name, pi.last_name].filter(Boolean)
    return parts.length ? parts.map(p => toTitleCase(p!)).join(' ') : null
  }
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length >= 2) return `${toTitleCase(parts[1])} ${toTitleCase(parts[0])}`
  return toTitleCase(raw)
}

function safeId(s: string): string {
  return s.replace(/[^A-Za-z0-9-]/g, '_')
}

// ── Entity Source dedup ───────────────────────────────────────────────────────
// These create canonical Source records for institutions and researchers, separate
// from the grant Source records (which are per-grant).

let nihFunderSourceId: string | null = null
const orgSourceCache = new Map<string, string>()   // cacheKey → source.id
const piSourceCache  = new Map<string, string>()   // cacheKey → source.id

// Looks for the existing manually-created NIH source first (created by
// add-nih-funding-claim-and-lancet-metaedge.ts), falls back to externalId,
// then creates a new one. Prevents duplicate NIH source records.
async function ensureNIHFunder(): Promise<string> {
  if (nihFunderSourceId) return nihFunderSourceId
  const byExId = await prisma.source.findUnique({ where: { externalId: 'nih_funder' } })
  if (byExId) { nihFunderSourceId = byExId.id; return byExId.id }
  const byName = await prisma.source.findFirst({
    where: { name: { contains: 'National Institutes of Health', mode: 'insensitive' } },
  })
  if (byName) { nihFunderSourceId = byName.id; return byName.id }
  const created = await prisma.source.create({
    data: {
      name: 'National Institutes of Health',
      url: 'https://www.nih.gov/',
      methodologyType: 'primary',
      ingestedBy: 'nih_reporter_v1',
      humanReviewed: false,
      autoApproved: true,
      externalId: 'nih_funder',
    },
  })
  nihFunderSourceId = created.id
  return created.id
}

async function ensureOrgSource(org: NIHOrg): Promise<string> {
  const orgName = org.org_name.trim()
  const cacheKey = org.org_uei ?? orgName.toUpperCase()
  if (orgSourceCache.has(cacheKey)) return orgSourceCache.get(cacheKey)!

  const externalId = org.org_uei
    ? `nih_org_uei_${org.org_uei}`
    : `nih_org_name_${safeId(orgName.toUpperCase()).slice(0, 60)}`

  const byExId = await prisma.source.findUnique({ where: { externalId } })
  if (byExId) { orgSourceCache.set(cacheKey, byExId.id); return byExId.id }

  // Try to find a manually-created source for well-known institutions
  // (e.g., EcoHealth Alliance already in the DB from seed scripts)
  const normalized = orgName.toLowerCase()
  const byName = await prisma.source.findFirst({
    where: {
      name: { contains: orgName.split(',')[0].trim(), mode: 'insensitive' },
      externalId: null,
    },
  })
  if (byName && byName.name.toLowerCase().includes(normalized.split(',')[0].toLowerCase())) {
    orgSourceCache.set(cacheKey, byName.id)
    return byName.id
  }

  const created = await prisma.source.create({
    data: {
      name: orgName,
      url: null,
      methodologyType: 'primary',
      ingestedBy: 'nih_reporter_v1',
      humanReviewed: false,
      autoApproved: true,
      externalId,
    },
  })
  orgSourceCache.set(cacheKey, created.id)
  return created.id
}

async function ensurePISource(pi: NIHPI): Promise<string | null> {
  const name = formatPIName(pi)
  if (!name) return null
  const cacheKey = pi.profile_id != null ? `pid_${pi.profile_id}` : `name_${name.toUpperCase()}`
  if (piSourceCache.has(cacheKey)) return piSourceCache.get(cacheKey)!

  const externalId = pi.profile_id != null
    ? `nih_pi_${pi.profile_id}`
    : `nih_pi_name_${safeId(name.toUpperCase()).slice(0, 60)}`

  const byExId = await prisma.source.findUnique({ where: { externalId } })
  if (byExId) { piSourceCache.set(cacheKey, byExId.id); return byExId.id }

  const created = await prisma.source.create({
    data: {
      name,
      url: pi.orcid_id ? `https://orcid.org/${pi.orcid_id}` : null,
      methodologyType: 'primary',
      ingestedBy: 'nih_reporter_v1',
      humanReviewed: false,
      autoApproved: true,
      externalId,
    },
  })
  piSourceCache.set(cacheKey, created.id)
  return created.id
}

// ── SourceRelationship ────────────────────────────────────────────────────────

async function ensureSourceRelationship(
  sourceAId: string,
  sourceBId: string,
  type: string,
): Promise<void> {
  const existing = await prisma.sourceRelationship.findFirst({
    where: { sourceAId, sourceBId, type },
  })
  if (!existing) {
    await prisma.sourceRelationship.create({ data: { sourceAId, sourceBId, type } })
  }
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

async function ensureCoreTopics(): Promise<{ researchFunding: string; nihGrants: string }> {
  const researchFunding = await ensureTopic('research-funding', 'Research Funding', 'research-funding')
  const nihGrants = await ensureTopic('nih-grants', 'NIH Grants', 'research-funding', 'research-funding')
  return { researchFunding, nihGrants }
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

// ── Cross-reference ───────────────────────────────────────────────────────────

async function findClaimsByTopic(slug: string): Promise<{ id: string }[]> {
  const topicId = await findTopic(slug)
  if (!topicId) return []
  const rows = await prisma.claimTopic.findMany({
    where: { topicId },
    include: { claim: { select: { id: true, deleted: true } } },
  })
  return rows.filter(r => !r.claim.deleted).map(r => ({ id: r.claim.id }))
}

async function createCitesEdge(
  grantSourceId: string,
  claimId: string,
  reason: string,
  date: Date | null,
): Promise<void> {
  const exists = await prisma.edge.findFirst({
    where: { sourceId: grantSourceId, claimId, type: 'CITES' },
  })
  if (exists) return
  try {
    const edge = await prisma.edge.create({
      data: {
        sourceId: grantSourceId,
        claimId,
        type: 'CITES',
        evidenceType: 'EVIDENTIARY',
        ingestedBy: 'nih_reporter_v1',
        humanReviewed: false,
        autoApproved: true,
      },
    })
    await prisma.edgeRevision.create({
      data: {
        edgeId: edge.id,
        priorScore: null,
        newScore: 75,
        reason,
        changedAt: date ?? new Date(),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`    Warning: CITES edge failed — ${msg}`)
  }
}

// ── Core: ingest one grant ────────────────────────────────────────────────────

async function ingestGrant(
  project: NIHProject,
  extraTopicIds: string[],
  coreTopicIds: string[],
  crossRefTopicSlugs: string[],
): Promise<IngestResult> {
  if (!isValidProjectNum(project.project_num)) {
    console.warn(`  Skipped (invalid project_num): ${project.project_num}`)
    return 'skipped'
  }
  const orgName = project.organization?.org_name?.trim()
  if (!orgName) {
    console.warn(`  Skipped (no org): ${project.project_num}`)
    return 'skipped'
  }
  if (!project.project_title?.trim()) {
    console.warn(`  Skipped (no title): ${project.project_num}`)
    return 'skipped'
  }
  const startDate = parseGrantDate(project.project_start_date)
  if (!startDate) {
    console.warn(`  Skipped (no start date): ${project.project_num}`)
    return 'skipped'
  }
  if ((project.award_amount ?? 0) < 0) {
    console.warn(`  Skipped (negative award): ${project.project_num}`)
    return 'skipped'
  }

  const claimExId  = `nih_grant_${safeId(project.project_num)}`
  const sourceExId = `nih_source_${safeId(project.project_num)}`

  const existing = await prisma.claim.findUnique({ where: { externalId: claimExId } })
  if (existing) {
    console.log(`  Skipped (exists): ${project.project_num}`)
    return 'skipped'
  }

  const contactPI = project.principal_investigators?.find(pi => pi.is_contact_pi)
    ?? project.principal_investigators?.[0]
  const piName = contactPI ? formatPIName(contactPI) : null

  const amountStr = project.award_amount != null
    ? ` totaling $${project.award_amount.toLocaleString('en-US')}`
    : ''
  const fyStr  = project.fiscal_year ? ` (FY${project.fiscal_year})` : ''
  const piStr  = piName ? `, PI: ${piName}` : ''
  const claimText = `NIH awarded grant ${project.project_num} to ${orgName} for "${project.project_title}"${amountStr}${piStr}${fyStr}.`

  let grantSourceId: string
  let claimId: string

  try {
    const tx = await prisma.$transaction(async t => {
      const grantSource = await t.source.create({
        data: {
          name: `NIH grant ${project.project_num}`,
          url: `https://reporter.nih.gov/project-details/${project.appl_id}`,
          publishedAt: startDate,
          methodologyType: 'primary',
          ingestedBy: 'nih_reporter_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: sourceExId,
        },
      })

      const claim = await t.claim.create({
        data: {
          text: claimText,
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: startDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy: 'nih_reporter_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: claimExId,
        },
      })

      const edge = await t.edge.create({
        data: {
          sourceId: grantSource.id,
          claimId: claim.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: 'nih_reporter_v1',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await t.edgeRevision.create({
        data: {
          edgeId: edge.id,
          priorScore: null,
          newScore: 95,
          reason: 'NIH RePORTER institutional record — federal grant award as primary source',
          changedAt: startDate,
        },
      })

      return { grantSourceId: grantSource.id, claimId: claim.id }
    })

    grantSourceId = tx.grantSourceId
    claimId = tx.claimId
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${project.project_num} — ${msg}`)
    return 'failed'
  }

  // Tag claim (outside transaction — tag failures don't roll back the claim)
  await tagClaim(claimId, [...coreTopicIds, ...extraTopicIds])

  // Cross-reference CITES edges to existing case study claims
  for (const slug of crossRefTopicSlugs) {
    const targets = await findClaimsByTopic(slug)
    for (const target of targets) {
      await createCitesEdge(
        grantSourceId,
        target.id,
        `NIH grant ${project.project_num} funded research at ${orgName} relevant to this claim`,
        startDate,
      )
      console.log(`    + CITES → ${slug}`)
    }
  }

  // SourceRelationship: funder_of (NIH → awardee org)
  const nihId = await ensureNIHFunder()
  const orgId = await ensureOrgSource(project.organization!)
  await ensureSourceRelationship(nihId, orgId, 'funder_of')

  // SourceRelationship: employed_by (contact PI → awardee org)
  if (contactPI) {
    const piId = await ensurePISource(contactPI)
    if (piId) await ensureSourceRelationship(piId, orgId, 'employed_by')
  }

  console.log(`  Ingested: ${project.project_num} — ${orgName}${piStr}`)
  return 'ingested'
}

// ── Case-study bucket ─────────────────────────────────────────────────────────

interface CaseStudySearch {
  label: string
  criteria: Record<string, unknown>
  extraTopicSlugs: string[]
  crossRefTopicSlugs: string[]
  cap: number
}

const CASE_STUDY_SEARCHES: CaseStudySearch[] = [
  {
    label: 'EcoHealth Alliance grants',
    criteria: { org_names: ['ECOHEALTH ALLIANCE'] },
    extraTopicSlugs: ['pandemic-origins'],
    crossRefTopicSlugs: ['pandemic-origins'],
    cap: 30,
  },
  {
    label: 'SARS-CoV-2 / coronavirus research (FY2020-2024)',
    criteria: {
      text_search: 'SARS-CoV-2 coronavirus',
      fiscal_years: [2020, 2021, 2022, 2023, 2024],
    },
    extraTopicSlugs: ['pandemic-origins', 'medicine'],
    crossRefTopicSlugs: ['pandemic-origins'],
    cap: 30,
  },
  {
    label: 'Tobacco / smoking research',
    criteria: { text_search: 'tobacco smoking cigarette nicotine carcinogen' },
    extraTopicSlugs: ['tobacco-control', 'epidemiology'],
    crossRefTopicSlugs: ['tobacco-control'],
    cap: 30,
  },
  {
    label: 'Semaglutide / GLP-1 / obesity research',
    criteria: { text_search: 'semaglutide GLP-1 glucagon-like peptide obesity' },
    extraTopicSlugs: ['drug-approval', 'medicine'],
    crossRefTopicSlugs: ['drug-approval'],
    cap: 20,
  },
]

async function runCaseStudyBucket(limit: number, coreTopicIds: string[]): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const seenNums = new Set<string>()

  for (const search of CASE_STUDY_SEARCHES) {
    const cap = limit > 0 ? Math.min(limit, search.cap) : search.cap
    console.log(`\n  Search: ${search.label} (cap ${cap})\n`)

    const grants = await fetchAllGrants(search.criteria, cap)
    if (grants.length === 0) {
      console.log(`    No results`)
      continue
    }
    console.log(`    Fetched ${grants.length} grants\n`)

    const extraIds: string[] = []
    for (const slug of search.extraTopicSlugs) {
      const id = await findTopic(slug)
      if (id) extraIds.push(id)
      else console.warn(`    Warning: topic '${slug}' not found — skipping tag`)
    }

    for (const grant of grants) {
      if (seenNums.has(grant.project_num)) continue
      seenNums.add(grant.project_num)

      const result = await ingestGrant(grant, extraIds, coreTopicIds, search.crossRefTopicSlugs)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }
  }

  return counts
}

// ── Prestige bucket ───────────────────────────────────────────────────────────
// NIH Director's Pioneer Award (DP1) and Transformative Research Award (RM1)

const PRESTIGE_FYS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]

async function runPrestigeBucket(limit: number, coreTopicIds: string[]): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const cap = limit > 0 ? limit : 250

  console.log(`  Fetching Pioneer (DP1) and Transformative (RM1) awards (FY2014-2024)…\n`)
  const grants = await fetchAllGrants(
    { activity_codes: ['DP1', 'RM1'], fiscal_years: PRESTIGE_FYS },
    cap,
  )
  console.log(`  Found ${grants.length} prestige grants\n`)

  const medicineId = await findTopic('medicine')
  const extraIds = medicineId ? [medicineId] : []

  for (const grant of grants) {
    const result = await ingestGrant(grant, extraIds, coreTopicIds, [])
    if (result === 'ingested') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++
  }

  return counts
}

// ── Reference bucket ──────────────────────────────────────────────────────────
// R01 grants from high-impact biomedical research institutions, FY2022-2024

const REFERENCE_INSTITUTIONS = [
  'BROAD INSTITUTE',
  'WHITEHEAD INSTITUTE',
  'SALK INSTITUTE',
  'SCRIPPS RESEARCH INSTITUTE',
  'COLD SPRING HARBOR LABORATORY',
  'JACKSON LABORATORY',
  'DANA-FARBER CANCER INSTITUTE',
  'MEMORIAL SLOAN KETTERING',
  'FRED HUTCHINSON',
  'MD ANDERSON CANCER CENTER',
  'MAYO CLINIC',
  'JOHNS HOPKINS UNIVERSITY',
  'STANFORD UNIVERSITY',
  'HARVARD UNIVERSITY',
  'MASSACHUSETTS INSTITUTE OF TECHNOLOGY',
  'UNIVERSITY OF CALIFORNIA SAN FRANCISCO',
  'COLUMBIA UNIVERSITY',
  'YALE UNIVERSITY',
  'UNIVERSITY OF PENNSYLVANIA',
  'DUKE UNIVERSITY',
  'UNIVERSITY OF MICHIGAN',
  'UNIVERSITY OF WASHINGTON',
  'UNIVERSITY OF CHICAGO',
  'CORNELL UNIVERSITY',
  'ROCKEFELLER UNIVERSITY',
  'VANDERBILT UNIVERSITY',
  'OHIO STATE UNIVERSITY',
  'NEW YORK UNIVERSITY',
  'MOUNT SINAI',
  'UNIVERSITY OF PITTSBURGH',
]

async function runReferenceBucket(limit: number, coreTopicIds: string[]): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const cap = limit > 0 ? limit : 1000

  console.log(`  Fetching R01 grants from ${REFERENCE_INSTITUTIONS.length} institutions (FY2022-2024)…\n`)
  const grants = await fetchAllGrants(
    {
      activity_codes: ['R01'],
      org_names: REFERENCE_INSTITUTIONS,
      fiscal_years: [2022, 2023, 2024],
    },
    cap,
  )
  console.log(`  Found ${grants.length} reference grants\n`)

  for (const grant of grants) {
    const result = await ingestGrant(grant, [], coreTopicIds, [])
    if (result === 'ingested') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++
  }

  return counts
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { bucket, limit } = parseArgs()
  console.log(`\n=== NIH RePORTER Ingestion — bucket: ${bucket}, limit: ${limit || 'all'} ===\n`)

  const { researchFunding, nihGrants } = await ensureCoreTopics()
  const coreTopicIds = [researchFunding, nihGrants]

  let result: Counts

  switch (bucket) {
    case 'case-study':
      result = await runCaseStudyBucket(limit, coreTopicIds)
      break
    case 'prestige':
      result = await runPrestigeBucket(limit, coreTopicIds)
      break
    case 'reference':
      result = await runReferenceBucket(limit, coreTopicIds)
      break
    default:
      console.error(`Unknown bucket: ${bucket}. Use: case-study | prestige | reference`)
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
