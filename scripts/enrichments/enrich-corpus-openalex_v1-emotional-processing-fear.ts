// Enrichment: post-publication epistemic trajectory for Foa & Kozak's
// Emotional Processing Theory of fear.
//
// Claim: Foa EB & Kozak MJ, "Emotional processing of fear: Exposure to
// corrective information," Psychological Bulletin 1986;99(1):20-35
// (DOI 10.1037/0033-2909.99.1.20, OpenAlex W2152676810). The baseline
// fromAxis=null -> RECORDED row (1986-01-01) already exists and is NOT
// re-created here.
//
// Post-publication event: Emotional Processing Theory (EPT) claimed that
// fear must be activated and that within- and between-session habituation
// are the mechanisms/indices by which exposure modifies fear structures.
// Craske et al., "Optimizing inhibitory learning during exposure therapy"
// (Behaviour Research and Therapy 2008;46(1):5-27, DOI 10.1016/j.brat.2007.10.003)
// directly contested this account, arguing that fear activation and
// habituation are neither necessary nor sufficient and that within-session
// fear reduction does not predict long-term outcome, proposing inhibitory
// learning as a competing mechanism. This challenge was developed further in
// Craske et al., "Maximizing exposure therapy: An inhibitory learning
// approach" (Behaviour Research and Therapy 2014;58:10-23,
// DOI 10.1016/j.brat.2014.04.006). This is a dated, citable theoretical/
// methodological critique of the mechanistic claim => RECORDED -> CONTESTED.
// No retraction and no adjudicating meta-analysis settling the mechanism was
// found, so the arc stops at CONTESTED.
//
// Idempotent: upserts on source externalId and ClaimStatusHistory id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-emotional-processing-fear.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmpm1d9ai06tpsadnmi5egofk'

async function main() {
  // ── RECORDED -> CONTESTED: inhibitory-learning critique (Craske et al., 2008) ──
  await prisma.source.upsert({
    where: { externalId: 'src:craske-inhibitory-learning-2008' },
    create: {
      externalId: 'src:craske-inhibitory-learning-2008',
      name: 'Craske MG, Kircanski K, Zelikowsky M, Mystkowski J, Chowdhury N, Baker A, "Optimizing inhibitory learning during exposure therapy," Behaviour Research and Therapy 2008;46(1):5-27',
      url: 'https://doi.org/10.1016/j.brat.2007.10.003',
      publishedAt: new Date('2008-01-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Craske MG, Kircanski K, Zelikowsky M, Mystkowski J, Chowdhury N, Baker A, "Optimizing inhibitory learning during exposure therapy," Behaviour Research and Therapy 2008;46(1):5-27',
      url: 'https://doi.org/10.1016/j.brat.2007.10.003',
      publishedAt: new Date('2008-01-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedId = `${claimId}-CONTESTED-2008-01-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2008-01-01'),
      datePrecision: 'MONTH',
      reason:
        'Craske et al. (Behaviour Research and Therapy 2008) contested the core mechanistic claim of Emotional Processing Theory, arguing that fear activation and within-/between-session habituation are neither necessary nor sufficient for lasting fear reduction and that within-session habituation does not predict long-term outcome. They advanced inhibitory learning as a competing account, a critique developed further in Craske et al. (2014). This constitutes a specific, dated, and heavily cited theoretical challenge to the finding.',
      sourceExternalId: 'src:craske-inhibitory-learning-2008',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2008-01-01'),
      datePrecision: 'MONTH',
      reason:
        'Craske et al. (Behaviour Research and Therapy 2008) contested the core mechanistic claim of Emotional Processing Theory, arguing that fear activation and within-/between-session habituation are neither necessary nor sufficient for lasting fear reduction and that within-session habituation does not predict long-term outcome. They advanced inhibitory learning as a competing account, a critique developed further in Craske et al. (2014). This constitutes a specific, dated, and heavily cited theoretical challenge to the finding.',
      sourceExternalId: 'src:craske-inhibitory-learning-2008',
    },
  })

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
