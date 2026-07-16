// Enrichment: epistemic trajectory for Yager (1988) OWA operators paper.
//
// Claim: cmq2w4xmi00krsa8h486h9oyx
// Paper: Yager RR. "On ordered weighted averaging aggregation operators in
//        multicriteria decisionmaking." IEEE Trans. Systems, Man, and
//        Cybernetics 18(1):183-190, 1988. DOI 10.1109/21.87068. OpenAlex W2060907774.
//
// The baseline row (fromAxis=null -> RECORDED at the 1988 publication date)
// already exists and is NOT recreated here.
//
// Post-publication arc: the OWA operator was not retracted, replicated, or
// contested (its boundedness between the AND/min and OR/max operators is a
// definitional property). It instead consolidated into an established
// aggregation framework. The field-consensus settlement is marked by the 1997
// Springer/Kluwer edited volume devoted entirely to the operator.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-yager-1988-owa-operators-multicriteria.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-yager-1988-owa-operators-multicriteria.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w4xmi00krsa8h486h9oyx'

interface Transition {
  fromAxis: 'RECORDED'
  toAxis: 'SETTLED'
  community: 'EXPERT_LITERATURE'
  occurredAt: string
  datePrecision: 'YEAR'
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
    occurredAt: '1997-01-01',
    datePrecision: 'YEAR',
    reason:
      'Nine years after Yager introduced the OWA operator, the field consolidated it as an established aggregation framework in a dedicated Springer/Kluwer edited volume, "The Ordered Weighted Averaging Operators: Theory and Applications" (Yager & Kacprzyk, eds., 1997). An entire scholarly book devoted to the operator, gathering its theory and applications from many groups, marks field-consensus acceptance of the construct and its properties. The OWA\'s core property — that it lies between the AND (min) and OR (max) operators — is definitional and was never contested, so the arc goes directly RECORDED -> SETTLED.',
    source: {
      externalId: 'src:yager-owa-theory-applications-1997',
      name: 'Yager RR, Kacprzyk J (eds). The Ordered Weighted Averaging Operators: Theory and Applications. Boston: Springer/Kluwer, 1997.',
      url: 'https://doi.org/10.1007/978-1-4615-6123-1',
      publishedAt: '1997-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source upsert: ${t.source.externalId}`)
      console.log(`[dry-run] claimStatusHistory upsert: ${historyId} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
    })

    console.log(`Upserted transition ${historyId}: ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
