// Enrichment: post-publication epistemic arc for the AlphaGo paper.
//
// Claim: cmplzseaj01odsa86wijprg3e (openalex_v1, W2257979135)
//   "Mastering the game of Go with deep neural networks and tree search" —
//   Silver D, Huang A, Maddison CJ, et al. Nature 2016;529(7587):484-489.
//   DOI 10.1038/nature16961. ~15,873 OpenAlex citations.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2016-01-26)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref):
//   - No retraction and no expression of concern. Crossref carries no
//     `update-to` record on 10.1038/nature16961; the paper is a foundational,
//     widely-cited empirical result, not a contested one.
//   - RECORDED -> SETTLED: the core finding — that a combination of deep neural
//     networks and Monte-Carlo tree search can master the game of Go at
//     superhuman strength — was decisively confirmed and generalized by the
//     follow-up paper "Mastering the game of Go without human knowledge"
//     (AlphaGo Zero; Silver D, Schrittwieser J, Simonyan K, et al. Nature
//     2017;550(7676):354-359, DOI 10.1038/nature24270). Trained tabula rasa by
//     self-play reinforcement learning with the same NN + tree-search paradigm,
//     AlphaGo Zero reached superhuman performance and defeated the original
//     AlphaGo of the 2016 paper 100 games to 0, vindicating and strengthening
//     the original claim in the expert literature. RECORDED -> SETTLED.
//
// No CONTESTED step is asserted: the finding never entered a genuine dispute in
// the literature; the arc is RECORDED straight to SETTLED via the confirming
// successor paper.
//
// Idempotent: upserts source on externalId and the status row on its
// deterministic slug id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-silver-2016-alphago-go.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplzseaj01odsa86wijprg3e'

async function main() {
  // ── RECORDED -> SETTLED: AlphaGo Zero (Nature 2017) confirms & extends ──
  const confirmSource = await prisma.source.upsert({
    where: { externalId: 'src:silver-2017-alphago-zero-nature' },
    create: {
      externalId: 'src:silver-2017-alphago-zero-nature',
      name: 'Silver D, Schrittwieser J, Simonyan K, et al. Mastering the game of Go without human knowledge. Nature 2017;550(7676):354-359. DOI 10.1038/nature24270.',
      url: 'https://doi.org/10.1038/nature24270',
      publishedAt: new Date('2017-10-18'),
      methodologyType: 'primary',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Silver D, Schrittwieser J, Simonyan K, et al. Mastering the game of Go without human knowledge. Nature 2017;550(7676):354-359. DOI 10.1038/nature24270.',
      url: 'https://doi.org/10.1038/nature24270',
      publishedAt: new Date('2017-10-18'),
      methodologyType: 'primary',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2017-10-18`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2017-10-18'),
      datePrecision: 'DAY',
      sourceId: confirmSource.id,
      reason:
        'The AlphaGo Zero paper (Silver et al., Nature 2017;550:354-359, DOI 10.1038/nature24270) decisively confirmed and generalized the 2016 finding that deep neural networks combined with tree search can master Go. Trained tabula rasa by self-play reinforcement learning, AlphaGo Zero reached superhuman strength and defeated the original 2016 AlphaGo 100 games to 0, vindicating the paradigm in the expert literature: RECORDED -> SETTLED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2017-10-18'),
      datePrecision: 'DAY',
      sourceId: confirmSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2017-10-18)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
