// Enrichment: epistemic trajectory for the claim
//   "Cognitive processing therapy for PTSD a comprehensive manual"
//   (Resick, Monson & Chard — Guilford Press, 2016/17), claim id
//   cmpm1ep1b07hvsadn373pgfwu, ingested by openalex_v1.
//
// The claim already has its first status-history row (fromAxis=null -> RECORDED).
// This script adds the downstream arc:
//   RECORDED -> CONTESTED  (2015 JAMA review: substantial non-response in
//                           military/veteran samples treated with CPT/PE)
//   CONTESTED -> SETTLED   (2017 APA Clinical Practice Guideline STRONGLY
//                           recommends CPT for PTSD, resolving the debate at
//                           the level of institutional endorsement)
//
// Idempotent: upserts sources on externalId and status-history rows on the
// slug id `${claimId}-${toAxis}-${occurredAt.slice(0,10)}`.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cpt-ptsd-manual.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm1ep1b07hvsadn373pgfwu'

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
  // ── RECORDED -> CONTESTED ──────────────────────────────────────────────
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-08-04',
    datePrecision: 'DAY',
    reason:
      'Steenkamp, Litz, Hoge & Marmar, "Psychotherapy for Military-Related PTSD: A Review of Randomized Clinical Trials" (JAMA, 4 Aug 2015; 314(5):489–500), reviewed the RCT evidence for the two first-line trauma-focused therapies — Cognitive Processing Therapy and Prolonged Exposure — in military and veteran samples. Although both outperformed control conditions, the authors reported that roughly two-thirds of participants receiving CPT or PE retained their PTSD diagnosis after treatment, and that these therapies were no more effective than active non-trauma-focused comparators in several trials. The review became a widely cited methodological challenge to the strength and generalizability of the CPT efficacy claim, especially for combat-related PTSD.',
    source: {
      externalId: 'src:steenkamp-jama-military-ptsd-2015',
      name: 'Steenkamp MM, Litz BT, Hoge CW, Marmar CR. Psychotherapy for Military-Related PTSD: A Review of Randomized Clinical Trials. JAMA. 2015;314(5):489–500.',
      url: 'https://doi.org/10.1001/jama.2015.8370',
      publishedAt: '2015-08-04',
      methodologyType: 'derivative',
    },
  },

  // ── CONTESTED -> SETTLED ───────────────────────────────────────────────
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2017-02-24',
    datePrecision: 'DAY',
    reason:
      'The American Psychological Association\'s "Clinical Practice Guideline for the Treatment of Posttraumatic Stress Disorder (PTSD) in Adults," approved by the APA Council of Representatives on 24 Feb 2017 after a systematic evidence review, issued a STRONG recommendation for Cognitive Processing Therapy as a first-line treatment for adult PTSD (alongside prolonged exposure and trauma-focused CBT). Despite the veteran-population debate raised in 2015, the panel judged the aggregate randomized evidence sufficient to place CPT in the highest recommendation tier — an institutional settlement mirrored by the VA/DoD Clinical Practice Guideline the same year, which lists CPT among its strongly recommended trauma-focused psychotherapies.',
    source: {
      externalId: 'src:apa-ptsd-cpg-cpt-2017',
      name: 'American Psychological Association. Clinical Practice Guideline for the Treatment of PTSD in Adults — Cognitive Processing Therapy (strong recommendation). Adopted 24 Feb 2017.',
      url: 'https://www.apa.org/ptsd-guideline/treatments/cognitive-processing-therapy',
      publishedAt: '2017-02-24',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions...`)

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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} (${histId})`)
  }

  await prisma.claim.update({
    where: { id: CLAIM_ID },
    data: { epistemicAxis: 'SETTLED' },
  })

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
