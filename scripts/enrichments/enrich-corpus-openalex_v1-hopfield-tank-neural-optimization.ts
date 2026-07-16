import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// Epistemic-receipt enrichment for:
//   Claim: "\u201cNeural\u201d computation of decisions in optimization problems"
//   Hopfield, J. J. & Tank, D. W. (1985), Biological Cybernetics, 52(3):141\u2013152
//   DOI:      https://doi.org/10.1007/bf00339943
//   OpenAlex: W1597286183
//   Claim ID: cmq2w598t00rrsa8ho5l5jeur
//
// Baseline row (fromAxis=null -> RECORDED @ 1985-07-01) already exists — NOT duplicated here.
//
// Post-publication trajectory (no retraction / expression of concern found):
//  1. RECORDED -> CONTESTED  (EXPERT_LITERATURE, 1988-01)
//     Wilson & Pawley published a dated, widely-cited failed replication of the paper's
//     flagship demonstration — the Hopfield–Tank neural network solving the Travelling
//     Salesman Problem. Re-running the algorithm, they found it converged to a valid tour
//     only rarely and was highly sensitive to parameters, so the claimed reliable "neural"
//     computation of good optimization solutions did not reproduce. This became the canonical
//     methodological critique of the approach in the expert literature.
// ─────────────────────────────────────────────────────────────────────────────

const CLAIM_ID = 'cmq2w598t00rrsa8ho5l5jeur'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED'
  toAxis: 'SETTLED' | 'CONTESTED' | 'REVERSED'
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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1988-01-01',
    datePrecision: 'MONTH',
    reason:
      'Wilson & Pawley, "On the stability of the Travelling Salesman Problem algorithm of Hopfield and Tank" (Biological Cybernetics, 1988), attempted to reproduce the paper\'s headline demonstration — the Hopfield–Tank recurrent network solving the TSP — and found that on 10-city problems the network reached a valid tour only rarely, with results acutely sensitive to parameter and initialisation choices. This dated, heavily-cited failed replication established that the claimed reliable "neural" computation of good optimization solutions did not hold as presented, contesting the finding in the expert literature.',
    source: {
      externalId: 'src:wilson-pawley-1988-hopfield-tank-tsp-stability',
      name: 'Wilson GV, Pawley GS. On the stability of the Travelling Salesman Problem algorithm of Hopfield and Tank. Biological Cybernetics, 1988;58(1):63–70.',
      url: 'https://doi.org/10.1007/BF00363956',
      publishedAt: '1988-01-01',
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
        ingestedBy: 'enrich:hopfield-tank-neural-optimization',
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

    console.log(`Upserted ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
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
