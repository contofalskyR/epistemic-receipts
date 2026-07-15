// Enrichment: post-publication epistemic arc for Nelder & Mead 1965, the
// simplex ("Nelder-Mead") method for unconstrained function minimization.
//
// Claim: cmq2w425k001rsa8hkb28pktg (openalex_v1, W2171074980)
//   "A method is described for the minimization of a function of n variables ...
//    The method is shown to be effective and computationally compact ..."
//   — Nelder JA, Mead R. "A Simplex Method for Function Minimization."
//   The Computer Journal 1965;7(4):308-313. DOI 10.1093/comjnl/7.4.308.
//   Published 1965 (issue-level; YEAR precision).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1965 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref):
//   - NO retraction and NO expression of concern. Crossref reports update-to: None
//     on the original DOI; the paper is not in the Retraction Watch database.
//   - RECORDED -> CONTESTED: The 1965 claim asserts the method "is shown to be
//     effective." Its theoretical convergence properties remained an open question
//     for 33 years. In the January 1998 issue of SIAM Journal on Optimization,
//     McKinnon KIM, "Convergence of the Nelder-Mead Simplex Method to a
//     Nonstationary Point" (SIAM J. Optim. 1998;9(1):148-158,
//     DOI 10.1137/S1052623496303482), exhibited a family of strictly convex
//     functions on which the standard Nelder-Mead iteration provably converges to a
//     non-stationary point — i.e. it fails to reach a minimizer. This is a specific,
//     dated, and widely cited methodological critique that contests the reliability
//     asserted in the original abstract. Community EXPERT_LITERATURE.
//   - CONTEXT (not a transition): In the SAME 1998 issue, Lagarias, Reeds, Wright &
//     Wright, "Convergence Properties of the Nelder-Mead Simplex Method in Low
//     Dimensions" (SIAM J. Optim. 1998;9(1):112-147, DOI 10.1137/S1052623496303470)
//     gave the first rigorous convergence results, but only for dimensions 1 and 2
//     and without a general guarantee. It sharpens rather than resolves the contest,
//     so it is recorded here as context and NOT as a SETTLED transition. To this day
//     no general convergence guarantee exists, so the finding remains contested even
//     as the method stays in near-universal practical use (e.g. MATLAB fminsearch,
//     scipy.optimize).
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nelder-mead-1965-simplex-minimization.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w425k001rsa8hkb28pktg'

async function main() {
  // ── RECORDED -> CONTESTED: McKinnon 1998 counterexample (convergence failure) ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:mckinnon-1998-neldermead-nonstationary' },
    create: {
      externalId: 'src:mckinnon-1998-neldermead-nonstationary',
      name: 'McKinnon KIM. Convergence of the Nelder-Mead Simplex Method to a Nonstationary Point. SIAM Journal on Optimization 1998;9(1):148-158. DOI 10.1137/S1052623496303482.',
      url: 'https://doi.org/10.1137/S1052623496303482',
      publishedAt: new Date('1998-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'McKinnon KIM. Convergence of the Nelder-Mead Simplex Method to a Nonstationary Point. SIAM Journal on Optimization 1998;9(1):148-158. DOI 10.1137/S1052623496303482.',
      url: 'https://doi.org/10.1137/S1052623496303482',
      publishedAt: new Date('1998-01-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-1998-01-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1998-01-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
      reason:
        "The 1965 abstract claims the simplex method 'is shown to be effective,' but its convergence properties stayed an open question for decades. In the January 1998 SIAM Journal on Optimization, McKinnon exhibited a family of strictly convex functions on which standard Nelder-Mead provably converges to a non-stationary point — a concrete failure to reach a minimizer. This specific, dated, widely cited counterexample contests the reliability asserted in the original paper. (Lagarias et al., same issue, proved convergence only in dimensions 1-2; no general guarantee exists to this day.)",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1998-01-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED @ 1998-01, McKinnon nonstationary-point counterexample)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
