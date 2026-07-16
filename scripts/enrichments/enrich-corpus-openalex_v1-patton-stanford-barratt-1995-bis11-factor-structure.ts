import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Patton, J. H., Stanford, M. S., & Barratt, E. S. (1995), "Factor structure
//   of the Barratt Impulsiveness Scale," Journal of Clinical Psychology
//   51(6): 768-774.
//   DOI: 10.1002/1097-4679(199511)51:6<768::aid-jclp2270510607>3.0.co;2-1
//   OpenAlex: W2054515032
//
// Baseline row (fromAxis=null -> RECORDED at 1995-11-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2013-06): Reise, Moore, Sabb, Brown & London,
//   "The Barratt Impulsiveness Scale-11: Reassessment of its structure in a
//   community sample," Psychological Assessment 25(2): 631-642
//   (DOI 10.1037/a0032161; PMID 23544402; PMCID PMC3805371).
//   Reise et al. applied EFA and CFA to a community sample (N=691) to test the
//   BIS-11 structure and directly challenged the 1995 paper's central factual
//   claim. They report that "the theory that the BIS-11 measures 3 subdomains
//   of impulsivity (attention, motor, and nonplanning) was not empirically
//   supported," and that use of the total score "presents challenges in
//   interpretation," proposing a 2-factor model instead. This is a specific,
//   dated methodological critique of the reported factor structure — a genuine
//   contest, not overturning-by-consensus. No subsequent meta-analysis has
//   vindicated the original 6-primary/3-second-order structure (later work
//   continues to propose alternative structures and short forms), so the
//   terminal state here is CONTESTED, not SETTLED.

const CLAIM_ID = 'cmpm1js3509v1sadntwuhv1xi'

async function main() {
  // ── RECORDED -> CONTESTED: Reise et al. (2013) structural reassessment ──
  const reise = await prisma.source.upsert({
    where: { externalId: 'src:reise-2013-bis11-reassessment-structure' },
    create: {
      externalId: 'src:reise-2013-bis11-reassessment-structure',
      name: 'Reise, S. P., Moore, T. M., Sabb, F. W., Brown, A. K., & London, E. D. (2013). "The Barratt Impulsiveness Scale-11: Reassessment of its structure in a community sample." Psychological Assessment 25(2): 631-642.',
      url: 'https://doi.org/10.1037/a0032161',
      publishedAt: new Date('2013-06-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-patton-stanford-barratt-1995-bis11',
    },
    update: {
      name: 'Reise, S. P., Moore, T. M., Sabb, F. W., Brown, A. K., & London, E. D. (2013). "The Barratt Impulsiveness Scale-11: Reassessment of its structure in a community sample." Psychological Assessment 25(2): 631-642.',
      url: 'https://doi.org/10.1037/a0032161',
      publishedAt: new Date('2013-06-01'),
    },
  })

  const histId = `${CLAIM_ID}-CONTESTED-2013-06-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-06-01'),
      datePrecision: 'MONTH',
      reason: 'Reise, Moore, Sabb, Brown & London (2013), applying exploratory and confirmatory factor analysis to a community sample (N=691) in Psychological Assessment, directly challenged the 1995 paper\'s reported factor structure. They found the proposed three second-order subdomains (attention, motor, nonplanning) "was not empirically supported," identified poor confirmatory model fit and redundant/near-zero-correlating items, and concluded that even total-score interpretation "presents challenges," proposing a 2-factor alternative. This is a specific, dated methodological contest of the finding; no later meta-analysis has vindicated the original six-primary/three-second-order structure, so the state remains CONTESTED rather than SETTLED.',
      sourceId: reise.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-06-01'),
      datePrecision: 'MONTH',
      reason: 'Reise, Moore, Sabb, Brown & London (2013), applying exploratory and confirmatory factor analysis to a community sample (N=691) in Psychological Assessment, directly challenged the 1995 paper\'s reported factor structure. They found the proposed three second-order subdomains (attention, motor, nonplanning) "was not empirically supported," identified poor confirmatory model fit and redundant/near-zero-correlating items, and concluded that even total-score interpretation "presents challenges," proposing a 2-factor alternative. This is a specific, dated methodological contest of the finding; no later meta-analysis has vindicated the original six-primary/three-second-order structure, so the state remains CONTESTED rather than SETTLED.',
      sourceId: reise.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: reise.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: reise.id, type: 'DISPUTES' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED via Reise et al. 2013)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
