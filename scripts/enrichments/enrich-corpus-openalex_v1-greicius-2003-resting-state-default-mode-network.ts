import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Greicius, M. D., Krasnow, B., Reiss, A. L., & Menon, V. (2003), "Functional
//   connectivity in the resting brain: A network analysis of the default mode
//   hypothesis," Proc. Natl. Acad. Sci. USA 100(1): 253-258.
//   DOI: 10.1073/pnas.0135058100 · OpenAlex: W2133903921
//
// Baseline row (fromAxis=null -> RECORDED at 2002-12-27) already exists; NOT duplicated here.
//
// Post-publication arc added (verified via Crossref + DOI.org / PubMed resolution):
//   RECORDED -> CONTESTED (2012-02): Power, Barnes, Snyder, Schlaggar & Petersen,
//     "Spurious but systematic correlations in functional connectivity MRI
//     networks arise from subject motion," NeuroImage 59(3): 2142-2154
//     (DOI 10.1016/j.neuroimage.2011.10.018). This landmark methodological
//     critique showed that small subject head motion produces systematic,
//     distance-dependent artifacts in resting-state functional-connectivity
//     estimates — the exact class of measurement (temporal correlation among
//     resting BOLD signals) that Greicius et al. used to argue for a coherent
//     default-mode network. It forced the field to treat existing resting-state
//     network results, including DMN connectivity, as potentially confounded
//     until re-analyzed with motion "scrubbing."
//   CONTESTED -> SETTLED (2015-07-08): Raichle, "The Brain's Default Mode
//     Network," Annu. Rev. Neurosci. 38: 433-447
//     (DOI 10.1146/annurev-neuro-071013-014030). After motion-artifact concerns
//     were addressed with scrubbing/censoring and the DMN was recovered across
//     acquisition sites, species, and methods, this authoritative Annual Review
//     synthesis by the originator of the default-mode concept consolidated the
//     resting-state DMN as an established, robustly replicated feature of brain
//     organization — settling the hypothesis Greicius et al. set out to test.

const CLAIM_ID = 'cmplxxf0m0657sa7f2d2kr467'

async function main() {
  // ── RECORDED -> CONTESTED: Power et al. (2012) motion-artifact critique ──
  const power = await prisma.source.upsert({
    where: { externalId: 'src:power-2012-motion-fcmri-artifacts' },
    create: {
      externalId: 'src:power-2012-motion-fcmri-artifacts',
      name: 'Power, J. D., Barnes, K. A., Snyder, A. Z., Schlaggar, B. L., & Petersen, S. E. (2012). "Spurious but systematic correlations in functional connectivity MRI networks arise from subject motion." NeuroImage 59(3): 2142-2154.',
      url: 'https://doi.org/10.1016/j.neuroimage.2011.10.018',
      publishedAt: new Date('2012-02-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-greicius-2003-resting-state-default-mode-network',
    },
    update: {
      name: 'Power, J. D., Barnes, K. A., Snyder, A. Z., Schlaggar, B. L., & Petersen, S. E. (2012). "Spurious but systematic correlations in functional connectivity MRI networks arise from subject motion." NeuroImage 59(3): 2142-2154.',
      url: 'https://doi.org/10.1016/j.neuroimage.2011.10.018',
      publishedAt: new Date('2012-02-01'),
    },
  })

  const contestedId = `${CLAIM_ID}-CONTESTED-2012-02-01`
  const contestedReason = 'Power et al. (NeuroImage, 2012) demonstrated that small amounts of subject head motion introduce systematic, distance-dependent spurious correlations into resting-state functional-connectivity MRI — the precise temporal-correlation measure Greicius et al. used to infer a coherent default-mode network. The finding forced the field to regard existing resting-state network results, DMN connectivity included, as potentially confounded until re-analyzed with motion scrubbing, placing the default-mode-network claim into active methodological contest within the expert literature.'
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2012-02-01'),
      datePrecision: 'MONTH',
      reason: contestedReason,
      sourceId: power.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2012-02-01'),
      datePrecision: 'MONTH',
      reason: contestedReason,
      sourceId: power.id,
    },
  })

  const powerEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: power.id } })
  if (!powerEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: power.id, type: 'AGAINST' } })
  }

  // ── CONTESTED -> SETTLED: Raichle (2015) Annual Review consensus synthesis ──
  const raichle = await prisma.source.upsert({
    where: { externalId: 'src:raichle-2015-default-mode-network-review' },
    create: {
      externalId: 'src:raichle-2015-default-mode-network-review',
      name: 'Raichle, M. E. (2015). "The Brain\'s Default Mode Network." Annual Review of Neuroscience 38: 433-447.',
      url: 'https://doi.org/10.1146/annurev-neuro-071013-014030',
      publishedAt: new Date('2015-07-08'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-greicius-2003-resting-state-default-mode-network',
    },
    update: {
      name: 'Raichle, M. E. (2015). "The Brain\'s Default Mode Network." Annual Review of Neuroscience 38: 433-447.',
      url: 'https://doi.org/10.1146/annurev-neuro-071013-014030',
      publishedAt: new Date('2015-07-08'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2015-07-08`
  const settledReason = 'After the motion-artifact concern was addressed with scrubbing/censoring methods and the default-mode network was recovered across sites, acquisition methods, and even species, Raichle\'s "The Brain\'s Default Mode Network" (Annual Review of Neuroscience, 2015) — an authoritative synthesis by the originator of the default-mode concept — consolidated the resting-state DMN as an established, robustly replicated feature of brain organization. This settled the very hypothesis Greicius et al. set out to test: that PCC/vACC and related regions form an intrinsically connected network supporting a default mode of brain function.'
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2015-07-08'),
      datePrecision: 'DAY',
      reason: settledReason,
      sourceId: raichle.id,
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2015-07-08'),
      datePrecision: 'DAY',
      reason: settledReason,
      sourceId: raichle.id,
    },
  })

  const raichleEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: raichle.id } })
  if (!raichleEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: raichle.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED via Power et al. 2012; CONTESTED -> SETTLED via Raichle 2015)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
