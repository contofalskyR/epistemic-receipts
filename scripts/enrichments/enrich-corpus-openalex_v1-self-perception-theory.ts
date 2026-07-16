import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for the corpus claim:
//   "Self-Perception Theory" — Daryl J. Bem (1972)
//   Advances in Experimental Social Psychology, vol. 6, pp. 1–62
//   DOI: 10.1016/s0065-2601(08)60024-6 · OpenAlex: W1748197048
//   Claim id: cmplxn0pf015jsa7fh9fs07xv
//
// The baseline row (fromAxis=null -> RECORDED at 1972-01-01) already exists and is
// NOT re-created here. This script adds the post-publication adjudication arc.
//
// Bem proposed self-perception theory (SPT) as a rival to Festinger's cognitive
// dissonance theory: people infer their own attitudes from observing their behavior,
// with no need for an aversive drive state. The two theories made identical predictions
// in the classic induced-compliance paradigm, provoking a decade of contest over which
// account was correct.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-self-perception-theory.ts

const CLAIM_ID = 'cmplxn0pf015jsa7fh9fs07xv'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // RECORDED -> CONTESTED: Zanna & Cooper's "Dissonance and the pill" (1974) supplied the
  // arousal test that self-perception theory could not accommodate.
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1974-01-01',
    datePrecision: 'YEAR',
    reason:
      'Zanna & Cooper, "Dissonance and the pill" (J. Personality and Social Psychology, 1974), used a misattribution design in which subjects took a placebo described as arousing, calming, or neutral. Attitude change after counterattitudinal behavior tracked the arousal manipulation, demonstrating that dissonance involves a genuine aversive drive state — an outcome self-perception theory, which posits only cool self-inference, could not explain. The result reopened the SPT-vs-dissonance question as an active empirical contest.',
    source: {
      externalId: 'src:zanna-cooper-dissonance-pill-1974',
      name: 'Zanna MP, Cooper J. Dissonance and the pill: An attribution approach to studying the arousal properties of dissonance. Journal of Personality and Social Psychology 1974;29(5):703–709.',
      url: 'https://doi.org/10.1037/h0036651',
      publishedAt: '1974-01-01',
      methodologyType: 'primary',
    },
  },
  // CONTESTED -> SETTLED: Fazio, Zanna & Cooper (1977) delimited each theory's proper
  // domain, vindicating self-perception theory within the latitude of acceptance.
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1977-09-01',
    datePrecision: 'MONTH',
    reason:
      'Fazio, Zanna & Cooper, "Dissonance and self-perception: An integrative view of each theory\'s proper domain of application" (J. Experimental Social Psychology, Sept 1977), resolved the decade-long debate by showing the two theories govern different regions of behavior: dissonance operates when behavior falls in the latitude of rejection (attitude-discrepant, arousal-producing), while self-perception operates in the latitude of acceptance (attitude-congruent). This became the settled textbook consensus, establishing self-perception theory as valid within its proper domain rather than a failed rival.',
    source: {
      externalId: 'src:fazio-zanna-cooper-integrative-1977',
      name: "Fazio RH, Zanna MP, Cooper J. Dissonance and self-perception: An integrative view of each theory's proper domain of application. Journal of Experimental Social Psychology 1977;13(5):464–479.",
      url: 'https://doi.org/10.1016/0022-1031(77)90031-2',
      publishedAt: '1977-09-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`Upserted ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
