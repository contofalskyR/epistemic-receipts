import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Bandura, A. (2004), "Health Promotion by Social Cognitive Means,"
//   Health Education & Behavior 31(2): 143-164.
//   DOI: 10.1177/1090198104263660 · OpenAlex: W2111591671
//
// Baseline row (fromAxis=null -> RECORDED at 2004-04-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2016-11): Sheeran, Maki, Montanaro et al. meta-analysis
//   ("The impact of changing attitudes, norms, and self-efficacy on
//   health-related intentions and behavior: A meta-analysis," Health Psychology
//   35(11): 1178-1188, DOI 10.1037/hea0000387). By pooling EXPERIMENTAL studies
//   that manipulated self-efficacy, the meta-analysis showed that inducing
//   changes in self-efficacy produced corresponding changes in health-related
//   intentions and behavior — directly adjudicating Bandura's central causal
//   claim that self-efficacy is a common pathway through which psychosocial
//   influences affect health functioning. No prior contest existed, so the arc
//   is a straight vindication: RECORDED -> SETTLED, not via CONTESTED.

const CLAIM_ID = 'cmplxkzfv006jsa7f2cmrpw3y'

async function main() {
  // ── RECORDED -> SETTLED: Sheeran et al. (2016) experimental meta-analysis ──
  const sheeran = await prisma.source.upsert({
    where: { externalId: 'src:sheeran-2016-self-efficacy-health-meta-analysis' },
    create: {
      externalId: 'src:sheeran-2016-self-efficacy-health-meta-analysis',
      name: 'Sheeran, P., Maki, A., Montanaro, E., Avishai-Yitshak, A., Bryan, A., Klein, W. M. P., Miles, E., & Rothman, A. J. (2016). "The impact of changing attitudes, norms, and self-efficacy on health-related intentions and behavior: A meta-analysis." Health Psychology 31(2)... 35(11): 1178-1188.',
      url: 'https://doi.org/10.1037/hea0000387',
      publishedAt: new Date('2016-11-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-bandura-2004-health-promotion',
    },
    update: {
      name: 'Sheeran, P., Maki, A., Montanaro, E., Avishai-Yitshak, A., Bryan, A., Klein, W. M. P., Miles, E., & Rothman, A. J. (2016). "The impact of changing attitudes, norms, and self-efficacy on health-related intentions and behavior: A meta-analysis." Health Psychology 35(11): 1178-1188.',
      url: 'https://doi.org/10.1037/hea0000387',
      publishedAt: new Date('2016-11-01'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2016-11-01`
  const reason = 'Sheeran, Maki, Montanaro and colleagues (2016) meta-analyzed experimental studies that directly manipulated self-efficacy (alongside attitudes and norms) and found that inducing changes in self-efficacy produced corresponding medium-sized changes in health-related intentions and smaller but reliable changes in behavior. Because it pools randomized experiments rather than correlational designs, the review adjudicates Bandura\'s core causal claim that self-efficacy is a common pathway through which psychosocial influences affect health functioning — vindicating rather than overturning it. No prior scholarly contest was on record, so the finding moves directly from RECORDED to SETTLED.'
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-11-01'),
      datePrecision: 'MONTH',
      reason,
      sourceId: sheeran.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-11-01'),
      datePrecision: 'MONTH',
      reason,
      sourceId: sheeran.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: sheeran.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: sheeran.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via Sheeran et al. 2016 meta-analysis)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
