// Epistemic-receipt enrichment for the SPEI drought index paper.
//
// Claim: Vicente-Serrano, Beguería & López-Moreno (2010, online 2009-11-19),
// "A Multiscalar Drought Index Sensitive to Global Warming: The Standardized
// Precipitation Evapotranspiration Index (SPEI)," Journal of Climate.
// DOI 10.1175/2009jcli2909.1 · OpenAlex W2077968790.
//
// Baseline row (fromAxis=null -> RECORDED at 2009-11-19) already exists; not duplicated.
// This script adds the post-publication arc:
//   RECORDED -> CONTESTED  (Sheffield, Wood & Roderick 2012, Nature)
//   CONTESTED -> SETTLED   (Beguería, Vicente-Serrano, Reig & Latorre 2014, "SPEI revisited")
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-spei-drought-index.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4nt800ersa8hd44u6x9g'

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
  // ── RECORDED -> CONTESTED: temperature-based PET critique ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-11-01',
    datePrecision: 'MONTH',
    reason:
      "Sheffield, Wood & Roderick (Nature, Nov 2012) argued that the apparent late-20th-century increase in global drought was largely an artifact of temperature-driven potential-evapotranspiration estimates (Thornthwaite), which overstate atmospheric water demand under warming. Because the original SPEI derives its climatic water balance from exactly this temperature-based PET, the paper directly challenged the index's headline advantage — its claimed 'capacity to include the effects of temperature variability on drought assessment' — opening an active methodological contest over the temperature sensitivity of the index.",
    source: {
      externalId: 'src:sheffield-2012-nature-drought',
      name: 'Sheffield J, Wood EF, Roderick ML. Little change in global drought over the past 60 years. Nature 2012;491(7424):435–438.',
      url: 'https://doi.org/10.1038/nature11575',
      publishedAt: '2012-11-01',
      methodologyType: 'primary',
    },
  },
  // ── CONTESTED -> SETTLED: SPEI revisited resolves the PET-model critique ──
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-08-01',
    datePrecision: 'MONTH',
    reason:
      "Beguería, Vicente-Serrano, Reig & Latorre (International Journal of Climatology, Aug 2014) revisited the SPEI in direct response to the PET-model debate, showing the index is robust when reference evapotranspiration is computed with the physically based Penman–Monteith (FAO-56) method rather than temperature-only Thornthwaite, and releasing the validated global SPEIbase dataset plus operational monitoring tools. This resolved the methodological objection and re-established the SPEI as a standard, widely adopted multiscalar drought-monitoring index in the climate literature.",
    source: {
      externalId: 'src:begueria-2014-spei-revisited',
      name: 'Beguería S, Vicente-Serrano SM, Reig F, Latorre B. Standardized precipitation evapotranspiration index (SPEI) revisited: parameter fitting, evapotranspiration models, tools, datasets and drought monitoring. International Journal of Climatology 2014;34(10):3001–3023.',
      url: 'https://doi.org/10.1002/joc.3887',
      publishedAt: '2014-08-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-spei-drought-index',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done: 2 transitions upserted for SPEI claim.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
