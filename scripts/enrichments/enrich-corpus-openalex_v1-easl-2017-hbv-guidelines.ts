// Epistemic-receipt enrichment for claim cmplyat8d039lsaihdstfz6aa
// "EASL 2017 Clinical Practice Guidelines on the management of hepatitis B virus infection"
// (J Hepatol 2017;67(2):370–398, DOI 10.1016/j.jhep.2017.03.021, OpenAlex W2605785536)
//
// Baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at 2017-04-18) already exists.
// This script adds the post-publication arc only.
//
// Post-publication event (verified 2026-07-16):
//   The 2017 CPG served as EASL's authoritative European standard of care for HBV management
//   for eight years. In May 2025 the EASL panel (chaired by Markus Cornberg) formally UPDATED
//   the guideline — "EASL Clinical Practice Guidelines on the management of hepatitis B virus
//   infection" (J Hepatol 2025;83(2):502–583, DOI 10.1016/j.jhep.2025.03.018). The 2025 edition
//   builds directly on and carries forward the 2017 framework (diagnosis, treatment indications,
//   antiviral options, HCC surveillance, reactivation prophylaxis) while refining thresholds —
//   an institutional continuation/ratification of the guideline as field consensus, not a reversal.
//   => RECORDED -> SETTLED, community INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-easl-2017-hbv-guidelines.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-easl-2017-hbv-guidelines.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplyat8d039lsaihdstfz6aa'

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
    community: 'INSTITUTIONAL',
    occurredAt: '2025-05-09',
    datePrecision: 'MONTH',
    reason:
      'In May 2025 EASL formally updated the guideline — "EASL Clinical Practice Guidelines on the management of hepatitis B virus infection" (J Hepatol 2025;83(2):502–583), chaired by Markus Cornberg. The 2025 edition carries forward the 2017 framework (diagnosis, treatment indications, antiviral options, HCC surveillance, reactivation prophylaxis) while refining viral-load and fibrosis thresholds. The eight-year tenure as the European standard of care followed by a formal EASL update — rather than any retraction or reversal — ratifies the guideline as settled institutional consensus for HBV management.',
    source: {
      externalId: 'src:easl-hbv-cpg-2025-update',
      name: 'European Association for the Study of the Liver. EASL Clinical Practice Guidelines on the management of hepatitis B virus infection. J Hepatol 2025;83(2):502–583.',
      url: 'https://doi.org/10.1016/j.jhep.2025.03.018',
      publishedAt: '2025-05-09',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const arc of ARCS) {
    const slug = `${claimId}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt} (${arc.community})`)
      console.log(`[dry-run]   source: ${arc.source.externalId} ${arc.source.url}`)
      console.log(`[dry-run]   history id: ${slug}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-easl-2017-hbv-guidelines',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: arc.fromAxis ?? undefined,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis ?? undefined,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
