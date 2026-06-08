// IUCN Red List species conservation status ingestion — iucn_redlist_v1
// Source: IUCN Red List API v3 — https://apiv3.iucnredlist.org/api/v3/docs
// Token: free for research; register at https://apiv3.iucnredlist.org/api/v3/token
//   then add IUCN_API_KEY=... to .env.local
//
// Coverage: threatened species only (EX, EW, CR, EN, VU) — ~45k records.
// Least Concern (LC) skipped per editorial decision (low per-record receipt value).
//
// Run:
//   npx tsx scripts/ingest-iucn.ts --dry-run --limit 20
//   ALLOW_EDITS=true npx tsx scripts/ingest-iucn.ts --limit 100
//   ALLOW_EDITS=true npx tsx scripts/ingest-iucn.ts                  (full run)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'iucn_redlist_v1'
const IUCN_BASE = 'https://apiv3.iucnredlist.org/api/v3'
const REQ_DELAY_MS = 300

const THREATENED = new Set(['EX', 'EW', 'CR', 'EN', 'VU'])

const CATEGORY_NAMES: Record<string, string> = {
  EX: 'Extinct',
  EW: 'Extinct in the Wild',
  CR: 'Critically Endangered',
  EN: 'Endangered',
  VU: 'Vulnerable',
  NT: 'Near Threatened',
  LC: 'Least Concern',
  DD: 'Data Deficient',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface IUCNPageSpecies {
  taxonid: number
  kingdom_name?: string | null
  phylum_name?: string | null
  class_name?: string | null
  order_name?: string | null
  family_name?: string | null
  genus_name?: string | null
  scientific_name: string
  taxonomic_authority?: string | null
  infra_rank?: string | null
  infra_name?: string | null
  population?: string | null
  category: string
  main_common_name?: string | null
}

interface IUCNPageResponse {
  count: number
  page?: number
  result: IUCNPageSpecies[]
}

interface IUCNTokenError {
  message: string
}

type IngestResult = 'ingested' | 'skipped' | 'error'
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── CLI ───────────────────────────────────────────────────────────────────────

interface Args { dryRun: boolean; limit: number | null; verbose: boolean }

function parseArgs(): Args {
  const a = process.argv.slice(2)
  const li = a.indexOf('--limit')
  const limit = li !== -1 && a[li + 1] ? parseInt(a[li + 1]!, 10) : null
  return {
    dryRun: a.includes('--dry-run'),
    limit: limit && limit > 0 ? limit : null,
    verbose: a.includes('--verbose'),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchPage(apiKey: string, page: number): Promise<IUCNPageSpecies[]> {
  const url = `${IUCN_BASE}/species/page/${page}?token=${encodeURIComponent(apiKey)}`
  const MAX_RETRIES = 4
  let delay = 2000
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EpistemicReceipts/1.0 (research; robert.contofalsky@rutgers.edu)',
      },
    })
    if ([429, 502, 503, 504].includes(res.status)) {
      if (attempt === MAX_RETRIES) throw new Error(`IUCN page ${page}: HTTP ${res.status} after ${MAX_RETRIES} retries`)
      console.warn(`  HTTP ${res.status} at page ${page} — backing off ${delay}ms`)
      await sleep(delay); delay *= 2; continue
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`IUCN page ${page} failed: HTTP ${res.status}\n${body.slice(0, 500)}`)
    }
    const data = (await res.json()) as IUCNPageResponse | IUCNTokenError
    if ('message' in data) throw new Error(`IUCN API error: ${data.message}`)
    return data.result ?? []
  }
  throw new Error('fetchPage: unreachable')
}

function buildClaimText(s: IUCNPageSpecies): string {
  const common = s.main_common_name ? ` (${s.main_common_name})` : ''
  const categoryFull = CATEGORY_NAMES[s.category] ?? s.category
  const title = `${s.scientific_name}${common}: ${categoryFull}`
  const taxonomy: string[] = []
  if (s.class_name) taxonomy.push(`Class: ${s.class_name}`)
  if (s.order_name) taxonomy.push(`Order: ${s.order_name}`)
  const body = `IUCN Red List category: ${s.category} (${categoryFull}).${taxonomy.length ? ' ' + taxonomy.join('. ') + '.' : ''}`
  return `${title}. ${body}`
}

// ── Ingest one species ────────────────────────────────────────────────────────

async function ingestSpecies(s: IUCNPageSpecies): Promise<IngestResult> {
  const externalId = `iucn_${s.taxonid}`
  const sourceExternalId = `iucn_source_${s.taxonid}`

  const existing = await prisma.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const claimText = buildClaimText(s)
  const sourceUrl = `https://www.iucnredlist.org/species/${s.taxonid}/0`
  const sourceName = `IUCN Red List: ${s.scientific_name}`

  try {
    await prisma.$transaction(async (tx: TxClient) => {
      const source = await tx.source.create({
        data: {
          name: sourceName,
          url: sourceUrl,
          publishedAt: null,
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
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          verificationStatus: 'VERIFIED',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId,
          metadata: {
            dataset: INGESTED_BY,
            taxonId: s.taxonid,
            kingdom: s.kingdom_name ?? null,
            phylum: s.phylum_name ?? null,
            class: s.class_name ?? null,
            order: s.order_name ?? null,
            family: s.family_name ?? null,
            genus: s.genus_name ?? null,
            scientificName: s.scientific_name,
            commonName: s.main_common_name ?? null,
            category: s.category,
            categoryFullName: CATEGORY_NAMES[s.category] ?? s.category,
            population: s.population ?? null,
            domain: 'biology',
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
          reason: 'IUCN Red List — global authority on species conservation status',
        },
      })
    }, { timeout: 30000 })

    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed taxon ${s.taxonid} (${s.scientific_name}): ${msg}`)
    return 'error'
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()

  const apiKey = process.env.IUCN_API_KEY
  if (!apiKey) {
    console.error(
      '\nBLOCKED: IUCN_API_KEY is not set.\n' +
      '\n' +
      'IUCN Red List API v3 requires a free token for research use.\n' +
      '  1. Request at https://apiv3.iucnredlist.org/api/v3/token (returns by email)\n' +
      '  2. Add to .env.local:    IUCN_API_KEY=your-token\n' +
      '  3. Re-run this script.\n' +
      '\n' +
      'Exiting gracefully without DB writes.\n',
    )
    await prisma.$disconnect()
    process.exit(2)
  }

  if (!args.dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to run live ingestion (or pass --dry-run).')
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`\n=== IUCN Red List Ingestion ===`)
  console.log(`  mode      : ${args.dryRun ? 'DRY-RUN (no DB writes)' : 'LIVE'}`)
  console.log(`  limit     : ${args.limit ?? '(unbounded — threatened only, ~45k expected)'}`)
  console.log(`  filter    : ${[...THREATENED].join(', ')} (LC, NT, DD excluded)`)
  console.log(`  rate      : ${REQ_DELAY_MS}ms / page request\n`)

  let page = 0
  let totalFetched = 0
  let threatenedCount = 0
  let ingested = 0
  let skipped = 0
  let errors = 0
  const drySample: Array<{
    taxonid: number
    scientific_name: string
    category: string
    class_name: string | null
    claimText: string
    sourceUrl: string
  }> = []

  for (;;) {
    if (args.limit !== null && ingested >= args.limit && !args.dryRun) break
    if (args.limit !== null && threatenedCount >= args.limit && args.dryRun) break

    let result: IUCNPageSpecies[]
    try {
      result = await fetchPage(apiKey, page)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Page fetch failed at page=${page}: ${msg}`)
      await prisma.$disconnect()
      process.exit(1)
    }

    if (result.length === 0) {
      console.log(`No more results at page=${page}. Pagination complete.`)
      break
    }

    totalFetched += result.length
    console.log(`  Page ${page}: ${result.length} species (total fetched: ${totalFetched})`)

    for (const sp of result) {
      if (!THREATENED.has(sp.category)) continue
      threatenedCount++

      if (args.verbose) {
        console.log(`    [${sp.category}] ${sp.taxonid} — ${sp.scientific_name}`)
      }

      if (args.dryRun) {
        if (drySample.length < 25) {
          drySample.push({
            taxonid: sp.taxonid,
            scientific_name: sp.scientific_name,
            category: sp.category,
            class_name: sp.class_name ?? null,
            claimText: buildClaimText(sp),
            sourceUrl: `https://www.iucnredlist.org/species/${sp.taxonid}/0`,
          })
        }
        if (args.limit !== null && threatenedCount >= args.limit) break
        continue
      }

      const outcome = await ingestSpecies(sp)
      if (outcome === 'ingested') ingested++
      else if (outcome === 'skipped') skipped++
      else errors++

      if (ingested > 0 && ingested % 250 === 0) {
        console.log(`    Progress: ${ingested} ingested, ${skipped} skipped, ${errors} errors`)
      }

      if (args.limit !== null && ingested >= args.limit) break
    }

    page++
    await sleep(REQ_DELAY_MS)
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Pages fetched     : ${page + 1}`)
  console.log(`  Species fetched   : ${totalFetched}`)
  console.log(`  Threatened (EX/EW/CR/EN/VU): ${threatenedCount}`)

  if (args.dryRun) {
    const samplePath = 'iucn-dry-run-sample.json'
    writeFileSync(samplePath, JSON.stringify({
      totalFetched,
      threatenedCount,
      sample: drySample,
    }, null, 2))
    console.log(`  Dry-run sample    : ${samplePath} (${drySample.length} records)`)
  } else {
    console.log(`  Ingested          : ${ingested}`)
    console.log(`  Skipped (existing): ${skipped}`)
    console.log(`  Errors            : ${errors}`)

    // Verify ingester counter against DB state (per CLAUDE.md rule)
    const dbCount = await prisma.claim.count({
      where: { ingestedBy: INGESTED_BY, deleted: false },
    })
    console.log(`  DB count          : ${dbCount}`)
    if (dbCount !== ingested + skipped) {
      console.warn(`  WARNING: DB count (${dbCount}) does not match ingested+skipped (${ingested + skipped})`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
