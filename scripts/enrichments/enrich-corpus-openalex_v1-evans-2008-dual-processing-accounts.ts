// Epistemic-receipt enrichment: post-publication trajectory for
// Evans (2008), "Dual-Processing Accounts of Reasoning, Judgment, and Social
// Cognition", Annual Review of Psychology 59:255–278.
// DOI: 10.1146/annurev.psych.59.103006.093629
// OpenAlex: W2155479778. Claim id: cmply3oy00961sa7fxfolir02.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2007-12-21) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2009-11, EXPERT_LITERATURE)
//     Keren & Schul, "Two Is Not Always Better Than One: A Critical Evaluation
//     of Two-System Theories" (Perspectives on Psychological Science) — the
//     canonical, highly cited methodological critique of exactly the two-system
//     (System 1 / System 2) architecture this review synthesizes and endorses.
//
// No SETTLED transition is added: Evans & Stanovich's (2013) "Advancing the
// Debate" reformulation is a same-lead-author defense that keeps the dispute
// live rather than adjudicating it; the dual-process framework remains contested.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-evans-2008-dual-processing-accounts.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply3oy00961sa7fxfolir02'

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
    occurredAt: '2009-11-01',
    datePrecision: 'MONTH',
    reason:
      'Keren & Schul\'s "Two Is Not Always Better Than One: A Critical Evaluation of Two-System Theories" (Perspectives on Psychological Science 4(6):533–550) is the reference methodological critique of the very System 1 / System 2 two-system architecture this review synthesizes and endorses. It argues that the evidence marshalled for two architecturally distinct cognitive systems is confounded and does not license the strong dual-system inference, and that the framework is often unfalsifiable as deployed. The paper opened a sustained dispute (continued by Kruglanski & Gigerenzer 2011 and Evans & Stanovich\'s 2013 defensive reformulation) that directly contests the two-systems claim asserted here.',
    source: {
      externalId: 'src:keren-schul-two-not-better-than-one-2009',
      name: 'Keren G, Schul Y. Two Is Not Always Better Than One: A Critical Evaluation of Two-System Theories. Perspectives on Psychological Science 2009;4(6):533–550.',
      url: 'https://doi.org/10.1111/j.1745-6924.2009.01164.x',
      publishedAt: '2009-11-01',
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
