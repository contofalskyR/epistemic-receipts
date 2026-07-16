// Enrichment: post-publication epistemic trajectory for
// Bradley & Corwyn (2002), "Socioeconomic Status and Child Development,"
// Annual Review of Psychology 53:371-399. DOI 10.1146/annurev.psych.53.100901.135233
// OpenAlex W2171357886. Claim id cmplxters0497sa7fc4r0vmgm.
//
// The baseline ClaimStatusHistory row (null -> RECORDED at 2002-02-01) already
// exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (EXPERT_LITERATURE, 2005 Q3)
//     Sirin (2005), "Socioeconomic Status and Academic Achievement: A
//     Meta-Analytic Review of Research," Review of Educational Research
//     75(3):417-453. A meta-analysis of 74 independent samples (101,157
//     students) quantified and vindicated the SES–cognitive/achievement
//     association the review documented, reporting a medium-to-strong
//     SES–achievement relation and replicating White (1982). No prior contest
//     existed, so the transition goes RECORDED -> SETTLED directly.
//
// Idempotent: upserts on source.externalId and a deterministic history id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bradley-corwyn-ses-child-development.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxters0497sa7fc4r0vmgm'

async function main() {
  // --- Source: Sirin 2005 meta-analysis ---
  const src = await prisma.source.upsert({
    where: { externalId: 'src:sirin-2005-ses-achievement-meta-analysis' },
    create: {
      externalId: 'src:sirin-2005-ses-achievement-meta-analysis',
      name: 'Sirin (2005), Socioeconomic Status and Academic Achievement: A Meta-Analytic Review of Research, Review of Educational Research 75(3):417-453',
      url: 'https://doi.org/10.3102/00346543075003417',
      publishedAt: new Date('2005-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrichment',
    },
    update: {
      name: 'Sirin (2005), Socioeconomic Status and Academic Achievement: A Meta-Analytic Review of Research, Review of Educational Research 75(3):417-453',
      url: 'https://doi.org/10.3102/00346543075003417',
      publishedAt: new Date('2005-09-01'),
      methodologyType: 'derivative',
    },
  })

  // --- Transition: RECORDED -> SETTLED ---
  const occurredAt = new Date('2005-09-01')
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
      datePrecision: 'QUARTER',
      reason:
        "Sirin's 2005 meta-analysis in Review of Educational Research pooled 74 independent samples (101,157 students) and reported a medium-to-strong SES–achievement relation, quantifying and vindicating the cognitive/achievement portion of the review's claim. It also replicated White (1982), confirming the association had persisted across decades. With no prior contest in the literature, this adjudicating review settles the finding.",
      sourceId: src.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'QUARTER',
      reason:
        "Sirin's 2005 meta-analysis in Review of Educational Research pooled 74 independent samples (101,157 students) and reported a medium-to-strong SES–achievement relation, quantifying and vindicating the cognitive/achievement portion of the review's claim. It also replicated White (1982), confirming the association had persisted across decades. With no prior contest in the literature, this adjudicating review settles the finding.",
      sourceId: src.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: RECORDED -> SETTLED (Sirin 2005)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
