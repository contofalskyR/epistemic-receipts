// Enrichment: epistemic arc for the Instaflex "topical analgesic" claim.
//
// Claim: cmpiyixlm8z6iplo7miqp68nh
//   "Instaflex Extra Strength Pain Relief Cream (MENTHOL, METHYL SALICYLATE):
//    Purpose Topical Analgesic" (openfda_labels_v1)
//
// This is an OTC monograph counterirritant product, not an NDA drug with a
// single pivotal Phase III program. Its epistemic arc therefore runs through
// the FDA OTC external-analgesic monograph rather than a de-novo approval:
//
//   OPEN     -> RECORDED  FDA OTC external-analgesic monograph (21 CFR 348)
//                         classifies menthol and methyl salicylate as Category I
//                         (generally recognized as safe and effective)
//                         counterirritant topical analgesics.
//   RECORDED -> SETTLED   Modern randomized, double-blind, placebo-controlled
//                         trial (Higashi et al., Clinical Therapeutics 2010)
//                         confirms efficacy of the methyl salicylate/menthol
//                         combination for musculoskeletal pain on controlled-
//                         trial footing.
//   SETTLED  -> CONTESTED FDA Drug Safety Communication (13 Sep 2012) warns of
//                         rare cases of serious burns from OTC topical muscle
//                         and joint pain relievers containing menthol and/or
//                         methyl salicylate.
//
// Dates are strictly increasing (1983 -> 2010 -> 2012). Does NOT create a new
// Claim — the claim already exists (openfda_labels_v1). The existing first
// entry (fromAxis=null -> first status) is not duplicated.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic id slug.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-instaflex-menthol-methyl-salicylate-topical-analgesic.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyixlm8z6iplo7miqp68nh'

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
  // ── OPEN -> RECORDED: OTC external-analgesic monograph recognizes the actives ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1983-01-01',
    datePrecision: 'YEAR',
    reason:
      'The FDA OTC external-analgesic drug review classified menthol and methyl salicylate as Category I — generally recognized as safe and effective — counterirritant topical analgesics, the regulatory basis codified at 21 CFR Part 348. This recorded the "topical analgesic" purpose that Instaflex Extra Strength (MENTHOL, METHYL SALICYLATE) later invokes as an established OTC fact rather than an open claim, fixing the permitted counterirritant concentration ranges (methyl salicylate 10–60%, menthol 1.25–16%). Instaflex markets under this monograph, so its labeled purpose derives directly from this recognition.',
    source: {
      externalId: 'src:fda-otc-external-analgesic-monograph-21cfr348',
      name: 'U.S. FDA. 21 CFR Part 348 — External Analgesic Drug Products for Over-the-Counter Human Use (counterirritant active ingredients, incl. menthol and methyl salicylate). Electronic Code of Federal Regulations.',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-348',
      publishedAt: '1983-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: modern randomized controlled trial confirms efficacy ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-01-01',
    datePrecision: 'MONTH',
    reason:
      'Higashi and colleagues reported a randomized, double-blind, parallel-group, placebo-controlled, multicenter trial showing that a topical methyl salicylate and menthol patch produced significantly greater pain relief than placebo in adults with mild-to-moderate muscle strain. This moved the methyl salicylate/menthol topical-analgesic claim from monograph recognition onto controlled-trial footing and underpinned the standard OTC self-care role these counterirritants hold for musculoskeletal pain. The combination Instaflex relies on was thus settled as an efficacious topical analgesic in the modern trial literature.',
    source: {
      externalId: 'src:higashi-methyl-salicylate-menthol-rct-2010',
      name: 'Higashi Y, Kiuchi T, Furuta K. Efficacy and safety profile of a topical methyl salicylate and menthol patch in adult patients with mild to moderate muscle strain: a randomized, double-blind, parallel-group, placebo-controlled, multicenter study. Clin Ther. 2010;32(1):34–43.',
      url: 'https://doi.org/10.1016/j.clinthera.2010.01.016',
      publishedAt: '2010-01-01',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: FDA safety communication on rare serious burns ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-09-13',
    datePrecision: 'DAY',
    reason:
      'On 13 September 2012 the FDA issued a Drug Safety Communication reporting rare cases of serious burns — including second- and third-degree burns — associated with over-the-counter topical muscle and joint pain relievers containing menthol, methyl salicylate, or capsaicin, the counterirritant class to which Instaflex belongs. The agency did not withdraw the products but warned consumers and clinicians, contesting the presumption that these topical analgesics are uniformly benign at labeled concentrations. The topical-analgesic claim survives, but its unqualified safety profile came under formal regulatory scrutiny.',
    source: {
      externalId: 'src:fda-dsc-topical-analgesic-burns-2012',
      name: 'U.S. FDA. FDA Drug Safety Communication: Rare cases of serious burns with the use of over-the-counter topical muscle and joint pain relievers. September 13, 2012.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-rare-cases-serious-burns-use-over-counter-topical-muscle-and-joint',
      publishedAt: '2012-09-13',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script does not create claims).`)
  }

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
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions for claim ${CLAIM_ID}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
