// Enrichment: post-publication epistemic trajectory for
// Duncan, Dowsett, Claessens, Magnuson, et al. (2007),
// "School readiness and later achievement," Developmental Psychology 43(6):1428-1446.
// DOI 10.1037/0012-1649.43.6.1428. OpenAlex W2135731612.
// Claim id cmpm2iqxo0q71sadn3z183b0b.
//
// The baseline ClaimStatusHistory row (null -> RECORDED at 2007-11-01) already
// exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (EXPERT_LITERATURE, 2010-09, MONTH precision)
//     Pagani, Fitzpatrick, Archambault & Janosz (2010),
//     "School readiness and later achievement: A French Canadian replication
//     and extension," Developmental Psychology 46(5):984-994. DOI 10.1037/a0018881.
//     A direct, independent replication in the same flagship journal, using a
//     Quebec longitudinal birth cohort, confirmed Duncan et al.'s core finding
//     that school-entry cognitive/academic (math, reading) and attention skills
//     predict later school reading and math achievement after controlling for
//     prior skills and family background. Because the replication vindicated the
//     original predictive finding and there was no prior formal contest in the
//     literature, the transition goes RECORDED -> SETTLED directly.
//
// Idempotent: upserts on source.externalId and a deterministic history id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-duncan-school-readiness-later-achievement.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm2iqxo0q71sadn3z183b0b'

async function main() {
  // --- Source: Pagani et al. 2010 direct replication and extension ---
  const src = await prisma.source.upsert({
    where: { externalId: 'src:pagani-2010-school-readiness-replication' },
    create: {
      externalId: 'src:pagani-2010-school-readiness-replication',
      name: 'Pagani, Fitzpatrick, Archambault & Janosz (2010), School Readiness and Later Achievement: A French Canadian Replication and Extension, Developmental Psychology 46(5):984-994',
      url: 'https://doi.org/10.1037/a0018881',
      publishedAt: new Date('2010-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrichment',
    },
    update: {
      name: 'Pagani, Fitzpatrick, Archambault & Janosz (2010), School Readiness and Later Achievement: A French Canadian Replication and Extension, Developmental Psychology 46(5):984-994',
      url: 'https://doi.org/10.1037/a0018881',
      publishedAt: new Date('2010-09-01'),
      methodologyType: 'derivative',
    },
  })

  // --- Transition: RECORDED -> SETTLED ---
  const occurredAt = new Date('2010-09-01')
  const settledId = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        "Pagani, Fitzpatrick, Archambault & Janosz (2010, Developmental Psychology 46(5):984-994) published a direct, independent replication and extension of Duncan et al. (2007) in the same flagship journal, using a Quebec longitudinal birth cohort. They confirmed that school-entry academic (math, reading) and attention skills predict later reading and math achievement after controlling for prior skills and family background. With the core predictive finding independently reproduced and no prior formal contest in the literature, this vindicating replication settles the finding.",
      sourceId: src.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        "Pagani, Fitzpatrick, Archambault & Janosz (2010, Developmental Psychology 46(5):984-994) published a direct, independent replication and extension of Duncan et al. (2007) in the same flagship journal, using a Quebec longitudinal birth cohort. They confirmed that school-entry academic (math, reading) and attention skills predict later reading and math achievement after controlling for prior skills and family background. With the core predictive finding independently reproduced and no prior formal contest in the literature, this vindicating replication settles the finding.",
      sourceId: src.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: RECORDED -> SETTLED (Pagani et al. 2010 replication)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
