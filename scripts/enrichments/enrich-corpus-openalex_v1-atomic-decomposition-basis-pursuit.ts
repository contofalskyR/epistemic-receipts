// Epistemic-receipt enrichment: post-publication trajectory for
// "Atomic Decomposition by Basis Pursuit", SIAM Review 43(1):129-159 (2001)
// (originally SIAM J. Sci. Comput. 20(1):33-61, 1998).
// DOI: 10.1137/S003614450037906X. OpenAlex: W2078204800.
// Claim id: cmq2w5pfp011fsa8hlg2nwp9i.
//
// Identity: Chen, Donoho & Saunders introduce Basis Pursuit (BP) — decomposition
// of a signal into an overcomplete waveform dictionary by minimizing the l1 norm
// of the coefficients — arguing it is a superior "principle" for decomposition
// versus the method of frames (MOF), matching pursuit (MP), and best orthogonal
// basis (BOB). The finding tracked by this receipt is that l1-minimization
// (Basis Pursuit) is the principled route to sparse representation in
// overcomplete systems.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2001-01-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2006-04, EXPERT_LITERATURE)
//     The compressed-sensing theory of 2006 rigorously vindicated the Basis
//     Pursuit principle. Candès, Romberg & Tao (IEEE Trans. Inf. Theory, Feb
//     2006) and Donoho's "Compressed Sensing" (IEEE Trans. Inf. Theory, Apr
//     2006) proved that l1-minimization exactly recovers sparse signals under
//     incoherence / restricted-isometry conditions. This converted BP from a
//     heuristically-justified principle into a provably optimal one and made
//     l1-minimization the field-standard adjudicated by the expert literature.
//     The Apr-2006 Donoho paper — authored by a BP co-author and formalizing the
//     BP principle into proven theory — anchors the transition.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-atomic-decomposition-basis-pursuit.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5pfp011fsa8hlg2nwp9i'

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
    occurredAt: '2006-04-01',
    datePrecision: 'MONTH',
    reason:
      'The Basis Pursuit principle — decomposing signals over overcomplete dictionaries by l1-norm minimization — was rigorously vindicated by the compressed-sensing theory of 2006. Candès, Romberg & Tao ("Robust uncertainty principles," IEEE Trans. Inf. Theory, Feb 2006) and Donoho ("Compressed Sensing," IEEE Trans. Inf. Theory, Apr 2006) proved that l1-minimization exactly recovers sparse signals under incoherence / restricted-isometry conditions. These theorems converted BP from a heuristically-motivated principle into a provably optimal one, and l1-minimization became the field-standard method for sparse recovery — an adjudication by the expert literature distinct from citation count. The Apr-2006 Donoho paper, by a BP co-author and formalizing the principle into proven theory, anchors the date.',
    source: {
      externalId: 'src:donoho-2006-compressed-sensing',
      name: 'D. L. Donoho, "Compressed Sensing," IEEE Transactions on Information Theory 52(4):1289-1306 (Apr 2006).',
      url: 'https://doi.org/10.1109/TIT.2006.871582',
      publishedAt: '2006-04-01',
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
