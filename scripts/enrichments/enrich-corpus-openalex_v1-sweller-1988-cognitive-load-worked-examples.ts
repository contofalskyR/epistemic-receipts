import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Sweller (1988) "Cognitive Load During Problem Solving: Effects on Learning"
//   Cognitive Science 12(2):257-285. DOI 10.1207/s15516709cog1202_4
//   OpenAlex W2130736456. Claim id: cmplxkmao0001sa7fognpzglt
//
// Baseline row (fromAxis=null -> RECORDED, 1988-04) already exists; NOT duplicated here.
//
// Post-publication arc (no retraction; core finding vindicated after a real contest):
//   RECORDED  -> CONTESTED (2007-04): constructivist / inquiry-learning scholars
//                directly disputed the claim that conventional problem solving is an
//                ineffective learning device.
//   CONTESTED -> SETTLED   (2019-06): the "20 Years Later" review adjudicated in favour
//                of the worked-example effect as one of the most robustly replicated
//                instructional effects, with the expertise-reversal boundary condition
//                reconciling the debate.

const CLAIM_ID = 'cmplxkmao0001sa7fognpzglt'

type Transition = {
  fromAxis: 'RECORDED' | 'CONTESTED'
  toAxis: 'CONTESTED' | 'SETTLED'
  community: 'EXPERT_LITERATURE'
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

const transitions: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-04-26',
    datePrecision: 'DAY',
    reason:
      'Hmelo-Silver, Duncan & Chinn (2007), "Scaffolding and Achievement in Problem-Based and Inquiry Learning: A Response to Kirschner, Sweller, and Clark (2006)" (Educational Psychologist 42(2)), directly disputed Sweller\'s contention that problem solving is an ineffective learning device, arguing that scaffolded problem-based and inquiry learning produces strong schema acquisition and transfer. Their rebuttal, together with parallel commentaries by Schmidt et al. and Kuhn, marked an active scholarly contest over the claim within the expert instructional-design literature.',
    source: {
      externalId: 'src:hmelo-silver-2007-response-pbl-inquiry',
      name: 'Hmelo-Silver, Duncan & Chinn (2007), "Scaffolding and Achievement in Problem-Based and Inquiry Learning: A Response to Kirschner, Sweller, and Clark (2006)", Educational Psychologist 42(2):99-107',
      url: 'https://doi.org/10.1080/00461520701263368',
      publishedAt: '2007-04-26',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2019-06-01',
    datePrecision: 'MONTH',
    reason:
      'Sweller, van Merriënboer & Paas (2019), "Cognitive Architecture and Instructional Design: 20 Years Later" (Educational Psychology Review 31(2)), reviewed two decades of accumulated experimental evidence and reported the worked-example effect — the superiority of studying worked examples over conventional problem solving for novice schema acquisition — as one of the most extensively replicated effects in instructional psychology. The review folds the earlier contest into a settled boundary-conditioned consensus: guidance benefits novices and fades with expertise (the expertise-reversal effect), vindicating the 1988 finding for its intended learner population.',
    source: {
      externalId: 'src:sweller-2019-cognitive-architecture-20-years-later',
      name: 'Sweller, van Merriënboer & Paas (2019), "Cognitive Architecture and Instructional Design: 20 Years Later", Educational Psychology Review 31(2):261-292',
      url: 'https://doi.org/10.1007/s10648-019-09465-5',
      publishedAt: '2019-06-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of transitions) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:sweller-1988-cognitive-load-worked-examples',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({
        data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' },
      })
    }

    console.log(`Upserted ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
