// Enrichment: post-publication epistemic arc for the ARDS Network (ARMA) trial,
// "Ventilation with Lower Tidal Volumes as Compared with Traditional Tidal Volumes
//  for Acute Lung Injury and the Acute Respiratory Distress Syndrome."
//
// Claim: cmply4uwf00drsaihsbtjls8k (openalex_v1, W2597070792)
//   The Acute Respiratory Distress Syndrome Network. N Engl J Med 2000;342(18):1301-1308.
//   DOI 10.1056/NEJM200005043421801. PMID 10793162.
//   (Identity confirmed via Crossref + PubMed esummary: title, container "New England
//    Journal of Medicine", issued 2000-05-04 all match the claim + OpenAlex ID.)
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2000-05-04) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref + NCBI eutils):
//   - No retraction and no expression of concern on the trial (Crossref update-to: none).
//
//   - RECORDED -> CONTESTED: Eichacker PQ, Gerstenberger EP, Banks SM, Cui X, Natanson C.
//     "Meta-Analysis of Acute Lung Injury and Acute Respiratory Distress Syndrome Trials
//     Testing Low Tidal Volumes." Am J Respir Crit Care Med 2002;166(11):1510-1514.
//     DOI 10.1164/rccm.200208-956OC. PMID 12406836. A specific, dated methodological
//     critique: pooling the five randomized low-tidal-volume trials, the authors argued
//     the observed mortality benefit was driven by harm in the high-tidal-volume control
//     arms (the ARMA control used 12 ml/kg, above then-usual practice) rather than by
//     benefit of the low-volume arm, i.e. that ARMA's control ventilation was itself
//     injurious. This opened a sustained expert dispute over the ARMA control strategy.
//
//   - CONTESTED -> SETTLED: Petrucci N, De Feo C. "Lung protective ventilation strategy
//     for the acute respiratory distress syndrome." Cochrane Database Syst Rev 2013,
//     Issue 2, Art. No. CD003844 (pub4). DOI 10.1002/14651858.CD003844.pub4. PMID 23450544.
//     The Cochrane systematic review adjudicated the question the Eichacker/Natanson
//     critique raised, finding lower tidal volume / lung-protective ventilation reduces
//     28-day and hospital mortality in ARDS. The finding was subsequently institutionalized
//     as a strong recommendation in the 2017 ATS/ESICM/SCCM clinical practice guideline
//     (DOI 10.1164/rccm.201703-0548ST, PMID 28459336), making low tidal volume ventilation
//     standard of care.
//
// URLs use PubMed permalinks (all verified HTTP 200 on 2026-07-15); the publisher DOIs
// are registered/resolving (confirmed via Crossref API) but bot-block direct curl (403).
//
// Idempotent: upserts source on externalId and each status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ardsnet-2000-low-tidal-volume-ventilation.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply4uwf00drsaihsbtjls8k'

async function main() {
  // ── RECORDED -> CONTESTED: Eichacker/Natanson meta-analysis critique (2002) ──
  const critiqueSource = await prisma.source.upsert({
    where: { externalId: 'src:eichacker-natanson-2002-low-tidal-volume-meta-analysis' },
    create: {
      externalId: 'src:eichacker-natanson-2002-low-tidal-volume-meta-analysis',
      name: 'Eichacker PQ, Gerstenberger EP, Banks SM, Cui X, Natanson C. Meta-Analysis of Acute Lung Injury and ARDS Trials Testing Low Tidal Volumes. Am J Respir Crit Care Med 2002;166(11):1510-1514. DOI 10.1164/rccm.200208-956OC. PMID 12406836.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/12406836/',
      publishedAt: new Date('2002-12-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Eichacker PQ, Gerstenberger EP, Banks SM, Cui X, Natanson C. Meta-Analysis of Acute Lung Injury and ARDS Trials Testing Low Tidal Volumes. Am J Respir Crit Care Med 2002;166(11):1510-1514. DOI 10.1164/rccm.200208-956OC. PMID 12406836.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/12406836/',
      publishedAt: new Date('2002-12-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-2002-12-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2002-12-01'),
      datePrecision: 'DAY',
      sourceId: critiqueSource.id,
      reason:
        'Eichacker, Natanson and colleagues (Am J Respir Crit Care Med 2002;166(11):1510-1514) pooled the randomized low-tidal-volume trials and argued the mortality benefit reflected harm in the high-tidal-volume control arms rather than benefit of the low-volume arm — specifically that the ARMA trial\u2019s 12 ml/kg control ventilation was itself injurious and above usual practice. This opened a sustained methodological dispute over ARMA\u2019s control strategy: RECORDED -> CONTESTED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2002-12-01'),
      datePrecision: 'DAY',
      sourceId: critiqueSource.id,
    },
  })

  // ── CONTESTED -> SETTLED: Cochrane systematic review (2013) ──
  const cochraneSource = await prisma.source.upsert({
    where: { externalId: 'src:cochrane-cd003844-pub4-lung-protective-ventilation-2013' },
    create: {
      externalId: 'src:cochrane-cd003844-pub4-lung-protective-ventilation-2013',
      name: 'Petrucci N, De Feo C. Lung protective ventilation strategy for the acute respiratory distress syndrome. Cochrane Database Syst Rev 2013, Issue 2, Art. No. CD003844.pub4. DOI 10.1002/14651858.CD003844.pub4. PMID 23450544.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23450544/',
      publishedAt: new Date('2013-02-28'),
      methodologyType: 'meta-analysis',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Petrucci N, De Feo C. Lung protective ventilation strategy for the acute respiratory distress syndrome. Cochrane Database Syst Rev 2013, Issue 2, Art. No. CD003844.pub4. DOI 10.1002/14651858.CD003844.pub4. PMID 23450544.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23450544/',
      publishedAt: new Date('2013-02-28'),
      methodologyType: 'meta-analysis',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2013-02-28`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-02-28'),
      datePrecision: 'DAY',
      sourceId: cochraneSource.id,
      reason:
        'The Cochrane systematic review (Petrucci & De Feo, CD003844.pub4, 2013) adjudicated the efficacy question the Eichacker/Natanson critique had raised, concluding that lung-protective, lower-tidal-volume ventilation reduces mortality in ARDS. Low tidal volume ventilation was subsequently made a strong recommendation in the 2017 ATS/ESICM/SCCM clinical practice guideline (DOI 10.1164/rccm.201703-0548ST), establishing it as standard of care: CONTESTED -> SETTLED.',
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-02-28'),
      datePrecision: 'DAY',
      sourceId: cochraneSource.id,
    },
  })

  console.log(
    `Enriched claim ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED @ 2002-12-01; CONTESTED -> SETTLED @ 2013-02-28)`,
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
