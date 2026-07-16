// Enrichment: post-publication trajectory for Green (1995),
// "Reversible jump Markov chain Monte Carlo computation and Bayesian model
// determination", Biometrika 82(4):711–732. DOI 10.1093/biomet/82.4.711.
// OpenAlex W2106706098. Claim id cmq2w5aw400srsa8hannzi48o.
//
// Baseline row (fromAxis=null -> RECORDED at 1995-01-01) already exists; do NOT
// duplicate it. This script adds the single verified post-publication event.
//
// Finding: No retraction, expression of concern, or contest exists — RJMCMC is a
// foundational statistical-methods framework, not an empirical result subject to
// replication. Its post-publication trajectory is canonization. The method was
// established as the standard framework for trans-dimensional / variable-dimension
// Bayesian inference in the field's reference handbook, the "Handbook of Markov
// Chain Monte Carlo" (S. Brooks, A. Gelman, G. Jones, X.-L. Meng, eds.; Chapman &
// Hall/CRC, published 2011-05-10, DOI 10.1201/b10905), which devotes a dedicated
// review chapter to reversible jump MCMC ("Reversible jump Markov chain Monte Carlo
// and multi-model samplers", Fan & Sisson). This is a textbook/expert-literature
// consensus event: RECORDED -> SETTLED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-green-1995-reversible-jump-mcmc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-green-1995-reversible-jump-mcmc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w5aw400srsa8hannzi48o'

async function main() {
  if (DRY_RUN) {
    console.log('[dry-run] would upsert 1 source and 1 claimStatusHistory transition for', CLAIM_ID)
    await prisma.$disconnect()
    return
  }

  // ── Source: Handbook of Markov Chain Monte Carlo (2011) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:handbook-mcmc-2011-rjmcmc-chapter' },
    create: {
      externalId: 'src:handbook-mcmc-2011-rjmcmc-chapter',
      name: 'Brooks S, Gelman A, Jones G, Meng X-L (eds). Handbook of Markov Chain Monte Carlo. Chapman & Hall/CRC, 2011 — dedicated review chapter "Reversible jump Markov chain Monte Carlo and multi-model samplers" (Fan & Sisson).',
      url: 'https://doi.org/10.1201/b10905',
      publishedAt: new Date('2011-05-10'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-green-1995-rjmcmc',
    },
    update: {
      name: 'Brooks S, Gelman A, Jones G, Meng X-L (eds). Handbook of Markov Chain Monte Carlo. Chapman & Hall/CRC, 2011 — dedicated review chapter "Reversible jump Markov chain Monte Carlo and multi-model samplers" (Fan & Sisson).',
      url: 'https://doi.org/10.1201/b10905',
      publishedAt: new Date('2011-05-10'),
      methodologyType: 'derivative',
    },
  })

  // ── Transition: RECORDED -> SETTLED (textbook/expert-literature consensus) ──
  const occurredAt = new Date('2011-05-10')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'Green\'s reversible jump MCMC was canonized as the standard framework for trans-dimensional / variable-dimension Bayesian model determination in the field\'s reference "Handbook of Markov Chain Monte Carlo" (Chapman & Hall/CRC, 2011), which devotes a dedicated review chapter to reversible jump MCMC and multi-model samplers. The method had no retraction or methodological contest; its trajectory is one of settled adoption as textbook/expert-literature consensus.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      sourceId: source.id,
    },
  })

  console.log('Upserted 1 transition (RECORDED -> SETTLED, 2011-05-10) for', CLAIM_ID)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
