// Enrichment: post-publication epistemic trajectory for the EULAR 2016 RA
// management recommendations (claim cmply533j00hxsaihhix72zgj).
//
// Baseline row (fromAxis=null -> RECORDED at 2017-03-06) already exists; this
// script adds only the post-publication transition.
//
// Arc added: RECORDED -> SETTLED. The 2016 recommendations were the successor to
// EULAR's 2013 guidance and established the treat-to-target strategy, methotrexate
// as the anchor first-line DMARD, and a phased synthetic/biological DMARD sequence
// as the European consensus. The same EULAR task force (Smolen et al.) issued a
// 2019 update (published online 22 Jan 2020, Ann Rheum Dis) that reviewed new
// efficacy/safety evidence and carried the 2016 framework forward — reaffirming
// treat-to-target and MTX-anchored first-line therapy rather than overturning them.
// A successor institutional guideline endorsing the framework is a settling event
// (community INSTITUTIONAL).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-eular-ra-management-2016.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-eular-ra-management-2016.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply533j00hxsaihhix72zgj'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-01-22',
    datePrecision: 'DAY',
    reason:
      'The EULAR task force (Smolen et al.) published the 2019 update of these recommendations online in Annals of the Rheumatic Diseases on 22 January 2020. Reviewing new efficacy and safety evidence, the update carried forward the 2016 framework — treat-to-target, methotrexate as the anchor first-line DMARD, and the phased synthetic/biological DMARD strategy — reaffirming rather than overturning the 2016 consensus, which settles the framework as durable European institutional guidance.',
    source: {
      externalId: 'src:eular-ra-management-2019-update',
      name: 'Smolen JS, et al. EULAR recommendations for the management of rheumatoid arthritis with synthetic and biological disease-modifying antirheumatic drugs: 2019 update. Ann Rheum Dis 2020;79(6):685–699. DOI:10.1136/annrheumdis-2019-216655. PMID 31969328.',
      url: 'https://doi.org/10.1136/annrheumdis-2019-216655',
      publishedAt: '2020-01-22',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
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
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
