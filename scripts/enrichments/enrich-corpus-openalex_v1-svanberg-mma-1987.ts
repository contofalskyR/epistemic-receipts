// Epistemic-receipt enrichment: post-publication trajectory for
// Svanberg (1987), "The method of moving asymptotes—a new method for structural
// optimization" (International Journal for Numerical Methods in Engineering
// 24(2):359–373) — the founding paper of the Method of Moving Asymptotes (MMA).
// DOI: 10.1002/nme.1620240207. OpenAlex: W2062523101.
// Claim id: cmq2w5kkb00yfsa8hj8oqxkez. Citations (OpenAlex): 5440.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1987-02-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2002, EXPERT_LITERATURE)
//     Krister Svanberg, "A Class of Globally Convergent Optimization Methods
//     Based on Conservative Convex Separable Approximations" (SIAM Journal on
//     Optimization 12(2):555–573, 2002; DOI 10.1137/S1052623499362822). The
//     original 1987 MMA was a heuristic convex-approximation scheme whose
//     iterates were not guaranteed to converge — an acknowledged limitation of
//     the method as first presented. Svanberg's 2002 paper embeds MMA in the
//     conservative convex separable approximation (CCSA) framework and proves
//     global convergence for the resulting variant (GCMMA), placing the method's
//     central claim (asymptote-controlled subproblems that "stabilize and speed
//     up convergence") on rigorous mathematical footing. This vindication, by
//     the method's own author in a top optimization journal, cemented MMA/GCMMA
//     as the standard general-purpose optimizer of structural and topology
//     optimization.
//
// No retraction or expression of concern exists. Only the RECORDED -> SETTLED
// arc is a specific, dated, citable adjudicating document, so it is the only
// transition emitted.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-svanberg-mma-1987.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5kkb00yfsa8hj8oqxkez'

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
    occurredAt: '2002-01-01',
    datePrecision: 'YEAR',
    reason:
      'The original 1987 Method of Moving Asymptotes was a heuristic convex-approximation scheme whose iterates were not guaranteed to converge — a recognized limitation of the method as first presented. Krister Svanberg\'s "A Class of Globally Convergent Optimization Methods Based on Conservative Convex Separable Approximations" (SIAM Journal on Optimization 12(2):555–573, 2002) embeds MMA in the conservative convex separable approximation (CCSA) framework and proves global convergence for the resulting variant (GCMMA). This vindicated and rigorously grounded MMA\'s central claim — asymptote-controlled convex subproblems that stabilize and speed up convergence — cementing MMA/GCMMA as the standard general-purpose optimizer in structural and topology optimization.',
    source: {
      externalId: 'src:svanberg-gcmma-ccsa-2002',
      name: 'Svanberg K. A Class of Globally Convergent Optimization Methods Based on Conservative Convex Separable Approximations. SIAM Journal on Optimization 2002;12(2):555–573. DOI:10.1137/S1052623499362822.',
      url: 'https://doi.org/10.1137/S1052623499362822',
      publishedAt: '2002-01-01',
      methodologyType: 'primary',
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
