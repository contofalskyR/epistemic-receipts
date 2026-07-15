// Enrichment: post-publication epistemic trajectory for the Stern Review.
//
// Claim cmplypbo500ytsaqkn9bp40ii — Nicholas Stern, "The Economics of Climate
// Change: The Stern Review," Cambridge University Press, 2007
// (DOI 10.1017/cbo9780511817434; OpenAlex W2126416729).
//
// The baseline row (fromAxis=null -> RECORDED at 2007-01-15) already exists and is
// NOT duplicated here. This script adds the single well-documented post-publication
// transition:
//
//   RECORDED -> CONTESTED  2007-09 (MONTH)  Journal of Economic Literature 45(3)
//                                           published paired review essays by William
//                                           Nordhaus (pp. 686-702) and Martin Weitzman
//                                           (pp. 703-724) arguing the Review's dramatic
//                                           conclusions were driven chiefly by its
//                                           near-zero social discount rate rather than
//                                           new economics, opening a lasting methodological
//                                           contest over the discounting assumptions.
//
// No clean adjudicating meta-analysis or consensus statement resolves the discount-rate
// dispute, which remains open in the economics literature, so no SETTLED/REVERSED step
// is asserted.
//
// Sources verified via Crossref (HTTP 200, correct title/authors/date/venue) 2026-07-15.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-stern-review-2007-climate-economics-discount-rate.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplypbo500ytsaqkn9bp40ii'

async function main() {
  // ── Transition 1: RECORDED -> CONTESTED (Nordhaus & Weitzman JEL review essays) ──
  await prisma.source.upsert({
    where: { externalId: 'src:nordhaus-2007-stern-review-jel' },
    create: {
      externalId: 'src:nordhaus-2007-stern-review-jel',
      name: 'Nordhaus WD. A Review of the Stern Review on the Economics of Climate Change. Journal of Economic Literature. 2007;45(3):686-702. (Paired in the same issue with Weitzman ML, pp. 703-724.)',
      url: 'https://doi.org/10.1257/jel.45.3.686',
      publishedAt: new Date('2007-09-01'),
      methodologyType: 'opinion',
    },
    update: {},
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-CONTESTED-2007-09-01` },
    create: {
      id: `${CLAIM_ID}-CONTESTED-2007-09-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2007-09-01'),
      datePrecision: 'MONTH',
      reason:
        'The September 2007 issue of the Journal of Economic Literature (vol. 45, no. 3) carried paired review essays by William Nordhaus (pp. 686-702) and Martin Weitzman (pp. 703-724) that sharply contested the Stern Review. Both argued the Review\'s call for large, immediate abatement rested chiefly on its near-zero social rate of time preference and low pure-time-discounting parameter rather than on new economic evidence, and that conventional discounting would sharply weaken the case for its recommended policy path. Their critique opened a durable methodological contest over the Review\'s discounting assumptions.',
      sourceExternalId: 'src:nordhaus-2007-stern-review-jel',
    },
    update: {},
  })

  console.log('Enrichment complete: 1 transition upserted for claim', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
