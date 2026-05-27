// Cosmetic FAERS Aggregates — product-level adverse event counts
// Mirrors Pipeline 8 (ingest-faers-current-drugs.ts) for cosmetic products.
// Endpoint: https://api.fda.gov/cosmetic/event.json?count=products.product_name.exact
// Creates: Claims (EMPIRICAL HARD_FACT), Sources, Edges, ClaimTopic edges
// Pipeline ID: cosmetic_faers_v1
// Run: npx tsx scripts/ingest-cosmetic-faers.ts --dry-run --limit 5

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'cosmetic_faers_v1'
const OPENFDA_COSMETIC = 'https://api.fda.gov/cosmetic/event.json'
const API_KEY = process.env.OPENFDA_API_KEY ?? ''
const MIN_INTERVAL = 200
const MIN_REPORTS  = 5   // noise threshold
const COUNT_LIMIT  = 1000

// ── Types ─────────────────────────────────────────────────────────────────────

interface CountEntry { term: string; count: number }

interface OpenFDACountResponse {
  meta?: { last_updated?: string; results?: { skip?: number; limit?: number; total?: number } }
  results?: CountEntry[]
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

// ── Helpers ───────────────────────────────────────────────────────────────────

let lastReqAt = 0
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function fetchJSON<T>(url: string): Promise<T> {
  await throttle()
  const apiUrl = API_KEY ? `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(API_KEY)}` : url
  const res = await fetch(apiUrl)
  return res.json() as Promise<T>
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 100)
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
  const cosmeticSafety = await ensureTopic('cosmetic-safety', 'Cosmetic Safety', 'medicine')
  const aesthetics     = await ensureTopic('aesthetics', 'Aesthetics & Cosmetic Medicine', 'medicine')
  const medicine       = await prisma.topic.findUnique({ where: { slug: 'medicine' } })
  const ids = [cosmeticSafety, aesthetics]
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

// ── Fetch aggregate counts ────────────────────────────────────────────────────

async function fetchAggregateCounts(): Promise<{ entries: CountEntry[]; lastUpdated: string }> {
  const url = new URL(OPENFDA_COSMETIC)
  url.searchParams.set('count', 'products.product_name.exact')
  url.searchParams.set('limit', String(COUNT_LIMIT))

  const data = await fetchJSON<OpenFDACountResponse>(url.toString())
  if (data.error) throw new Error(`openFDA cosmetic count error: ${data.error.code} — ${data.error.message}`)
  const results = data.results ?? []
  const lastUpdated = data.meta?.last_updated ?? ''
  return { entries: results, lastUpdated }
}

// ── Ingest one product ────────────────────────────────────────────────────────

async function ingestProduct(
  entry: CountEntry,
  queryDate: string,
  lastUpdated: string,
  coreTopicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const term = entry.term?.trim()
  if (!term) return 'skipped'
  if (!Number.isInteger(entry.count) || entry.count < MIN_REPORTS) return 'skipped'

  const slug = toSlug(term)
  if (!slug) return 'skipped'

  const externalId = `cosmetic_faers_${slug}`.slice(0, 100)
  const sourceExternalId = `cosmetic_faers_src_${slug}`.slice(0, 100)

  if (!dryRun) {
    const existing = await prisma.claim.findUnique({ where: { externalId } })
    if (existing) return 'skipped'
  }

  const encoded = encodeURIComponent(term).replace(/%20/g, '+')
  const sourceUrl = `https://api.fda.gov/cosmetic/event.json?search=products.product_name.exact:%22${encoded}%22`
  const claimText = `${term} has ${entry.count.toLocaleString('en-US')} cosmetic adverse event reports filed with the FDA.`

  if (dryRun) {
    console.log(`  [DRY RUN] ${term} — ${entry.count} reports`)
    return 'ingested'
  }

  const claimDate = new Date(queryDate)

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name: 'openFDA Cosmetic Adverse Events',
          url: sourceUrl,
          publishedAt: claimDate,
          methodologyType: 'primary',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: sourceExternalId,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text: claimText,
          claimType: 'EMPIRICAL',
          currentStatus: 'HARD_FACT',
          verificationStatus: 'VERIFIED',
          claimEmergedAt: claimDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId,
          metadata: {
            dataset: INGESTED_BY,
            product_name: term,
            product_name_slug: slug,
            total_reports: entry.count,
            query_date: queryDate,
            query_url: sourceUrl,
            data_source: 'openFDA Cosmetic Adverse Events',
            data_last_updated: lastUpdated || null,
            caveat: 'FDA cosmetic adverse event reports are voluntary submissions. Counts reflect reported associations, not confirmed causation.',
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
          newScore: 85,
          reason: 'openFDA cosmetic adverse event aggregate — voluntary reports, no causation',
          changedAt: claimDate,
        },
      })

      return { claimId: claim.id }
    })

    await tagClaim(claimId, coreTopicIds)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed ${term}: ${msg}`)
    return 'failed'
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs()
  const queryDate = new Date().toISOString().split('T')[0]
  console.log(`\n=== Cosmetic FAERS Aggregates${dryRun ? ' [DRY RUN]' : ''}${limit > 0 ? ` (limit ${limit})` : ''} ===\n`)

  const coreTopicIds = await ensureCoreTopics()

  console.log(`\n  Fetching aggregate counts from openFDA...`)
  const { entries, lastUpdated } = await fetchAggregateCounts()
  console.log(`  Received ${entries.length} product aggregates`)
  if (lastUpdated) console.log(`  Dataset last_updated: ${lastUpdated}`)

  // Filter + sort by count desc; entries from openFDA are already count-sorted.
  const filtered = entries
    .filter(e => Number.isInteger(e.count) && e.count >= MIN_REPORTS && e.term?.trim())
    .sort((a, b) => b.count - a.count)

  console.log(`  After ≥${MIN_REPORTS}-report filter: ${filtered.length} products`)

  const rows = limit > 0 ? filtered.slice(0, limit) : filtered
  console.log(`  Processing ${rows.length} rows...\n`)

  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const entry of rows) {
    const result = await ingestProduct(entry, queryDate, lastUpdated, coreTopicIds, dryRun)
    if (result === 'ingested') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++
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
