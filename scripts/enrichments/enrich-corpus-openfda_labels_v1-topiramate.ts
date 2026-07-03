// Enrichment: epistemic arc for the FDA "Topiramate (TOPIRAMATE)" prescription
// drug label claim.
//
// Claim: cmpiy82zi8mrcplo78qk2njda (openfda_labels_v1)
//   "Topiramate (TOPIRAMATE): 1 INDICATIONS AND USAGE ... Epilepsy: initial
//    monotherapy ... adjunctive therapy ... Preventive treatment of migraine in
//    patients 12 years of age and older ..."
//
// The 2026 label filing is only when *this* package emerged. Topiramate itself
// has a genuine, dateable, externally verifiable multi-step epistemic arc. The
// arc is anchored on the migraine-prevention indication — one of the two
// indications this label carries — because its evidentiary milestones (a pivotal
// Phase III RCT, a Level-A practice guideline) are cleanly dated and cited to
// stable publisher DOIs. The closing CONTESTED transition is drug-wide: it is
// the prenatal/neurodevelopmental safety signal that applies to topiramate
// across both its epilepsy and migraine uses. (The epilepsy indication has its
// own earlier evidence base — pivotal adjunctive-therapy trials and the 1996
// Topamax approval — which precedes and reinforces, but is not needed to, this
// arc.)
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED  (2004-02-25)  Brandes et al.'s pivotal Phase III
//                         placebo-controlled randomized trial in JAMA established
//                         topiramate's efficacy for migraine prevention — the
//                         first high-quality published clinical evidence for the
//                         migraine indication carried on this label. Ratified by
//                         EXPERT_LITERATURE.
//   RECORDED -> SETTLED   (2012-04-24)  The American Academy of Neurology /
//                         American Headache Society evidence-based guideline
//                         update (Silberstein et al., Neurology) assigned
//                         topiramate a Level A recommendation for episodic
//                         migraine prevention, establishing standard-of-care
//                         status. Ratified by INSTITUTIONAL.
//   SETTLED  -> CONTESTED (2022-05-31)  Bjork et al.'s Nordic population cohort in
//                         JAMA Neurology associated prenatal topiramate exposure
//                         with increased risk of autism spectrum disorder and
//                         intellectual disability, sharpening the pregnancy safety
//                         signal that had begun with FDA's 2011 oral-cleft
//                         communication and driving European regulators (EMA/MHRA)
//                         to impose pregnancy-use restrictions. This contests the
//                         drug's benefit-risk standing for people who may become
//                         pregnant across both indications on this label.
//                         Ratified by EXPERT_LITERATURE.
//
// URLs are anchored on stable publisher DOIs (JAMA, Neurology, JAMA Neurology).
// Live web verification was unavailable in this session (WebSearch/WebFetch not
// permitted), so per AGENTS.md sources are limited to URLs whose form is
// structurally reliable — DOIs on doi.org — and no press-release or Federal
// Register document slug was invented.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-topiramate.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiy82zi8mrcplo78qk2njda'

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
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-02-25',
    datePrecision: 'DAY',
    reason:
      'Brandes and colleagues published a pivotal Phase III, randomized, double-blind, placebo-controlled trial in JAMA demonstrating that topiramate significantly reduced monthly migraine frequency versus placebo in adults with episodic migraine. This was the first high-quality published clinical evidence supporting the "Preventive treatment of migraine" indication carried on this label, recording the migraine-prevention claim into the peer-reviewed record and forming the basis for FDA approval of that indication.',
    source: {
      externalId: 'src:topiramate-brandes-2004-jama-migraine-rct',
      name: 'Brandes JL, Saper JR, Diamond M, et al. "Topiramate for Migraine Prevention: A Randomized Controlled Trial." JAMA. 2004;291(8):965-973. doi:10.1001/jama.291.8.965.',
      url: 'https://doi.org/10.1001/jama.291.8.965',
      publishedAt: '2004-02-25',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-04-24',
    datePrecision: 'DAY',
    reason:
      'The American Academy of Neurology and the American Headache Society issued an evidence-based guideline update on pharmacologic treatment for episodic migraine prevention in adults, assigning topiramate a Level A recommendation (established as effective; should be offered). The guideline codified topiramate as a first-line, standard-of-care migraine-prevention agent, moving the recorded efficacy claim into a settled state ratified by the relevant professional institutions.',
    source: {
      externalId: 'src:topiramate-aan-ahs-2012-migraine-guideline',
      name: 'Silberstein SD, Holland S, Freitag F, Dodick DW, Argoff C, Ashman E. "Evidence-based guideline update: Pharmacologic treatment for episodic migraine prevention in adults: Report of the Quality Standards Subcommittee of the American Academy of Neurology and the American Headache Society." Neurology. 2012;78(17):1337-1345. doi:10.1212/WNL.0b013e3182535d0c.',
      url: 'https://doi.org/10.1212/WNL.0b013e3182535d0c',
      publishedAt: '2012-04-24',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2022-05-31',
    datePrecision: 'DAY',
    reason:
      'Bjork and colleagues published a Nordic population-based cohort study in JAMA Neurology associating prenatal exposure to topiramate with an increased risk of autism spectrum disorder and intellectual disability in children. Building on FDA\'s earlier 2011 oral-cleft safety communication, the finding sharpened the pregnancy-related benefit-risk concern for topiramate and prompted European regulators (EMA PRAC and the UK MHRA) to introduce pregnancy-use restrictions and a pregnancy-prevention programme. The signal contests the drug\'s settled standing for patients who can become pregnant across both the epilepsy and migraine indications listed on this label.',
    source: {
      externalId: 'src:topiramate-bjork-2022-jamaneurol-prenatal-neurodev',
      name: 'Bjork MH, Zoega H, Leinonen MK, et al. "Association of Prenatal Exposure to Antiseizure Medications With Risk of Autism Spectrum Disorder and Intellectual Disability." JAMA Neurology. 2022;79(7):672-681. doi:10.1001/jamaneurol.2022.1269.',
      url: 'https://doi.org/10.1001/jamaneurol.2022.1269',
      publishedAt: '2022-05-31',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
