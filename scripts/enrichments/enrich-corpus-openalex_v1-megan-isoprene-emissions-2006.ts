// Enrichment: post-publication epistemic trajectory for the MEGAN isoprene
// emissions model paper (Guenther et al. 2006, Atmospheric Chemistry and Physics).
//
// Claim:   cmq2w5owg0113sa8ha5ahdcsw
// DOI:     https://doi.org/10.5194/acp-6-3181-2006
// OpenAlex: W2002570697
//
// Baseline ClaimStatusHistory row (null -> RECORDED @ 2006-08-02) already exists;
// this script does NOT duplicate it. It adds the single verified downstream arc:
// RECORDED -> SETTLED, adjudicated by the MEGAN2.1 extension/update paper
// (Guenther et al. 2012, Geoscientific Model Development), which consolidated
// MEGAN as the community-standard framework for modeling biogenic emissions.
//
// No retraction or expression of concern exists (Crossref update-to: null).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-megan-isoprene-emissions-2006.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-megan-isoprene-emissions-2006.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w5owg0113sa8ha5ahdcsw'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Arc {
  fromAxis: FactStatus | null
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

const ARCS: Arc[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-11-26',
    datePrecision: 'DAY',
    reason:
      'The MEGAN framework introduced in the 2006 paper became the de facto community standard for estimating biogenic volatile organic compound (VOC) emissions in earth system and air-quality models. In November 2012 Guenther and colleagues published MEGAN2.1 in Geoscientific Model Development, an "extended and updated framework" that broadened the model beyond isoprene to a wider suite of compounds and canopy processes while retaining the original architecture. Rather than overturning the 2006 results, this successor paper consolidated and vindicated the approach, marking its adoption as the standard biogenic-emissions module embedded in models such as CLM/CESM, WRF-Chem and GEOS-Chem.',
    source: {
      externalId: 'src:megan21-guenther-2012-gmd',
      name: 'Guenther et al. (2012), "The Model of Emissions of Gases and Aerosols from Nature version 2.1 (MEGAN2.1): an extended and updated framework for modeling biogenic emissions," Geoscientific Model Development 5, 1471–1492.',
      url: 'https://doi.org/10.5194/gmd-5-1471-2012',
      publishedAt: '2012-11-26',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const arc of ARCS) {
    const slug = `${CLAIM_ID}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `  would upsert source ${arc.source.externalId} + history ${slug} (${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt})`,
      )
      continue
    }

    // 1) Source (marker artifact) first, so we can link it.
    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-megan-isoprene-emissions-2006',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
      },
    })

    // 2) ClaimStatusHistory row keyed on the deterministic slug id.
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`  upserted ${slug} (${arc.fromAxis} -> ${arc.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
