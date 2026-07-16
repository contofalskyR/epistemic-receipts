// Epistemic-receipt enrichment: post-publication trajectory for
// "The hippocampus as a cognitive map", Neuroscience 4(6):863 (1979).
// DOI: 10.1016/0306-4522(79)90015-0. OpenAlex: W2082149624.
// Claim id: cmplxlpj500ijsa7fynrlhfch.
//
// Note on identity: the DOI resolves to R.E. Passingham's one-page review in
// Neuroscience (vol 4, issue 6, p.863, 1979) of O'Keefe & Nadel's 1978 book
// "The Hippocampus as a Cognitive Map"; OpenAlex clusters this title under the
// cognitive-map theory of hippocampal spatial coding. The finding tracked by
// this receipt is that theory: that the hippocampus builds an allocentric
// "cognitive map" of space, grounded in O'Keefe's 1971 discovery of place cells.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1979-06-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2014-10-06, INSTITUTIONAL)
//     The 2014 Nobel Prize in Physiology or Medicine was awarded to John O'Keefe
//     (1/2) and May-Britt & Edvard Moser "for their discoveries of cells that
//     constitute a positioning system in the brain." The prize citation and the
//     Nobel Committee's account explicitly credit O'Keefe's place cells as forming
//     "a kind of internal map" — an institutional consensus vindication of the
//     cognitive-map theory this claim asserts.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-the-hippocampus-as-a-cognitive-map.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxlpj500ijsa7fynrlhfch'

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
    community: 'INSTITUTIONAL',
    occurredAt: '2014-10-06',
    datePrecision: 'DAY',
    reason:
      'The 2014 Nobel Prize in Physiology or Medicine was awarded to John O\'Keefe (one half) together with May-Britt Moser and Edvard I. Moser "for their discoveries of cells that constitute a positioning system in the brain." The Nobel Committee\'s account credits O\'Keefe\'s 1971 discovery of hippocampal place cells with showing that these cells "form a kind of internal map of the room" — the cognitive-map theory of hippocampal spatial representation asserted by this claim. The award represents institutional consensus that the finding is established, an adjudicating event distinct from citation count alone.',
    source: {
      externalId: 'src:nobel-medicine-2014-okeefe',
      name: 'The Nobel Prize in Physiology or Medicine 2014 — John O\'Keefe (Facts). Nobel Prize Outreach.',
      url: 'https://www.nobelprize.org/prizes/medicine/2014/okeefe/facts/',
      publishedAt: '2014-10-06',
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
        ingestedBy: 'enrich:corpus-openalex_v1',
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
