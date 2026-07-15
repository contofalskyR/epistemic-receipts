// Enrichment: post-publication epistemic arc for the 1997 "No Free Lunch Theorems for Optimization" paper.
//
// Claim: cmq2w4agg006lsa8hsjliw733 (openalex_v1, W2151554678)
//   "No free lunch theorems for optimization"
//   — Wolpert DH, Macready WG. IEEE Transactions on Evolutionary Computation 1997;1(1):67-82
//   (published 1997-04). DOI 10.1109/4235.585893.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1997-04 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern. Crossref carries no update/crossmark
//     markers; the DOI resolves (HTTP 202 -> IEEE Xplore). This is a proven mathematical
//     theorem, not an empirical finding — its core correctness was never overturned. What
//     the follow-up literature adjudicated was the SCOPE and UNIVERSAL APPLICABILITY of the
//     NFL claim.
//   - RECORDED -> CONTESTED (2004-12): Igel C, Toussaint M, "A No-Free-Lunch Theorem for
//     Non-Uniform Distributions of Target Functions" (J. Math. Modelling & Algorithms
//     2004;3(4):313-322, DOI 10.1023/b:jmma.0000049381.24625.f7) proved that the NFL result
//     holds if and only if the distribution over objective functions is invariant under
//     permutation ("closed under permutation") — a restrictive condition that realistic,
//     structured problem classes generally do NOT satisfy. This formally contested the broad
//     reading that "no optimizer is better than any other on average." Community EXPERT_LITERATURE.
//   - CONTESTED -> SETTLED (2008-10-25): Auger A, Teytaud O, "Continuous Lunches Are Free
//     Plus the Design of Optimal Optimization Algorithms" (Algorithmica 2010;57(1):121-146,
//     DOI 10.1007/s00453-008-9244-5, published online 2008-10-25) rigorously proved that in
//     continuous domains free lunches DO exist — NFL does not hold there, and optimal
//     algorithms can be designed. Together with the permutation-closure characterization,
//     this settled the field's understanding of the theorems' precise scope: NFL is a correct
//     but bounded result (finite, permutation-closed problem classes) rather than a universal
//     impossibility. Community EXPERT_LITERATURE.
//
// Idempotent: upserts source on externalId and each status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-wolpert-macready-1997-no-free-lunch.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4agg006lsa8hsjliw733'

async function main() {
  // ── RECORDED -> CONTESTED: Igel & Toussaint 2004 restrict NFL to permutation-closed classes ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:igel-toussaint-2004-nfl-non-uniform-distributions' },
    create: {
      externalId: 'src:igel-toussaint-2004-nfl-non-uniform-distributions',
      name: 'Igel C, Toussaint M. A No-Free-Lunch Theorem for Non-Uniform Distributions of Target Functions. Journal of Mathematical Modelling and Algorithms 2004;3(4):313-322. DOI 10.1023/B:JMMA.0000049381.24625.f7.',
      url: 'https://doi.org/10.1023/b:jmma.0000049381.24625.f7',
      publishedAt: new Date('2004-12-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Igel C, Toussaint M. A No-Free-Lunch Theorem for Non-Uniform Distributions of Target Functions. Journal of Mathematical Modelling and Algorithms 2004;3(4):313-322. DOI 10.1023/B:JMMA.0000049381.24625.f7.',
      url: 'https://doi.org/10.1023/b:jmma.0000049381.24625.f7',
      publishedAt: new Date('2004-12-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-2004-12-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-12-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
      reason:
        "Igel & Toussaint, 'A No-Free-Lunch Theorem for Non-Uniform Distributions of Target Functions' (J. Math. Modelling & Algorithms 2004;3(4):313-322), proved that the NFL result holds if and only if the distribution over objective functions is invariant under permutation (closed under permutation) — a condition realistic, structured problem classes generally fail to meet. This formally contested the sweeping reading of Wolpert & Macready that no optimizer can outperform another on average, showing the theorem's universal-applicability interpretation is unwarranted: RECORDED -> CONTESTED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-12-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
    },
  })

  // ── CONTESTED -> SETTLED: Auger & Teytaud 2008/2010 settle NFL's scope (continuous lunches are free) ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:auger-teytaud-2010-continuous-lunches-are-free' },
    create: {
      externalId: 'src:auger-teytaud-2010-continuous-lunches-are-free',
      name: 'Auger A, Teytaud O. Continuous Lunches Are Free Plus the Design of Optimal Optimization Algorithms. Algorithmica 2010;57(1):121-146 (published online 2008-10-25). DOI 10.1007/s00453-008-9244-5.',
      url: 'https://doi.org/10.1007/s00453-008-9244-5',
      publishedAt: new Date('2008-10-25'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Auger A, Teytaud O. Continuous Lunches Are Free Plus the Design of Optimal Optimization Algorithms. Algorithmica 2010;57(1):121-146 (published online 2008-10-25). DOI 10.1007/s00453-008-9244-5.',
      url: 'https://doi.org/10.1007/s00453-008-9244-5',
      publishedAt: new Date('2008-10-25'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2008-10-25`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2008-10-25'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
      reason:
        "Auger & Teytaud, 'Continuous Lunches Are Free Plus the Design of Optimal Optimization Algorithms' (Algorithmica 2010;57(1):121-146, online 2008-10-25), rigorously proved that in continuous domains NFL does not hold — free lunches exist and optimal algorithms can be constructed. Combined with the permutation-closure characterization, this settled the field's understanding of the theorems' precise scope: the NFL theorems are correct but bounded to finite, permutation-closed problem classes rather than a universal impossibility. The scope question thus moved from contested to settled: CONTESTED -> SETTLED.",
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2008-10-25'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
    },
  })

  console.log(
    `Enriched claim ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED @ 2004-12 Igel & Toussaint; CONTESTED -> SETTLED @ 2008-10-25 Auger & Teytaud)`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
