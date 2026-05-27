// FDA Aesthetic Devices ingestion — 510(k) clearances and PMA approvals
// Creates: Claims (INSTITUTIONAL HARD_FACT), Sources, Edges, ClaimTopic edges
// Pipeline ID: fda_aesthetic_devices_v1
// Endpoints:
//   510(k): https://api.fda.gov/device/510k.json
//   PMA   : https://api.fda.gov/device/pma.json
// Run: npx tsx scripts/ingest-fda-aesthetic-devices.ts --dry-run --limit 5

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'fda_aesthetic_devices_v1'
const FDA_510K = 'https://api.fda.gov/device/510k.json'
const FDA_PMA  = 'https://api.fda.gov/device/pma.json'
const API_KEY  = process.env.OPENFDA_API_KEY ?? ''
const MIN_INTERVAL = 200

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpenFDAMeta {
  results?: { skip?: number; limit?: number; total?: number }
}

interface FDA510kRecord {
  k_number?: string
  applicant?: string
  device_name?: string
  decision_date?: string
  decision_description?: string
  advisory_committee_description?: string
  advisory_committee?: string
  product_code?: string
  clearance_type?: string
}

interface FDAPMARecord {
  pma_number?: string
  applicant_name?: string
  trade_name?: string
  generic_name?: string
  decision_date?: string
  decision_code?: string
  advisory_committee?: string
  advisory_committee_description?: string
  product_code?: string
  supplement_type?: string
  supplement_number?: string
}

interface FDA510kResponse {
  meta?: OpenFDAMeta
  results?: FDA510kRecord[]
  error?: { code: string; message: string }
}

interface FDAPMAResponse {
  meta?: OpenFDAMeta
  results?: FDAPMARecord[]
  error?: { code: string; message: string }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { dryRun: boolean; limit: number } {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  const dryRun = args.includes('--dry-run')
  return { dryRun, limit }
}

// ── Rate limit / fetch ────────────────────────────────────────────────────────

let lastReqAt = 0
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function fetchJSON<T>(url: string, retries = 3): Promise<T | null> {
  const apiUrl = API_KEY ? `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(API_KEY)}` : url
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(apiUrl)
    if (res.status === 404) return null
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) {
      const text = await res.text()
      console.warn(`  openFDA error ${res.status}: ${text.slice(0, 200)}`)
      return null
    }
    return res.json() as Promise<T>
  }
  return null
}

// ── Aesthetic keyword filter (plastic surgery committee post-filter) ──────────

const AESTHETIC_KEYWORDS = [
  'breast', 'filler', 'implant', 'laser', 'botulinum', 'liposuction',
  'rhinoplasty', 'blepharoplasty', 'facelift', 'augmentation', 'tightening',
  'rejuvenation', 'resurfacing', 'microneedl', 'radiofrequency', 'cryolipo',
  'ultherapy', 'hyaluronic', 'collagen',
]

function isAestheticDevice(deviceName: string | undefined | null): boolean {
  if (!deviceName) return false
  const lc = deviceName.toLowerCase()
  return AESTHETIC_KEYWORDS.some(k => lc.includes(k))
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDate(s: string | undefined | null): Date | null {
  if (!s) return null
  // openFDA device APIs return YYYY-MM-DD
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string, name: string, domain: string, parentSlug?: string,
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

async function ensureCoreTopics(): Promise<string[]> {
  const fdaDevices = await ensureTopic('fda-devices', 'FDA Devices', 'medicine')
  const aesthetics = await ensureTopic('aesthetics', 'Aesthetics & Cosmetic Medicine', 'medicine')
  const medicine   = await prisma.topic.findUnique({ where: { slug: 'medicine' } })
  const ids = [fdaDevices, aesthetics]
  if (medicine) ids.push(medicine.id)
  return ids
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

// ── 510(k) fetch strategies ───────────────────────────────────────────────────

const MAX_RECORDS_PER_SEARCH = 1000   // openFDA max limit
const PAGE_SIZE              = 100
const DECISION_CUTOFF        = '2000-01-01'

interface SearchSpec {
  label: string
  search: string
  cap?: number             // soft cap for ALL pages from this search
  filterAesthetic?: boolean // post-filter by AESTHETIC_KEYWORDS
}

const FDA_510K_SEARCHES: SearchSpec[] = [
  // Specific device-name keywords (already aesthetic-relevant)
  { label: 'hyaluronic',          search: 'device_name:hyaluronic' },
  { label: 'botulinum',           search: 'device_name:botulinum' },
  { label: 'liposuction',         search: 'device_name:liposuction' },
  { label: 'rhinoplasty',         search: 'device_name:rhinoplasty' },
  { label: 'laser+skin',          search: 'device_name:laser+AND+device_name:skin' },
  { label: 'breast+implant',      search: 'device_name:breast+AND+device_name:implant' },
  { label: 'microneedle',         search: '(device_name:microneedle+OR+device_name:microneedling)' },
  { label: 'radiofrequency+skin', search: 'device_name:radiofrequency+AND+device_name:skin' },
  { label: 'cryolipolysis',       search: 'device_name:cryolipolysis' },
  { label: 'injectable+filler',   search: '(device_name:filler+AND+device_name:injectable)+OR+(device_name:injectable+AND+device_name:filler)' },
  { label: 'fat+grafting',        search: 'device_name:fat+AND+device_name:grafting' },
  { label: 'hair+transplant',     search: 'device_name:hair+AND+device_name:transplant' },
  // Plastic surgery committee sweep — broad, must post-filter
  {
    label: 'committee:plastic-surgery',
    search: 'advisory_committee_description.exact:"General, Plastic Surgery"',
    cap: MAX_RECORDS_PER_SEARCH,
    filterAesthetic: true,
  },
]

async function fetch510kSearch(spec: SearchSpec, hardCap: number): Promise<FDA510kRecord[]> {
  const out: FDA510kRecord[] = []
  let skip = 0

  const overallCap = spec.cap ?? MAX_RECORDS_PER_SEARCH
  const targetTotal = hardCap > 0 ? Math.min(hardCap, overallCap) : overallCap

  while (out.length < targetTotal) {
    const url = new URL(FDA_510K)
    url.searchParams.set('search', spec.search)
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('skip', String(skip))
    const data = await fetchJSON<FDA510kResponse>(url.toString())
    if (!data || data.error || !data.results || data.results.length === 0) break
    out.push(...data.results)
    if (data.results.length < PAGE_SIZE) break
    skip += PAGE_SIZE
    if (skip >= MAX_RECORDS_PER_SEARCH) break // openFDA skip limit
  }

  return out
}

// ── PMA fetch strategies ──────────────────────────────────────────────────────

const FDA_PMA_SEARCHES: SearchSpec[] = [
  { label: 'breast+implant',   search: 'device_name:breast+AND+device_name:implant' },
  { label: 'facial+implant',   search: 'device_name:facial+AND+device_name:implant' },
  { label: 'injectable+filler',search: 'device_name:injectable+AND+device_name:filler' },
  { label: 'botulinum',        search: 'device_name:botulinum' },
  { label: 'silicone+implant', search: 'generic_name:silicone+AND+generic_name:implant' },
]

async function fetchPMASearch(spec: SearchSpec, hardCap: number): Promise<FDAPMARecord[]> {
  const out: FDAPMARecord[] = []
  let skip = 0
  const overallCap = spec.cap ?? MAX_RECORDS_PER_SEARCH
  const targetTotal = hardCap > 0 ? Math.min(hardCap, overallCap) : overallCap

  while (out.length < targetTotal) {
    const url = new URL(FDA_PMA)
    url.searchParams.set('search', spec.search)
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('skip', String(skip))
    const data = await fetchJSON<FDAPMAResponse>(url.toString())
    if (!data || data.error || !data.results || data.results.length === 0) break
    out.push(...data.results)
    if (data.results.length < PAGE_SIZE) break
    skip += PAGE_SIZE
    if (skip >= MAX_RECORDS_PER_SEARCH) break
  }

  return out
}

// ── Ingest 510(k) ─────────────────────────────────────────────────────────────

async function ingest510kRecord(
  rec: FDA510kRecord,
  coreTopicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const kNumber = rec.k_number?.trim()
  if (!kNumber) return 'skipped'

  const deviceName = rec.device_name?.trim()
  const applicant  = rec.applicant?.trim()
  const decisionRaw = rec.decision_date
  const decisionDate = parseDate(decisionRaw)
  const committee = rec.advisory_committee_description?.trim()
    ?? rec.advisory_committee?.trim()

  if (!deviceName || !applicant || !decisionDate) return 'skipped'

  // Decision-date cutoff
  if (decisionRaw && decisionRaw < DECISION_CUTOFF) return 'skipped'

  const externalId = `fda_510k_${kNumber}`

  if (!dryRun) {
    const existing = await prisma.claim.findUnique({ where: { externalId } })
    if (existing) return 'skipped'
  }

  const committeeStr = committee ? ` for ${committee} use` : ''
  const claimText = `FDA cleared ${deviceName} (510k K-number ${kNumber}) from ${applicant}${committeeStr}, cleared ${decisionRaw}.`
  const sourceUrl = `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${encodeURIComponent(kNumber)}`

  if (dryRun) {
    console.log(`  [DRY RUN] 510k ${kNumber} — ${deviceName.slice(0, 60)}`)
    return 'ingested'
  }

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name: `FDA 510(k) ${kNumber}`,
          url: sourceUrl,
          publishedAt: decisionDate,
          methodologyType: 'primary',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: `fda_510k_source_${kNumber}`,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text: claimText,
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          verificationStatus: 'VERIFIED',
          claimEmergedAt: decisionDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId,
          metadata: {
            dataset: INGESTED_BY,
            record_type: '510k',
            k_number: kNumber,
            device_name: deviceName,
            applicant,
            advisory_committee_description: committee ?? null,
            product_code: rec.product_code ?? null,
            decision_date: decisionRaw,
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
          reason: 'FDA 510(k) clearance — authoritative primary regulatory record',
          changedAt: decisionDate,
        },
      })

      return { claimId: claim.id }
    }, { timeout: 30000 })

    await tagClaim(claimId, coreTopicIds)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed 510k ${kNumber}: ${msg}`)
    return 'failed'
  }
}

// ── Ingest PMA ────────────────────────────────────────────────────────────────

async function ingestPMARecord(
  rec: FDAPMARecord,
  coreTopicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const pmaNumber = rec.pma_number?.trim()
  if (!pmaNumber) return 'skipped'

  const tradeName  = rec.trade_name?.trim()
  const genericName = rec.generic_name?.trim()
  const applicant   = rec.applicant_name?.trim()
  const decisionRaw = rec.decision_date
  const decisionDate = parseDate(decisionRaw)

  if (!tradeName || !applicant || !decisionDate) return 'skipped'

  // Restrict to ORIGINAL approvals (or empty supplement_type — primary).
  // Empty values come through as undefined or "" from the API.
  const supplementType = (rec.supplement_type ?? '').trim()
  if (supplementType !== '' && supplementType.toUpperCase() !== 'ORIGINAL') return 'skipped'

  const supplementNumber = (rec.supplement_number ?? '').trim()
  const suffix = supplementNumber && supplementNumber !== '0' ? `_${supplementNumber}` : ''
  const externalId = `fda_pma_${pmaNumber}${suffix}`

  if (!dryRun) {
    const existing = await prisma.claim.findUnique({ where: { externalId } })
    if (existing) return 'skipped'
  }

  const genStr = genericName ? ` (${genericName})` : ''
  const claimText = `FDA approved ${tradeName}${genStr} under PMA ${pmaNumber} from ${applicant}, approved ${decisionRaw}.`
  const sourceUrl = `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id=${encodeURIComponent(pmaNumber)}`

  if (dryRun) {
    console.log(`  [DRY RUN] PMA ${pmaNumber} — ${tradeName.slice(0, 60)}`)
    return 'ingested'
  }

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name: `FDA PMA ${pmaNumber}`,
          url: sourceUrl,
          publishedAt: decisionDate,
          methodologyType: 'primary',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: `fda_pma_source_${pmaNumber}${suffix}`,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text: claimText,
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          verificationStatus: 'VERIFIED',
          claimEmergedAt: decisionDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId,
          metadata: {
            dataset: INGESTED_BY,
            record_type: 'pma',
            pma_number: pmaNumber,
            trade_name: tradeName,
            generic_name: genericName ?? null,
            applicant_name: applicant,
            supplement_type: supplementType || 'ORIGINAL',
            supplement_number: supplementNumber || null,
            product_code: rec.product_code ?? null,
            decision_date: decisionRaw,
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
          reason: 'FDA PMA approval — authoritative primary regulatory record',
          changedAt: decisionDate,
        },
      })

      return { claimId: claim.id }
    }, { timeout: 30000 })

    await tagClaim(claimId, coreTopicIds)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed PMA ${pmaNumber}: ${msg}`)
    return 'failed'
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs()
  console.log(`\n=== FDA Aesthetic Devices Ingestion${dryRun ? ' [DRY RUN]' : ''}${limit > 0 ? ` (limit ${limit})` : ''} ===\n`)

  const coreTopicIds = await ensureCoreTopics()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const seenKNumbers = new Set<string>()
  const seenPMAs = new Set<string>()

  // ── 510(k) sweep ─────────────────────────────────────────────────────────
  console.log(`\n── 510(k) clearances ──────────────────────────────────────────────`)
  for (const spec of FDA_510K_SEARCHES) {
    if (limit > 0 && counts.ingested >= limit) break
    const remaining = limit > 0 ? limit - counts.ingested : 0
    const cap = remaining > 0 ? remaining * 4 : 0 // overfetch to absorb dedupe/skip
    console.log(`\n  Search: ${spec.label}${spec.filterAesthetic ? ' (post-filter aesthetic)' : ''}`)
    const records = await fetch510kSearch(spec, cap)
    console.log(`    Fetched ${records.length} records`)

    for (const rec of records) {
      if (limit > 0 && counts.ingested >= limit) break
      const k = rec.k_number?.trim()
      if (!k || seenKNumbers.has(k)) continue
      if (spec.filterAesthetic && !isAestheticDevice(rec.device_name)) continue
      seenKNumbers.add(k)

      const result = await ingest510kRecord(rec, coreTopicIds, dryRun)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }
  }

  // ── PMA sweep ────────────────────────────────────────────────────────────
  console.log(`\n── PMA approvals ──────────────────────────────────────────────────`)
  for (const spec of FDA_PMA_SEARCHES) {
    if (limit > 0 && counts.ingested >= limit) break
    const remaining = limit > 0 ? limit - counts.ingested : 0
    const cap = remaining > 0 ? remaining * 4 : 0
    console.log(`\n  Search: ${spec.label}`)
    const records = await fetchPMASearch(spec, cap)
    console.log(`    Fetched ${records.length} records`)

    for (const rec of records) {
      if (limit > 0 && counts.ingested >= limit) break
      const pma = rec.pma_number?.trim()
      const sup = (rec.supplement_number ?? '').trim()
      const dedupeKey = `${pma}_${sup}`
      if (!pma || seenPMAs.has(dedupeKey)) continue
      seenPMAs.add(dedupeKey)

      const result = await ingestPMARecord(rec, coreTopicIds, dryRun)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${counts.ingested}`)
  console.log(`  Skipped  : ${counts.skipped}`)
  console.log(`  Errors   : ${counts.errors}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
