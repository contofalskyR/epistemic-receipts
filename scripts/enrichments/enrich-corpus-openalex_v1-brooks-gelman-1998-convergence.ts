// Enrichment: post-publication epistemic trajectory for Brooks & Gelman (1998),
// "General Methods for Monitoring Convergence of Iterative Simulations,"
// Journal of Computational and Graphical Statistics, DOI 10.1080/10618600.1998.10474787
// OpenAlex W2093223772. Claim id: cmq2w58ep00r9sa8hx06tghwd.
//
// Baseline row (fromAxis=null -> RECORDED at 1998-12) already exists; NOT duplicated here.
//
// Added arc:
//   RECORDED -> CONTESTED (2021-06): Vehtari, Gelman, Simpson, Carpenter & Bürkner
//   demonstrate that the original Gelman-Rubin / Brooks-Gelman R-hat convergence
//   diagnostic can fail to detect non-convergence (e.g. chains with equal means but
//   unequal variances, or infinite-variance targets) and propose a rank-normalized,
//   folded replacement. A dated, peer-reviewed methodological critique in expert
//   literature — the diagnostic's adequacy is disputed, not retracted or overturned.
//
// Idempotent: upserts on externalId / id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-brooks-gelman-1998-convergence.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-brooks-gelman-1998-convergence.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w58ep00r9sa8hx06tghwd'

async function main() {
  // ── RECORDED -> CONTESTED : improved-R-hat critique (Vehtari et al. 2021) ──
  const sourceExternalId = 'src:vehtari-2021-improved-rhat'
  const sourceData = {
    name: 'Vehtari A, Gelman A, Simpson D, Carpenter B, Bürkner P-C. Rank-Normalization, Folding, and Localization: An Improved R̂ for Assessing Convergence of MCMC (with Discussion). Bayesian Analysis 2021;16(2):667–718.',
    url: 'https://doi.org/10.1214/20-BA1221',
    publishedAt: new Date('2021-06-01'),
    methodologyType: 'primary',
  }

  const occurredAt = new Date('2021-06-01')
  const historyId = `${CLAIM_ID}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`

  const historyData = {
    claimId: CLAIM_ID,
    fromAxis: 'RECORDED' as const,
    toAxis: 'CONTESTED' as const,
    community: 'EXPERT_LITERATURE' as const,
    occurredAt,
    datePrecision: 'MONTH' as const,
    reason:
      'Vehtari, Gelman (an original co-author), Simpson, Carpenter and Bürkner show that the classic Gelman-Rubin / Brooks-Gelman R̂ can fail to diagnose non-convergence — for example when chains share a common mean but differ in variance, or when the target has heavy/infinite-variance tails — yielding false confidence in mixing. They propose a rank-normalized, folded, localized replacement. A dated peer-reviewed critique establishing that the diagnostic\'s adequacy is contested in expert literature.',
  }

  if (DRY_RUN) {
    console.log('[dry-run] would upsert source:', sourceExternalId)
    console.log('[dry-run] would upsert claimStatusHistory:', historyId)
    console.log(JSON.stringify({ source: sourceData, history: historyData }, null, 2))
    await prisma.$disconnect()
    return
  }

  await prisma.source.upsert({
    where: { externalId: sourceExternalId },
    create: { externalId: sourceExternalId, ...sourceData },
    update: sourceData,
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: historyId },
    create: { id: historyId, ...historyData },
    update: historyData,
  })

  console.log('Upserted source + claimStatusHistory:', historyId)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
