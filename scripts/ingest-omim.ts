// OMIM (Online Mendelian Inheritance in Man) phenotype ingestion — omim_v1
// Free for research; requires OMIM_API_KEY in .env.local (get one at https://www.omim.org/api)
// Docs: https://omim.org/api
// Run:   npx tsx scripts/ingest-omim.ts --dry-run --limit 20
//        ALLOW_EDITS=true npx tsx scripts/ingest-omim.ts --limit 100
//        ALLOW_EDITS=true npx tsx scripts/ingest-omim.ts            (full run, ~27k entries)
//
// OMIM entry prefix legend (https://omim.org/help/faq#1_3):
//   #  phenotype, molecular basis known
//   %  Mendelian phenotype, molecular basis unknown
//   +  gene with phenotype
//   *  gene description only (no phenotype)
//   ^  moved or removed entry
//   (no prefix) phenotype with suspected Mendelian basis
// This pipeline ingests phenotype entries: '#', '%', and no-prefix.

import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const OMIM_BASE = 'https://api.omim.org/api'
const PAGE_SIZE = 20
const REQ_DELAY_MS = 500
const DESCRIPTION_LIMIT = 500
const PHENOTYPE_PREFIXES = new Set(['#', '%', ''])

// ---- Types ----------------------------------------------------------------

interface OMIMTitles {
  preferredTitle?: string
  alternativeTitles?: string
}

interface OMIMTextSection {
  textSectionName?: string
  textSectionTitle?: string
  textSectionContent?: string
}

interface OMIMEntry {
  prefix?: string
  mimNumber: number
  status?: string
  titles?: OMIMTitles
  textSectionList?: { textSection: OMIMTextSection }[]
}

interface OMIMSearchResponse {
  omim: {
    searchResponse?: {
      totalResults?: number
      startIndex?: number
      endIndex?: number
      entryList?: { entry: OMIMEntry }[]
    }
  }
}

// ---- CLI -------------------------------------------------------------------

interface Args {
  dryRun: boolean
  limit: number | null
  verbose: boolean
}

function parseArgs(): Args {
  const a = process.argv.slice(2)
  const li = a.indexOf('--limit')
  const limit = li !== -1 && a[li + 1] ? parseInt(a[li + 1], 10) : null
  return {
    dryRun: a.includes('--dry-run'),
    limit: limit && limit > 0 ? limit : null,
    verbose: a.includes('--verbose'),
  }
}

// ---- Helpers ---------------------------------------------------------------

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

function cleanDescription(raw: string): string {
  // OMIM text sections sometimes carry section markers like "Description\n\n..."
  // and embedded {N:M-...} citation tokens. Light cleanup only — keep semantics.
  return raw
    .replace(/\{\d+:[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- OMIM API --------------------------------------------------------------

async function fetchPage(apiKey: string, start: number): Promise<OMIMEntry[]> {
  // sort=mim_number+asc gives deterministic pagination across pages.
  const url =
    `${OMIM_BASE}/entry/search` +
    `?search=the` +
    `&include=text%3Adescription` +
    `&start=${start}` +
    `&limit=${PAGE_SIZE}` +
    `&sort=mim_number%2Basc` +
    `&apiKey=${encodeURIComponent(apiKey)}` +
    `&format=json`

  const MAX_RETRIES = 5
  let delay = 2000
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.status === 429) {
      if (attempt === MAX_RETRIES) throw new Error(`OMIM rate limit: still 429 after ${MAX_RETRIES} retries`)
      console.warn(`  429 at start=${start}, backing off ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
      continue
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`OMIM search failed: HTTP ${res.status} ${res.statusText}\n${body.slice(0, 500)}`)
    }
    const data = (await res.json()) as OMIMSearchResponse
    return (data.omim?.searchResponse?.entryList ?? []).map(e => e.entry)
  }
  throw new Error('fetchPage: unreachable')
}

function isPhenotype(entry: OMIMEntry): boolean {
  return PHENOTYPE_PREFIXES.has(entry.prefix ?? '')
}

function extractDescription(entry: OMIMEntry): string {
  const section = entry.textSectionList?.[0]?.textSection
  if (!section?.textSectionContent) return ''
  return cleanDescription(section.textSectionContent)
}

// ---- Ingest one entry ------------------------------------------------------

async function ingestEntry(entry: OMIMEntry): Promise<'ingested' | 'skipped' | 'error'> {
  const mim = entry.mimNumber
  const preferredTitle = entry.titles?.preferredTitle?.trim()
  if (!mim || !preferredTitle) return 'skipped'

  const externalId = `omim_${mim}`
  const sourceExternalId = `omim_source_${mim}`

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) return 'skipped'

  const description = extractDescription(entry)
  const descTrunc = description ? truncate(description, DESCRIPTION_LIMIT) : ''
  const claimText = descTrunc
    ? `${preferredTitle} (MIM ${mim}): ${descTrunc}`
    : `${preferredTitle} (MIM ${mim})`

  const sourceName = `${preferredTitle} — OMIM`
  const sourceUrl = `https://omim.org/entry/${mim}`

  try {
    await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name: sourceName,
          url: sourceUrl,
          publishedAt: null,
          methodologyType: 'primary',
          ingestedBy: 'omim_v1',
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
          ingestedBy: 'omim_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId,
          metadata: {
            dataset: 'omim_v1',
            mimNumber: mim,
            prefix: entry.prefix ?? '',
            status: entry.status ?? null,
            domain: 'medicine',
          },
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId: source.id,
          claimId: claim.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: 'omim_v1',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId: edge.id,
          priorScore: null,
          newScore: 100,
          reason: 'OMIM curated phenotype entry — authoritative Mendelian reference',
        },
      })
    }, { timeout: 30000 })

    // Best-effort medicine topic tag (skip silently if topic does not exist)
    try {
      const medicineTopic = await prisma.topic.findUnique({ where: { slug: 'medicine' } })
      if (medicineTopic) {
        const created = await prisma.claim.findUnique({ where: { externalId } })
        if (created) {
          await prisma.claimTopic.upsert({
            where: { claimId_topicId: { claimId: created.id, topicId: medicineTopic.id } },
            update: {},
            create: { claimId: created.id, topicId: medicineTopic.id },
          })
        }
      }
    } catch {
      // best-effort; ignore
    }

    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed MIM ${mim}: ${msg}`)
    return 'error'
  }
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const args = parseArgs()

  const apiKey = process.env.OMIM_API_KEY
  if (!apiKey) {
    console.error(
      '\nERROR: OMIM_API_KEY is not set.\n' +
      '\n' +
      'OMIM requires a free API key for research use.\n' +
      '  1. Register at https://www.omim.org/api\n' +
      '  2. Add to .env.local:    OMIM_API_KEY=your-key-here\n' +
      '  3. Re-run this script.\n',
    )
    process.exit(1)
  }

  console.log(`\n=== OMIM Ingestion ===`)
  console.log(`  mode      : ${args.dryRun ? 'DRY-RUN (no DB writes)' : 'LIVE'}`)
  console.log(`  limit     : ${args.limit ?? '(unbounded — full ~27k phenotypes)'}`)
  console.log(`  page size : ${PAGE_SIZE}`)
  console.log(`  rate      : ${REQ_DELAY_MS}ms / request (~${Math.round(1000 / REQ_DELAY_MS)} req/sec)\n`)

  let start = 0
  let totalFetched = 0
  let phenotypeCandidates = 0
  let ingested = 0
  let skipped = 0
  let errors = 0
  const drySample: Array<{
    mimNumber: number
    prefix: string
    preferredTitle: string
    descriptionPreview: string
    claimText: string
    sourceUrl: string
  }> = []

  for (;;) {
    if (args.limit !== null && ingested >= args.limit && !args.dryRun) break
    if (args.limit !== null && phenotypeCandidates >= args.limit && args.dryRun) break

    let page: OMIMEntry[]
    try {
      page = await fetchPage(apiKey, start)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Page fetch failed at start=${start}: ${msg}`)
      process.exit(1)
    }

    if (page.length === 0) {
      console.log(`No more results at start=${start}. Pagination complete.`)
      break
    }

    totalFetched += page.length

    for (const entry of page) {
      if (!isPhenotype(entry)) continue
      phenotypeCandidates++

      if (args.verbose) {
        console.log(`  [${entry.prefix || ' '}] MIM ${entry.mimNumber} — ${entry.titles?.preferredTitle ?? '(no title)'}`)
      }

      if (args.dryRun) {
        if (drySample.length < 25) {
          const description = extractDescription(entry)
          const descTrunc = truncate(description, DESCRIPTION_LIMIT)
          const preferredTitle = entry.titles?.preferredTitle?.trim() ?? ''
          drySample.push({
            mimNumber: entry.mimNumber,
            prefix: entry.prefix ?? '',
            preferredTitle,
            descriptionPreview: descTrunc,
            claimText: descTrunc
              ? `${preferredTitle} (MIM ${entry.mimNumber}): ${descTrunc}`
              : `${preferredTitle} (MIM ${entry.mimNumber})`,
            sourceUrl: `https://omim.org/entry/${entry.mimNumber}`,
          })
        }
        if (args.limit !== null && phenotypeCandidates >= args.limit) break
        continue
      }

      const outcome = await ingestEntry(entry)
      if (outcome === 'ingested') ingested++
      else if (outcome === 'skipped') skipped++
      else errors++

      if (args.limit !== null && ingested >= args.limit) break
    }

    start += PAGE_SIZE
    await sleep(REQ_DELAY_MS)
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Entries fetched     : ${totalFetched}`)
  console.log(`  Phenotype candidates: ${phenotypeCandidates}`)
  if (args.dryRun) {
    const samplePath = 'omim-dry-run-sample.json'
    writeFileSync(samplePath, JSON.stringify({ candidates: phenotypeCandidates, sample: drySample }, null, 2))
    console.log(`  Dry-run sample      : ${samplePath} (${drySample.length} records)`)
  } else {
    console.log(`  Ingested            : ${ingested}`)
    console.log(`  Skipped (existing)  : ${skipped}`)
    console.log(`  Errors              : ${errors}`)

    // Verify ingester counter against DB state (per CLAUDE.md rule 6)
    const dbCount = await prisma.claim.count({
      where: { ingestedBy: 'omim_v1', deleted: false },
    })
    console.log(`  DB count (omim_v1)  : ${dbCount}`)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
