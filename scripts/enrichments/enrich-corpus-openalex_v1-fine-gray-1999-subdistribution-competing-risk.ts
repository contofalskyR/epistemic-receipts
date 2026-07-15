// Enrichment: post-publication epistemic arc for the 1999 Fine & Gray
// "A Proportional Hazards Model for the Subdistribution of a Competing Risk" paper.
//
// Claim: cmply6cst0149saih9sv5ru6r (openalex_v1, W2038981426)
//   "A Proportional Hazards Model for the Subdistribution of a Competing Risk"
//   — Fine JP, Gray RJ. Journal of the American Statistical Association 1999;94(446):496-509
//   (published 1999-06). DOI 10.1080/01621459.1999.10474144.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1999-06 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern. Crossref carries no update-to /
//     updated-by / relation markers; the DOI resolves (HTTP 403 -> Taylor & Francis
//     bot-block, i.e. the record exists behind a paywall). This is a statistical method,
//     not an empirical finding — its mathematical correctness was never overturned. What
//     the follow-up literature adjudicated was HOW the subdistribution (Fine-Gray) model
//     should be used and interpreted for competing-risks data.
//   - RECORDED -> CONTESTED (2013-06): Latouche A, Allignol A, Beyersmann J, Labopin M,
//     Fine J (an original author), "A competing risks analysis should report results on
//     all cause-specific hazards and cumulative incidence functions" (J. Clin. Epidemiol.
//     2013;66(6):648-653, DOI 10.1016/j.jclinepi.2012.09.017). The paper documented that the
//     Fine-Gray subdistribution model was frequently being applied and interpreted in
//     isolation, and argued this practice is insufficient and potentially misleading:
//     cause-specific hazards and cumulative incidence functions must BOTH be reported. This
//     is a specific, dated methodological caution against the standalone use the 1999 paper
//     enabled. Community EXPERT_LITERATURE.
//   - CONTESTED -> SETTLED (2016-02-09): Austin PC, Lee DS, Fine JP, "Introduction to the
//     Analysis of Survival Data in the Presence of Competing Risks" (Circulation
//     2016;133(6):601-609, DOI 10.1161/CIRCULATIONAHA.115.017719). This heavily-cited
//     (>2,000 Crossref citations) tutorial in a flagship clinical journal, co-authored by
//     Fine, consolidated the Fine-Gray subdistribution model as the standard recommended
//     approach for modeling covariate effects on the cumulative incidence function in
//     clinical competing-risks analysis — used alongside cause-specific hazard models as the
//     caution literature required. This resolved the "how to use it" dispute into settled
//     best practice. Community EXPERT_LITERATURE.
//
// Idempotent: upserts source on externalId and each status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-fine-gray-1999-subdistribution-competing-risk.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply6cst0149saih9sv5ru6r'

async function main() {
  // ── RECORDED -> CONTESTED: Latouche et al. 2013 caution against standalone subdistribution use ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:latouche-2013-competing-risks-report-all-hazards' },
    create: {
      externalId: 'src:latouche-2013-competing-risks-report-all-hazards',
      name: 'Latouche A, Allignol A, Beyersmann J, Labopin M, Fine J. A competing risks analysis should report results on all cause-specific hazards and cumulative incidence functions. Journal of Clinical Epidemiology 2013;66(6):648-653. DOI 10.1016/j.jclinepi.2012.09.017. PMID 23415868.',
      url: 'https://doi.org/10.1016/j.jclinepi.2012.09.017',
      publishedAt: new Date('2013-06-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Latouche A, Allignol A, Beyersmann J, Labopin M, Fine J. A competing risks analysis should report results on all cause-specific hazards and cumulative incidence functions. Journal of Clinical Epidemiology 2013;66(6):648-653. DOI 10.1016/j.jclinepi.2012.09.017. PMID 23415868.',
      url: 'https://doi.org/10.1016/j.jclinepi.2012.09.017',
      publishedAt: new Date('2013-06-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-2013-06-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-06-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
      reason:
        "Latouche, Allignol, Beyersmann, Labopin & Fine (an original author of the 1999 paper), 'A competing risks analysis should report results on all cause-specific hazards and cumulative incidence functions' (J. Clin. Epidemiol. 2013;66(6):648-653), documented that the Fine-Gray subdistribution model was widely being applied and interpreted in isolation and argued this is insufficient and potentially misleading — cause-specific hazards and cumulative incidence functions must both be reported. This dated methodological caution against the standalone use the 1999 method enabled moved the finding from recorded to contested: RECORDED -> CONTESTED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-06-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
    },
  })

  // ── CONTESTED -> SETTLED: Austin, Lee & Fine 2016 Circulation tutorial establishes standard practice ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:austin-lee-fine-2016-competing-risks-circulation' },
    create: {
      externalId: 'src:austin-lee-fine-2016-competing-risks-circulation',
      name: 'Austin PC, Lee DS, Fine JP. Introduction to the Analysis of Survival Data in the Presence of Competing Risks. Circulation 2016;133(6):601-609. DOI 10.1161/CIRCULATIONAHA.115.017719. PMID 26858290.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26858290/',
      publishedAt: new Date('2016-02-09'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Austin PC, Lee DS, Fine JP. Introduction to the Analysis of Survival Data in the Presence of Competing Risks. Circulation 2016;133(6):601-609. DOI 10.1161/CIRCULATIONAHA.115.017719. PMID 26858290.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26858290/',
      publishedAt: new Date('2016-02-09'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2016-02-09`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-02-09'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
      reason:
        "Austin, Lee & Fine, 'Introduction to the Analysis of Survival Data in the Presence of Competing Risks' (Circulation 2016;133(6):601-609), a heavily-cited (>2,000 citations) tutorial in a flagship clinical journal co-authored by Fine, consolidated the Fine-Gray subdistribution model as the standard recommended method for modeling covariate effects on the cumulative incidence function — used alongside cause-specific hazard models, as the 2013 caution literature required. This settled how the method should be used in clinical practice: CONTESTED -> SETTLED.",
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-02-09'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
    },
  })

  console.log(
    `Enriched claim ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED @ 2013-06 Latouche et al.; CONTESTED -> SETTLED @ 2016-02-09 Austin, Lee & Fine)`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
