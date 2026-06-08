// Backfill epistemicStatus on existing claims from pipeline-native data.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-epistemic-status.ts
// Run (write): ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-epistemic-status.ts

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.env.ALLOW_EDITS !== 'true'
const BATCH = 2000

interface BackfillRule {
  ingestedBy: string | string[]
  status: string
  description: string
}

const SIMPLE_RULES: BackfillRule[] = [
  { ingestedBy: ['crossref_retractions_v1', 'retraction_watch_v1'], status: 'retracted',          description: 'Retracted papers' },
  { ingestedBy: 'nasa_exoplanet_v1',                                  status: 'confirmed',          description: 'Confirmed exoplanets (NASA archive)' },
  { ingestedBy: 'clinicaltrials_v1',                                  status: 'registered_trial',   description: 'ClinicalTrials.gov registrations' },
  { ingestedBy: 'drugsatfda_v1',                                      status: 'approved',           description: 'FDA-approved drugs' },
  { ingestedBy: 'fda_aesthetic_devices_v1',                           status: 'approved',           description: 'FDA-approved aesthetic devices' },
  { ingestedBy: 'openfda_labels_v1',                                  status: 'approved',           description: 'FDA drug labels (approved products)' },
  { ingestedBy: 'openfda_v1',                                         status: 'approved',           description: 'openFDA (approved)' },
  { ingestedBy: 'nobel_v1',                                           status: 'confirmed',          description: 'Nobel Prize laureates' },
  { ingestedBy: 'wikidata_nobel_v1',                                  status: 'confirmed',          description: 'Nobel Prize laureates (Wikidata)' },
  { ingestedBy: 'omim_v1',                                            status: 'established',        description: 'OMIM disease/phenotype entries' },
  { ingestedBy: 'icd11_v1',                                           status: 'established',        description: 'WHO ICD-11 disease classifications' },
  { ingestedBy: 'periodic_table_v1',                                  status: 'confirmed',          description: 'Chemical elements (IUPAC)' },
  { ingestedBy: 'wikidata_elements_v1',                               status: 'confirmed',          description: 'Chemical elements (Wikidata)' },
]

// ECHR: check conclusion for dissent keywords
async function backfillEchr(): Promise<{ contested: number; settled: number }> {
  let contested = 0, settled = 0
  let cursor: string | null = null

  // echr_v1 has 'conclusion' in metadata; echr_judgments_v1 does not (minimal metadata)
  // For echr_judgments_v1 we just use 'settled_judgment' as default
  if (!DRY_RUN) {
    const judsUpdated = await prisma.claim.updateMany({
      where: { ingestedBy: 'echr_judgments_v1', epistemicStatus: null },
      data: { epistemicStatus: 'settled_judgment' },
    })
    settled += judsUpdated.count
  } else {
    settled += await prisma.claim.count({ where: { ingestedBy: 'echr_judgments_v1', epistemicStatus: null } })
  }

  // echr_v1: check conclusion field
  while (true) {
    const claims: { id: string; metadata: Prisma.JsonValue }[] = await prisma.claim.findMany({
      where: { ingestedBy: 'echr_v1', epistemicStatus: null },
      select: { id: true, metadata: true },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    })
    if (claims.length === 0) break
    cursor = claims[claims.length - 1]!.id

    const contestedIds: string[] = []
    const settledIds: string[] = []

    for (const c of claims) {
      const meta = c.metadata as Record<string, unknown> | null
      const conclusion = typeof meta?.conclusion === 'string' ? meta.conclusion.toLowerCase() : ''
      const isDissent = conclusion.includes('dissent') || conclusion.includes('separate opinion') || conclusion.includes('partly')
      if (isDissent) contestedIds.push(c.id)
      else settledIds.push(c.id)
    }

    if (!DRY_RUN) {
      if (contestedIds.length) await prisma.claim.updateMany({ where: { id: { in: contestedIds } }, data: { epistemicStatus: 'contested_dissent' } })
      if (settledIds.length) await prisma.claim.updateMany({ where: { id: { in: settledIds } }, data: { epistemicStatus: 'settled_judgment' } })
    }
    contested += contestedIds.length
    settled += settledIds.length
  }

  return { contested, settled }
}

async function applySimpleRule(rule: BackfillRule): Promise<number> {
  const tags = Array.isArray(rule.ingestedBy) ? rule.ingestedBy : [rule.ingestedBy]
  if (DRY_RUN) {
    return prisma.claim.count({ where: { ingestedBy: { in: tags }, epistemicStatus: null } })
  }
  const result = await prisma.claim.updateMany({
    where: { ingestedBy: { in: tags }, epistemicStatus: null },
    data: { epistemicStatus: rule.status },
  })
  return result.count
}

async function main() {
  console.log(`Backfill epistemicStatus — ${DRY_RUN ? 'DRY RUN' : 'LIVE WRITE'}`)
  console.log()

  const counts: Record<string, number> = {}

  for (const rule of SIMPLE_RULES) {
    const n = await applySimpleRule(rule)
    const status = rule.status
    counts[status] = (counts[status] ?? 0) + n
    const tags = Array.isArray(rule.ingestedBy) ? rule.ingestedBy.join(', ') : rule.ingestedBy
    console.log(`  ${status.padEnd(20)} ${String(n).padStart(6)}  ← ${tags}`)
  }

  const { contested, settled } = await backfillEchr()
  counts.contested_dissent = (counts.contested_dissent ?? 0) + contested
  counts.settled_judgment = (counts.settled_judgment ?? 0) + settled
  console.log(`  ${'contested_dissent'.padEnd(20)} ${String(contested).padStart(6)}  ← echr_v1`)
  console.log(`  ${'settled_judgment'.padEnd(20)} ${String(settled).padStart(6)}  ← echr_v1 + echr_judgments_v1`)

  console.log()
  console.log('── Summary ──')
  let total = 0
  for (const [status, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(22)} ${n}`)
    total += n
  }
  console.log(`  ${'TOTAL'.padEnd(22)} ${total}`)

  if (DRY_RUN) {
    console.log()
    console.log('Dry run complete. Set ALLOW_EDITS=true to write.')
  }

  // Post-run verification
  if (!DRY_RUN) {
    console.log()
    console.log('── DB verification ──')
    const dbCounts = await prisma.claim.groupBy({
      by: ['epistemicStatus'],
      _count: { epistemicStatus: true },
      where: { epistemicStatus: { not: null } },
      orderBy: { epistemicStatus: 'asc' },
    })
    for (const row of dbCounts) {
      console.log(`  ${String(row.epistemicStatus).padEnd(22)} ${row._count.epistemicStatus}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
