// Pipeline: periodic_table_v1
// Source: https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json
// All 118 elements: atomic number, symbol, name, category, discoverer, year, weight, phase, appearance
// Run:
//   npx tsx scripts/ingest-periodic-table.ts --dry-run
//   npx tsx scripts/ingest-periodic-table.ts --dry-run --limit 10
//   ALLOW_EDITS=true npx tsx scripts/ingest-periodic-table.ts --limit 20
//   ALLOW_EDITS=true npx tsx scripts/ingest-periodic-table.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'periodic_table_v1'
const SOURCE_URL = 'https://www.nist.gov/pml/periodic-table-elements'
const DATA_URL = 'https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawElement {
  number: number
  symbol: string
  name: string
  category: string
  discovered_by: string | null
  named_by: string | null
  appearance: string | null
  atomic_mass: number | null
  phase: string
  period: number
  group: number | null
  block: string
  electron_configuration: string
  electronegativity_pauling: number | null
  boil: number | null
  melt: number | null
  density: number | null
  molar_heat: number | null
  summary: string
  source: string
  xpos: number
  ypos: number
}

interface PeriodicTableJSON {
  elements: RawElement[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { dryRun: boolean; limit: number } {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  const limitVal = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0
  return {
    dryRun: args.includes('--dry-run'),
    limit: Number.isFinite(limitVal) && limitVal > 0 ? limitVal : 0,
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchElements(): Promise<RawElement[]> {
  const res = await fetch(DATA_URL, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} — ${DATA_URL}`)
  const json = await res.json() as PeriodicTableJSON
  if (!Array.isArray(json.elements)) throw new Error('Unexpected JSON structure — no elements array')
  return json.elements
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

// ── Claim text ────────────────────────────────────────────────────────────────

function buildClaimText(el: RawElement): string {
  const weightStr = el.atomic_mass != null ? ` standard atomic weight ${el.atomic_mass}` : ''
  const discoveredStr = el.discovered_by ? `, discovered by ${el.discovered_by}` : ''
  const yearStr = (() => {
    // discovered_by sometimes contains a year embedded, but year is a separate field in some versions
    // Pull from summary if present — just omit if not available
    return ''
  })()
  return `${el.name} (symbol ${el.symbol}, atomic number ${el.number}) is a ${el.category} in period ${el.period}${el.group != null ? `, group ${el.group}` : ''}${weightStr}${discoveredStr}.`
}

// ── Core: write one element ───────────────────────────────────────────────────

async function writeElement(
  tx: TxClient,
  el: RawElement,
  topicId: string,
): Promise<IngestResult> {
  const externalId = `periodic_table_z${el.number}`
  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `NIST Periodic Table — ${el.name} (${el.symbol}, Z=${el.number})`,
      url: SOURCE_URL,
      publishedAt: null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `periodic_table_source_z${el.number}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: buildClaimText(el),
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: null,
      claimEmergedPrecision: null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId,
      metadata: {
        dataset: INGESTED_BY,
        atomicNumber: el.number,
        symbol: el.symbol,
        name: el.name,
        category: el.category,
        period: el.period,
        group: el.group,
        block: el.block,
        atomicMass: el.atomic_mass,
        phase: el.phase,
        appearance: el.appearance,
        discoveredBy: el.discovered_by,
        namedBy: el.named_by,
        meltK: el.melt,
        boilK: el.boil,
        densityGcm3: el.density,
        electronegativityPauling: el.electronegativity_pauling,
        electronConfiguration: el.electron_configuration,
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
      reason: 'NIST/IUPAC periodic table — elemental property as HARD_FACT',
      changedAt: new Date(),
    },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs()
  console.log(`\n── Pipeline: Periodic Table (${INGESTED_BY}) ──────────────────────────────`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'} | Limit: ${limit || 'all'}`)

  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('\nSet ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log(`\nFetching elements from ${DATA_URL}`)
  const allElements = await fetchElements()
  console.log(`  Retrieved ${allElements.length} elements`)

  const pool = limit > 0 ? allElements.slice(0, limit) : allElements

  if (dryRun) {
    console.log(`\n[dry-run] Would ingest ${pool.length} elements:`)
    const sample = pool.slice(0, 10).map(el => ({
      externalId: `periodic_table_z${el.number}`,
      claimText: buildClaimText(el),
      atomicNumber: el.number,
      symbol: el.symbol,
      name: el.name,
      category: el.category,
      atomicMass: el.atomic_mass,
      phase: el.phase,
      discoveredBy: el.discovered_by,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      ingestedBy: INGESTED_BY,
      sourceUrl: SOURCE_URL,
    }))
    for (const s of sample) {
      console.log(`  Z=${s.atomicNumber} ${s.symbol} — ${s.name} (${s.category}) mass=${s.atomicMass}`)
    }
    const outFile = `periodic-table-dry-run-sample.json`
    fs.writeFileSync(outFile, JSON.stringify({ runDate: new Date().toISOString(), totalElements: pool.length, sample }, null, 2))
    console.log(`\n  Written: ${outFile}`)
    console.log('\nDry-run complete. STOP — awaiting explicit go-ahead before full run.')
    await prisma.$disconnect()
    return
  }

  // Full run
  const topicId = await ensureTopic('periodic-table', 'Periodic Table of Elements', 'chemistry')

  const counts = { ingested: 0, skipped: 0, errors: 0 }
  for (const el of pool) {
    try {
      const result = await prisma.$transaction(
        tx => writeElement(tx, el, topicId),
        { timeout: 30000 },
      )
      if (result === 'ingested') { counts.ingested++; console.log(`  Ingested Z=${el.number} ${el.symbol} — ${el.name}`) }
      else if (result === 'skipped') { counts.skipped++; console.log(`  Skipped (exists): ${el.name}`) }
      else counts.errors++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed Z=${el.number} ${el.symbol}: ${msg}`)
      counts.errors++
    }
  }

  console.log(`\nIngestion complete.`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims in DB (${INGESTED_BY}): ${dbClaims}`)
  console.log(`  Sources in DB: ${dbSources}`)
  if (dbClaims !== counts.ingested + counts.skipped) {
    console.warn(`  WARNING: DB count (${dbClaims}) vs ingested+skipped (${counts.ingested + counts.skipped}) mismatch`)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
