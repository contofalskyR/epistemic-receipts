// RxNorm ingredient ingestion — NLM canonical drug naming database
// Source: RxNav REST API (https://rxnav.nlm.nih.gov/REST/) — free, no API key
// Scope: every concept of TTY=IN (Ingredient) — the canonical normalized form
// Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.html
//
// Run:
//   Dry-run (no writes, default):     npx tsx scripts/ingest-rxnorm.ts --dry-run
//   Sample 10:                        ALLOW_EDITS=true npx tsx scripts/ingest-rxnorm.ts --sample 10
//   Full production run:              ALLOW_EDITS=true npx tsx scripts/ingest-rxnorm.ts --full
//   Bounded full:                     ALLOW_EDITS=true npx tsx scripts/ingest-rxnorm.ts --full --limit 1000

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST'
const INGESTED_BY = 'rxnorm_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RxNormConcept {
  rxcui: string
  name: string
  synonym?: string
  tty: string
  language?: string
  suppress?: string
  umlscui?: string
}

interface AllConceptsResponse {
  minConceptGroup?: {
    minConcept?: RxNormConcept[]
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

interface Args {
  dryRun: boolean
  full: boolean
  sample: number
  limit: number
  verbose: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const hasFlag = (name: string) => args.includes(name)
  const numArg = (name: string, def = 0): number => {
    const idx = args.indexOf(name)
    if (idx === -1 || !args[idx + 1]) return def
    const n = parseInt(args[idx + 1], 10)
    return isNaN(n) || n < 0 ? def : n
  }
  return {
    dryRun: hasFlag('--dry-run'),
    full: hasFlag('--full'),
    sample: numArg('--sample', 0),
    limit: numArg('--limit', 0),
    verbose: hasFlag('--verbose'),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchAllIngredients(): Promise<RxNormConcept[]> {
  const url = `${RXNAV_BASE}/allconcepts.json?tty=IN`
  console.log(`Fetching: ${url}`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`RxNav fetch failed: ${res.status} ${res.statusText}\n${body.slice(0, 500)}`)
  }
  const data = (await res.json()) as AllConceptsResponse
  const concepts = data.minConceptGroup?.minConcept ?? []
  console.log(`Server returned ${concepts.length} TTY=IN concept(s)`)
  return concepts
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    if (parentSlug && !existing.parentTopicId) {
      const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
      if (parent) {
        await prisma.topic.update({ where: { id: existing.id }, data: { parentTopicId: parent.id } })
      }
    }
    topicCache.set(slug, existing.id)
    return existing.id
  }
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()

  // Default to dry-run if no mode flag passed — prevents accidental writes
  const noModeFlag = !args.dryRun && !args.full && args.sample === 0
  if (noModeFlag) args.dryRun = true

  const mode = args.dryRun
    ? 'DRY-RUN'
    : args.full
      ? 'FULL'
      : `SAMPLE ${args.sample}`

  console.log(`\n=== RxNorm Drug Ingredient Ingestion (${INGESTED_BY}) ===`)
  console.log(`Mode: ${mode}`)
  if (args.limit > 0) console.log(`Limit: ${args.limit}`)
  console.log('')

  if (!args.dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('ERROR: sample/full modes require ALLOW_EDITS=true')
    process.exit(1)
  }

  const rawConcepts = await fetchAllIngredients()

  // Defensive dedupe + filter — every concept must have rxcui + name
  const seen = new Set<string>()
  const concepts = rawConcepts.filter(c => {
    if (!c.rxcui || !c.name) return false
    if (seen.has(c.rxcui)) return false
    seen.add(c.rxcui)
    return true
  })
  if (concepts.length !== rawConcepts.length) {
    console.log(`  Filtered ${rawConcepts.length - concepts.length} duplicate/malformed row(s)`)
  }

  let target = concepts
  if (args.sample > 0) target = target.slice(0, args.sample)
  if (args.limit > 0) target = target.slice(0, args.limit)

  console.log(`Candidates: ${target.length}\n`)

  if (args.dryRun) {
    const sampleOut = target.slice(0, 15).map(c => ({
      rxcui: c.rxcui,
      name: c.name,
      tty: c.tty,
      ...(c.umlscui ? { umlscui: c.umlscui } : {}),
    }))
    console.log(JSON.stringify({ candidates: target.length, sample: sampleOut }, null, 2))
    await prisma.$disconnect()
    return
  }

  // Pre-create topics (medicine domain)
  const pharmacologyTopicId = await ensureTopic('pharmacology', 'Pharmacology', 'medicine')
  const rxnormTopicId = await ensureTopic(
    'rxnorm-drugs',
    'RxNorm Drug Ingredients',
    'medicine',
    'pharmacology',
  )

  let ingested = 0
  let skipped = 0
  let errors = 0
  const startedAt = Date.now()

  for (let i = 0; i < target.length; i++) {
    const c = target[i]
    const externalId = `rxnorm_rxcui_${c.rxcui}`
    const sourceExternalId = `rxnorm_source_${c.rxcui}`

    // 60 ms politeness delay — keeps overall throughput under RxNav's 20 req/sec
    // ceiling if future revisions add per-record API enrichment.
    await sleep(60)

    const existing = await prisma.claim.findUnique({ where: { externalId } })
    if (existing) {
      skipped++
      if (args.verbose) console.log(`  Skipped (exists): RxCUI ${c.rxcui} — ${c.name}`)
      if ((i + 1) % 500 === 0) {
        console.log(`  Progress: ${i + 1}/${target.length} — ingested ${ingested}, skipped ${skipped}, errors ${errors}`)
      }
      continue
    }

    const claimText = `RxNorm drug: ${c.name} (RxCUI: ${c.rxcui})`
    const sourceName = `${c.name} — RxNorm`
    const sourceUrl = `${RXNAV_BASE}/rxcui/${c.rxcui}/properties.json`

    try {
      await prisma.$transaction(
        async tx => {
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
                rxcui: c.rxcui,
                tty: c.tty,
                name: c.name,
                ...(c.umlscui ? { umlscui: c.umlscui } : {}),
                ...(c.synonym ? { synonym: c.synonym } : {}),
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
              newScore: 100,
              reason: 'RxNorm canonical drug naming — NLM primary authority for US drug nomenclature',
            },
          })
        },
        { timeout: 30000 },
      )

      const created = await prisma.claim.findUnique({ where: { externalId } })
      if (created) {
        for (const topicId of [pharmacologyTopicId, rxnormTopicId]) {
          await prisma.claimTopic.upsert({
            where: { claimId_topicId: { claimId: created.id, topicId } },
            update: {},
            create: { claimId: created.id, topicId },
          })
        }
      }

      ingested++
      if (args.verbose) console.log(`  Ingested: RxCUI ${c.rxcui} — ${c.name}`)
    } catch (err) {
      errors++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: RxCUI ${c.rxcui} — ${msg}`)
    }

    if ((i + 1) % 500 === 0) {
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
      console.log(`  Progress: ${i + 1}/${target.length} — ingested ${ingested}, skipped ${skipped}, errors ${errors} (elapsed ${elapsedSec}s)`)
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${ingested}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Errors   : ${errors}`)
  console.log(`  Total    : ${target.length}`)
  console.log(`  Elapsed  : ${elapsedSec}s\n`)

  // Independent DB verification per CLAUDE.md rule 6
  const dbCount = await prisma.claim.count({
    where: { ingestedBy: INGESTED_BY, deleted: false },
  })
  console.log(`  DB claim count (ingestedBy=${INGESTED_BY}, deleted=false): ${dbCount}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
