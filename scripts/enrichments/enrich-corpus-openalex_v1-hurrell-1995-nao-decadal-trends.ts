// Enrichment: post-publication epistemic trajectory for
// Hurrell (1995), "Decadal Trends in the North Atlantic Oscillation:
// Regional Temperatures and Precipitation," Science 269(5224):676–679.
// DOI: 10.1126/science.269.5224.676 | OpenAlex: W2131477567
//
// Baseline RECORDED (fromAxis=null -> RECORDED, 1995-08-04) already exists;
// this script only adds the follow-up transition.
//
// Verified event: the finding — that the North Atlantic Oscillation is a
// major mode of North Atlantic decadal climate variability governing
// wintertime European temperature and precipitation — was consolidated as
// established science by the AGU Geophysical Monograph 134 (2003), the
// field's standard reference review. This is a field-consensus / review
// adjudication (RECORDED -> SETTLED), community EXPERT_LITERATURE.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hurrell-1995-nao-decadal-trends.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hurrell-1995-nao-decadal-trends.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmq2w4syy00hxsa8hrfi6lrg1'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED'
  | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2003-01-01',
    datePrecision: 'YEAR',
    reason:
      'The American Geophysical Union published Geophysical Monograph 134, "The North Atlantic Oscillation: Climatic Significance and Environmental Impact" (2003), whose lead overview chapter by Hurrell, Kushnir, Ottersen & Visbeck consolidated the field around the NAO as the dominant mode of wintertime North Atlantic climate variability governing European temperature and precipitation — the finding advanced in Hurrell 1995. The monograph became the standard reference review of NAO science, marking the finding as settled expert consensus rather than a single-paper result.',
    source: {
      externalId: 'src:nao-agu-monograph-134-overview-2003',
      name: 'Hurrell, Kushnir, Ottersen & Visbeck (2003), "An overview of the North Atlantic Oscillation," in Geophysical Monograph 134: The North Atlantic Oscillation: Climatic Significance and Environmental Impact (American Geophysical Union). Field-consolidating review of NAO science.',
      url: 'https://doi.org/10.1029/134GM01',
      publishedAt: '2003-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${claimId} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  for (const tr of TRANSITIONS) {
    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug} — ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({
        data: { claimId, sourceId: source.id, type: 'FOR' },
      })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
