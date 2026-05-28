// Enrichment: Church Committee NARA records (RG 128)
// Fetches fuller descriptions from NARA Catalog API and updates claim text.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-church-committee.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-church-committee.ts --full (requires ALLOW_EDITS=true)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NARA_BASE = 'https://catalog.archives.gov/api/v2'
const THROTTLE_MS = 300
const INGESTED_BY = 'nara_catalog_v1'
const RG128_LABEL = 'Record Group 128'
const CHURCH_LABEL = 'Church Committee'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NaraDetailResponse {
  body?: {
    hits?: {
      hits?: Array<{
        _source?: {
          record?: {
            title?: string
            scopeAndContentNote?: string
            description?: string
            seriesTitle?: string
          }
        }
      }>
    }
  }
  opaResponse?: {
    results?: {
      result?: {
        description?: string
        scopeAndContentNote?: string
      } | Array<{ description?: string; scopeAndContentNote?: string }>
    }
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

let lastReqAt = 0

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function naraFetch(naId: string, apiKey: string): Promise<NaraDetailResponse | null> {
  await throttle()
  const url = `${NARA_BASE}/records/search?naId=${naId}`
  let delay = 2000
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < 2) {
      console.warn(`  HTTP ${res.status} for naId ${naId} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} for naId ${naId} — skipping`)
      return null
    }
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json') && !ct.includes('text/json')) return null
    return res.json() as Promise<NaraDetailResponse>
  }
  return null
}

function extractDescription(data: NaraDetailResponse): string | null {
  const hit = data?.body?.hits?.hits?.[0]?._source?.record
  if (hit) {
    return hit.scopeAndContentNote?.trim() || hit.description?.trim() || null
  }
  const results = data?.opaResponse?.results?.result
  if (results) {
    const r = Array.isArray(results) ? results[0] : results
    return r?.scopeAndContentNote?.trim() || r?.description?.trim() || null
  }
  return null
}

function extractNaId(claim: { text: string; externalId: string | null; metadata: unknown }): string | null {
  // Try metadata.naId first
  const meta = claim.metadata as Record<string, unknown> | null
  if (meta?.naId) return String(meta.naId)
  // Fall back to externalId pattern: nara_catalog_XXXXXX
  if (claim.externalId) {
    const m = claim.externalId.match(/nara_catalog_(\d+)/)
    if (m) return m[1]
  }
  return null
}

function buildRicherText(title: string, description: string, beginDate: string | null, endDate: string | null): string {
  const dateStr = beginDate && endDate && beginDate !== endDate
    ? `, originally dated ${beginDate}–${endDate}`
    : beginDate || endDate
      ? `, originally dated ${beginDate ?? endDate}`
      : ''
  return `"${title}" [${description}] — archived at NARA, ${RG128_LABEL} (${CHURCH_LABEL})${dateStr}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const isFull = args.includes('--full')
  const isDryRun = !isFull

  if (isFull && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true environment variable')
    process.exit(1)
  }

  const apiKey = process.env.NARA_API_KEY || ''
  if (!apiKey) {
    console.error('NARA_API_KEY environment variable not set.')
    process.exit(1)
  }

  console.log(`\n── Enrichment: Church Committee NARA Records ──────────────────────────`)
  console.log(`Mode: ${isDryRun ? 'dry-run' : 'full'}`)

  // Find Church Committee claims — RG 128 records
  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: INGESTED_BY,
      deleted: false,
      OR: [
        { text: { contains: RG128_LABEL } },
        {
          edges: {
            some: {
              source: { url: { contains: 'recordGroupNumber=128' } },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      text: true,
      externalId: true,
      metadata: true,
    },
  })

  console.log(`\nFound ${claims.length} RG 128 (Church Committee) claims`)
  if (claims.length === 0) {
    console.log('Nothing to enrich.')
    return
  }

  let enriched = 0
  let unchanged = 0
  let failed = 0

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i]
    const naId = extractNaId(claim as { text: string; externalId: string | null; metadata: unknown })
    if (!naId) {
      console.warn(`  [${i + 1}/${claims.length}] No naId found — ${claim.id}`)
      failed++
      continue
    }

    console.log(`  [${i + 1}/${claims.length}] naId=${naId}`)

    const data = await naraFetch(naId, apiKey)
    if (!data) { failed++; continue }

    const description = extractDescription(data)
    if (!description) {
      console.log(`    No description returned — skipping`)
      unchanged++
      continue
    }

    // Extract title from existing claim text (between the opening quote and closing quote)
    const titleMatch = claim.text.match(/^"(.+?)"/)
    if (!titleMatch) { unchanged++; continue }
    const title = titleMatch[1]

    // Only enrich if description is meaningfully different from just the title
    if (description.trim().toLowerCase() === title.toLowerCase()) {
      unchanged++
      continue
    }

    const meta = claim.metadata as Record<string, unknown> | null
    const beginDate = (meta?.beginDate as string) || null
    const endDate = (meta?.endDate as string) || null
    const newText = buildRicherText(title, description.slice(0, 800), beginDate, endDate)

    if (isDryRun) {
      console.log(`    [DRY-RUN] Would update:`)
      console.log(`      Old: ${claim.text.slice(0, 120)}`)
      console.log(`      New: ${newText.slice(0, 120)}`)
      enriched++
      continue
    }

    await prisma.claim.update({
      where: { id: claim.id },
      data: { text: newText },
    })
    console.log(`    Updated: ${newText.slice(0, 100)}…`)
    enriched++
  }

  console.log(`\nEnrichment complete:`)
  console.log(`  Enriched:  ${enriched}`)
  console.log(`  Unchanged: ${unchanged}`)
  console.log(`  Failed:    ${failed}`)
  if (isDryRun) console.log('\n(dry-run — no DB writes made)')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
