// Epistemic-receipt enrichment: post-publication trajectory for
// Yang & Deb (2009), "Cuckoo Search via Lévy flights", 2009 World Congress on
// Nature & Biologically Inspired Computing (NaBIC), pp. 210–214.
// DOI: 10.1109/nabic.2009.5393690. OpenAlex: W1976744965.
// Claim id: cmq2w57up00qxsa8hfg3dk6zn.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2009-01-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2022-06, EXPERT_LITERATURE)
//     Camacho-Villalón, Dorigo & Stützle, "An analysis of why cuckoo search does
//     not bring any novel ideas to optimization" (Computers & Operations Research
//     142:105747) — a specific, dated critique giving formal evidence that cuckoo
//     search is a special case of the (μ+λ)-evolution strategy combined with
//     differential-evolution-style recombination, directly disputing the paper's
//     central claim to formulate a "new meta-heuristic algorithm." Mirrors the
//     Weyland/Sörensen metaphor-critique line applied to harmony search.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-yang-deb-2009-cuckoo-search.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w57up00qxsa8hfg3dk6zn'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2022-06-01',
    datePrecision: 'MONTH',
    reason:
      'Camacho-Villalón, Dorigo & Stützle, "An analysis of why cuckoo search does not bring any novel ideas to optimization" (Computers & Operations Research 142:105747, June 2022), gives formal evidence that cuckoo search is equivalent to the long-established (μ+λ)-evolution strategy using differential-evolution-style recombination, and that its brood-parasitism/Lévy-flight metaphor merely relabels operators proposed by the evolutionary-computation community decades earlier. This directly contests the paper\'s central claim to formulate a genuinely new meta-heuristic algorithm, extending the metaphor-critique line (Weyland 2010; Sörensen 2015) that leaves the novelty claim contested rather than settled.',
    source: {
      externalId: 'src:camacho-villalon-cuckoo-search-no-novelty-2022',
      name: 'Camacho-Villalón CL, Dorigo M, Stützle T. An analysis of why cuckoo search does not bring any novel ideas to optimization. Computers & Operations Research 2022;142:105747.',
      url: 'https://doi.org/10.1016/j.cor.2022.105747',
      publishedAt: '2022-06-01',
      methodologyType: 'opinion',
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
