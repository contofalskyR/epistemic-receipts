// Epistemic receipt enrichment for Freudenberger, "Staff Burn-Out"
// Journal of Social Issues, 1974. DOI 10.1111/j.1540-4560.1974.tb00706.x
// OpenAlex W2157122373. Claim cmpm1wc9n0fq1sadnszup94fl.
//
// Baseline (fromAxis=null -> RECORDED @ 1974-01-01) already exists — NOT duplicated here.
//
// Post-publication arc:
//   RECORDED -> SETTLED (1981-04, EXPERT_LITERATURE)
//     Maslach & Jackson operationalized Freudenberger's clinical "burn-out"
//     concept into a validated, three-dimensional, measurable construct via the
//     Maslach Burnout Inventory ("The measurement of experienced burnout",
//     Journal of Occupational Behavior, 1981). This turned a clinical observation
//     into an empirically established and widely replicated phenomenon, settling
//     the construct in the occupational-health literature.
//
// No retraction / expression of concern exists (Crossref: no update-to, no
// relation flags; no Retraction Watch record). No dated failed-replication or
// reversal document was found.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-freudenberger-staff-burnout-1974.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmpm1wc9n0fq1sadnszup94fl'

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
    community: 'EXPERT_LITERATURE',
    occurredAt: '1981-04-01',
    datePrecision: 'MONTH',
    reason:
      "Christina Maslach and Susan Jackson's 1981 paper 'The measurement of experienced burnout' (Journal of Occupational Behavior) operationalized Freudenberger's clinical burn-out concept into a validated three-dimensional construct — emotional exhaustion, depersonalization, and reduced personal accomplishment — measured by the Maslach Burnout Inventory. The MBI became the field-standard instrument, converting a clinical observation into an empirically established and repeatedly replicated phenomenon and settling the construct in the occupational-health literature.",
    source: {
      externalId: 'src:maslach-jackson-mbi-1981',
      name: 'Maslach C, Jackson SE. The measurement of experienced burnout. Journal of Occupational Behavior. 1981;2(2):99–113.',
      url: 'https://doi.org/10.1002/job.4030020205',
      publishedAt: '1981-04-01',
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
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
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
