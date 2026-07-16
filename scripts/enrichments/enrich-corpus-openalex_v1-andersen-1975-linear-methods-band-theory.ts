// Epistemic-receipt enrichment: post-publication trajectory for
// O. Krogh Andersen (1975), "Linear methods in band theory",
// Physical Review B 12(8):3060–3083. DOI: 10.1103/PhysRevB.12.3060
// OpenAlex: W2121431463. Claim id: cmq2w53gl00o9sa8hih5swbgq.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1975-10-15) already exists and is NOT duplicated here.
//
// This is a foundational methods paper. It introduced the linearized
// augmented-plane-wave (LAPW) and linearized muffin-tin-orbital (LMTO)
// schemes for solving the band-structure problem. There is no retraction,
// expression of concern, failed replication, or methodological critique
// contesting the core claim. Instead the methods became the acknowledged
// standard for all-electron electronic-structure calculations. The single
// dated adjudicating event added is a textbook-consensus canonization:
//
//   RECORDED -> SETTLED (2006, EXPERT_LITERATURE)
//     Singh & Nordström, "Planewaves, Pseudopotentials and the LAPW Method"
//     (Springer, 2nd ed. 2006) — the definitive monograph on the LAPW method
//     Andersen introduced here. Its existence and standing as the reference
//     text codify the field consensus that the linearized all-electron
//     methods of this paper are the established, validated approach (the LAPW
//     method is routinely described as the "gold standard" for electronic-
//     structure calculations). There was never a contest, so RECORDED -> SETTLED
//     directly.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-andersen-1975-linear-methods-band-theory.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w53gl00o9sa8hih5swbgq'

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
    community: 'EXPERT_LITERATURE',
    occurredAt: '2006-01-01',
    datePrecision: 'YEAR',
    reason:
      'Singh & Nordström, "Planewaves, Pseudopotentials and the LAPW Method" (Springer, 2nd ed. 2006), is the definitive monograph on the linearized augmented-plane-wave method that Andersen introduced in this paper. A dedicated reference text organized entirely around the method codifies the field consensus that these linearized all-electron schemes are the established, validated approach to the band-structure problem — the LAPW method is routinely described as the "gold standard" for electronic-structure calculations. Because the finding was never contested, this marks a direct RECORDED -> SETTLED canonization by expert literature.',
    source: {
      externalId: 'src:singh-nordstrom-lapw-method-2006',
      name: 'Singh DJ, Nordström L. Planewaves, Pseudopotentials and the LAPW Method. 2nd ed. New York: Springer; 2006.',
      url: 'https://doi.org/10.1007/978-0-387-29684-5',
      publishedAt: '2006-01-01',
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
