import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// Epistemic-receipt enrichment for:
//   Claim: "A cognitive model of posttraumatic stress disorder"
//   Ehlers, A. & Clark, D. M. (2000), Behaviour Research and Therapy, 38(4):319–345
//   DOI:      https://doi.org/10.1016/s0005-7967(99)00123-0
//   OpenAlex: W1969348782
//   Claim ID: cmplxkzqx006psa7ftg9qw2q8
//
// Baseline row (fromAxis=null -> RECORDED @ 2000-04-01) already exists — NOT duplicated here.
//
// Post-publication trajectory (no retraction / expression of concern found):
//  1. RECORDED -> SETTLED  (EXPERT_LITERATURE, 2013-12-13)
//     Cochrane systematic review (Bisson et al.) of psychological therapies for chronic
//     PTSD found trauma-focused CBT — the treatment class that includes Cognitive Therapy
//     for PTSD (CT-PTSD), developed directly from this cognitive model — efficacious,
//     adjudicating the model's central clinical predictions in the expert literature.
//  2. SETTLED -> SETTLED   (INSTITUTIONAL, 2018-12-05)
//     NICE guideline NG116 ("Post-traumatic stress disorder") recommends individual
//     trauma-focused CBT, including CT-PTSD, as a first-line treatment — an institutional
//     consensus reaffirming the already-settled clinical model.
// ─────────────────────────────────────────────────────────────────────────────

const CLAIM_ID = 'cmplxkzqx006psa7ftg9qw2q8'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-12-13',
    datePrecision: 'DAY',
    reason:
      'The Cochrane systematic review "Psychological therapies for chronic post-traumatic stress disorder (PTSD) in adults" (Bisson et al., 2013) pooled trials of trauma-focused CBT — the treatment class encompassing Cognitive Therapy for PTSD (CT-PTSD), which operationalises the Ehlers–Clark cognitive model — and found it effective in reducing PTSD symptoms. This expert-literature synthesis adjudicated the model\'s core clinical prediction that targeting maladaptive appraisals and the nature of trauma memory relieves persistent PTSD.',
    source: {
      externalId: 'src:cochrane-bisson-2013-ptsd-psychological-therapies',
      name: 'Bisson JI, Roberts NP, Andrew M, Cooper R, Lewis C. Psychological therapies for chronic post-traumatic stress disorder (PTSD) in adults. Cochrane Database of Systematic Reviews, 2013(12):CD003388.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24338345/',
      publishedAt: '2013-12-13',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-12-05',
    datePrecision: 'DAY',
    reason:
      'NICE guideline NG116 ("Post-traumatic stress disorder", published 5 December 2018) recommends individual trauma-focused CBT interventions — explicitly including Cognitive Therapy for PTSD (CT-PTSD), the manualised therapy derived from the Ehlers–Clark cognitive model — as a first-line treatment for adults with PTSD. This is an institutional consensus milestone reaffirming the model\'s clinical validity beyond the expert literature.',
    source: {
      externalId: 'src:nice-ng116-ptsd-2018',
      name: 'National Institute for Health and Care Excellence (NICE). Post-traumatic stress disorder. NICE guideline NG116.',
      url: 'https://www.nice.org.uk/guidance/ng116',
      publishedAt: '2018-12-05',
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
        ingestedBy: 'enrich:ehlers-clark-ptsd-cognitive-model',
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
