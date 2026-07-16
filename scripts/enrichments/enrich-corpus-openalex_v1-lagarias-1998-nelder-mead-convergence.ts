// Epistemic-receipt enrichment: post-publication trajectory for
// Lagarias, Reeds, Wright & Wright (1998), "Convergence Properties of the
// Nelder--Mead Simplex Method in Low Dimensions", SIAM Journal on Optimization
// 9(1):112-147. DOI: 10.1137/s1052623496303470
// OpenAlex: W2024991751. Claim id: cmq2w4vpi00jlsa8hk8c3arm5.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1998-01-01) already exists and is NOT duplicated here.
//
// Context (not modeled as a transition): in the SAME 1998 issue, McKinnon's
// "Convergence of the Nelder--Mead Simplex Method to a Nonstationary Point"
// (SIAM J. Optim. 9(1):148-158, DOI 10.1137/s1052623496303482) gave a strictly
// convex 2-D counterexample on which standard Nelder--Mead stalls at a
// nonstationary point, fixing the boundary of the 1998 convergence results.
// Because it was published simultaneously (not after) and complements rather
// than overturns the proven theorems, it is recorded here for context only.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2012, EXPERT_LITERATURE)
//     Lagarias, Poonen & Wright (2012), "Convergence of the Restricted
//     Nelder--Mead Algorithm in Two Dimensions" (SIAM J. Optim. 22(2):501-532),
//     the same lead authors returning to prove convergence of the restricted
//     variant in two dimensions -- the case the 1998 paper had left open --
//     consolidating the convergence program this claim initiated.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lagarias-1998-nelder-mead-convergence.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4vpi00jlsa8hk8c3arm5'

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
    occurredAt: '2012-01-01',
    datePrecision: 'YEAR',
    reason:
      'Lagarias, Poonen & Wright (2012), "Convergence of the Restricted Nelder--Mead Algorithm in Two Dimensions" (SIAM J. Optim. 22(2):501-532), is the direct follow-up by the same lead authors to the 1998 paper. It proves that the restricted Nelder--Mead algorithm converges to the minimizer of a strictly convex function in two dimensions -- the two-dimensional case the 1998 paper had explicitly left as only "limited" -- thereby extending and consolidating the convergence program this claim initiated into an accepted body of results. The 1998 theorems themselves stood unchallenged; the general (unrestricted) Nelder--Mead 2-D question remains open, but the finding\'s status as a rigorous, built-upon foundation of simplex-method convergence theory is settled.',
    source: {
      externalId: 'src:lagarias-poonen-wright-restricted-nm-2012',
      name: 'Lagarias JC, Poonen B, Wright MH. Convergence of the Restricted Nelder--Mead Algorithm in Two Dimensions. SIAM Journal on Optimization 2012;22(2):501-532.',
      url: 'https://doi.org/10.1137/110830150',
      publishedAt: '2012-01-01',
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
