// Epistemic-receipt enrichment: post-publication trajectory for
// Bishop, Lau, Shapiro, Carlson, Anderson, Carmody, Segal, Abbey, Speca,
// Velting & Devins (2004), "Mindfulness: A Proposed Operational Definition",
// Clinical Psychology: Science and Practice 11(3):230–241.
// DOI: 10.1093/clipsy.bph077  OpenAlex: W2140484936.
// Claim id: cmpm1j9bx09mjsadnneyn4fas.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2004-01-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2017-10-10, EXPERT_LITERATURE)
//     Van Dam et al., "Mind the Hype: A Critical Evaluation and Prescriptive
//     Agenda for Research on Mindfulness and Meditation," Perspectives on
//     Psychological Science 13(1):36–61 (published online 2017-10-10). Authored
//     by 15 mindfulness researchers, it argues that the field — including the
//     two-component consensus definition proposed by Bishop et al. — still lacks
//     a rigorous, agreed-upon operationalization: "mindfulness" remains
//     inconsistently defined and measured, self-report instruments built on
//     these definitions have poor construct validity, and no single definition
//     has achieved consensus. This directly contests the paper's central claim
//     that its meetings produced a "testable operational definition" of
//     mindfulness, placing the definitional program under active dispute rather
//     than settling it.
//
// No retraction, expression of concern, or failed replication of the 2004 paper
// exists (Retraction Watch / Crossref return no record for the DOI). The paper
// remains heavily cited, but the operationalization question it proposed to
// resolve is demonstrably still contested in the expert literature — hence
// CONTESTED, not SETTLED.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bishop-2004-mindfulness-operational-definition.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm1j9bx09mjsadnneyn4fas'

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
    occurredAt: '2017-10-10',
    datePrecision: 'DAY',
    reason:
      'Van Dam et al., "Mind the Hype: A Critical Evaluation and Prescriptive Agenda for Research on Mindfulness and Meditation" (Perspectives on Psychological Science 13(1):36–61, published online 2017-10-10), a 15-author critical review, argues that mindfulness research still lacks a rigorous, consensus operationalization: the construct is defined and measured inconsistently across studies, self-report scales built on these definitions show weak construct validity, and no proposed definition — including the two-component consensus model of Bishop et al. (2004) — has been adopted as a settled, testable standard. This directly contests the 2004 paper\'s central claim to have produced a consensus "testable operational definition" of mindfulness, marking the definitional program as actively disputed in the expert literature.',
    source: {
      externalId: 'src:van-dam-mind-the-hype-mindfulness-2018',
      name: 'Van Dam NT, van Vugt MK, Vago DR, et al. Mind the Hype: A Critical Evaluation and Prescriptive Agenda for Research on Mindfulness and Meditation. Perspectives on Psychological Science. 2018;13(1):36–61 (online 2017-10-10).',
      url: 'https://doi.org/10.1177/1745691617709589',
      publishedAt: '2017-10-10',
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
