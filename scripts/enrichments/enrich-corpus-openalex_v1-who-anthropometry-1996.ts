// Enrichment: post-publication epistemic trajectory for the WHO Expert Committee
// report "Physical status: the use and interpretation of anthropometry"
// (WHO Technical Report Series 854, 1995; AJHB review record 1996).
//
// Claim: cmplzuxsb02uvsa865ikw6wus
// DOI:   10.1002/(sici)1520-6300(1996)8:6<786::aid-ajhb11>3.0.co;2-i
// OpenAlex: W2134099620
//
// Baseline row (fromAxis=null -> RECORDED at 1996-01-01) already exists; do NOT
// duplicate it. This script adds the single verified downstream transition.
//
// Arc:
//   RECORDED -> SETTLED (2006-04, INSTITUTIONAL)
//     The 1995 Expert Committee report concluded that anthropometry should be the
//     standard tool for assessing growth and nutritional status and explicitly
//     recommended constructing a new international growth reference to replace the
//     deficient NCHS/WHO reference. In April 2006 WHO released the Child Growth
//     Standards (the product of the Multicentre Growth Reference Study), fulfilling
//     that recommendation and institutionalizing anthropometry as the global
//     standard for under-five growth assessment — endorsed by IPA, IUNS, the UN
//     Standing Committee on Nutrition, and adopted by member states.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-who-anthropometry-1996.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-who-anthropometry-1996.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzuxsb02uvsa865ikw6wus'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
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
    occurredAt: '2006-04-01',
    datePrecision: 'MONTH',
    reason:
      'The 1995 WHO Expert Committee report recommended anthropometry as the standard tool for assessing growth and nutritional status and called for a new international growth reference to replace the deficient NCHS/WHO reference. In April 2006 WHO released the Child Growth Standards (product of the Multicentre Growth Reference Study), directly fulfilling that recommendation. The standards became the global institutional standard for under-five growth assessment, endorsed by the International Pediatric Association, IUNS, and the UN Standing Committee on Nutrition and adopted by member states.',
    source: {
      externalId: 'src:who-child-growth-standards-2006',
      name: 'WHO Multicentre Growth Reference Study Group (de Onis M, et al.). WHO Child Growth Standards based on length/height, weight and age. Acta Paediatrica 2006;95(S450):76–85.',
      url: 'https://doi.org/10.1111/j.1651-2227.2006.tb02378.x',
      publishedAt: '2006-04-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry] ${slug}  ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
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
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
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
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${slug}  ${tr.fromAxis} -> ${tr.toAxis} (${tr.community})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
