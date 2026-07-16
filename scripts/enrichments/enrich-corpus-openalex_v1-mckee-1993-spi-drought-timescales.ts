// Epistemic-receipt enrichment: post-publication trajectory for
// McKee, Doesken & Kleist (1993), "The Relationship of Drought Frequency and
// Duration to Time Scales", Proc. 8th Conf. on Applied Climatology (Anaheim,
// CA), 179–184 — the paper that introduced the Standardized Precipitation
// Index (SPI). No DOI. OpenAlex: W2153179024. Claim id: cmq2w4v5t00j9sa8hp8fi0avl.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1993-01-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2011-04, INSTITUTIONAL)
//     The "Lincoln Declaration on Drought Indices" (Bull. Amer. Meteor. Soc.
//     92(4):485–488, DOI 10.1175/2010BAMS3103.1) records the consensus of drought
//     experts from all six WMO regions — reached at the WMO Inter-Regional
//     Workshop, Lincoln, Nebraska, Dec 2009 — that the SPI (McKee et al. 1993)
//     be used to characterize meteorological drought by all National
//     Meteorological and Hydrological Services worldwide. The Sixteenth World
//     Meteorological Congress (June 2011) adopted a resolution endorsing this,
//     and the WMO codified SPI in its "Standardized Precipitation Index User
//     Guide" (WMO-No. 1090, 2012). This is a field-consensus settling of the
//     finding, not a mere citation count.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mckee-1993-spi-drought-timescales.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4v5t00j9sa8hp8fi0avl'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
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
    occurredAt: '2011-04-01',
    datePrecision: 'MONTH',
    reason:
      'The "Lincoln Declaration on Drought Indices" (Bull. Amer. Meteor. Soc. 92(4):485–488) formalized the consensus of drought experts from all six WMO regions — reached at the WMO Inter-Regional Workshop in Lincoln, Nebraska, December 2009 — recommending that the Standardized Precipitation Index (SPI), introduced by McKee et al. 1993, be used to characterize meteorological drought by all National Meteorological and Hydrological Services worldwide. The Sixteenth World Meteorological Congress endorsed the recommendation by resolution in June 2011, and the WMO subsequently codified the method in its "Standardized Precipitation Index User Guide" (WMO-No. 1090, 2012). This marks the institutional settling of the SPI as the world-standard meteorological drought index.',
    source: {
      externalId: 'src:lincoln-declaration-drought-indices-2011',
      name: 'Hayes M, Svoboda M, Wall N, Widhalm M. The Lincoln Declaration on Drought Indices: Universal Meteorological Drought Index Recommended. Bulletin of the American Meteorological Society 2011;92(4):485–488. DOI:10.1175/2010BAMS3103.1',
      url: 'https://digitalcommons.unl.edu/droughtfacpub/14/',
      publishedAt: '2011-04-01',
      methodologyType: 'derivative',
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
        ingestedBy: 'enrich:corpus-openalex_v1',
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

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
