import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Downs JR, Clearfield M, Weis S, et al. / AFCAPS/TexCAPS Research Group (1998),
//   "Primary Prevention of Acute Coronary Events with Lovastatin in Men and Women
//   with Average Cholesterol Levels. Results of AFCAPS/TexCAPS."
//   JAMA 1998;279(20):1615-1622. DOI: 10.1001/jama.279.20.1615 ·
//   OpenAlex: W2129750583 · PMID 9613910 · published 1998-05-27
//
// The baseline row (fromAxis=null -> RECORDED at 1998-05-27, the JAMA publication)
// already exists and is NOT duplicated here.
//
// Not retracted / no expression of concern: verified via PubMed (single record,
// PMID 9613910) and CrossRef; no RETRACTS/CORRECTED metadata.
//
// Post-publication arc added (two steps):
//
//   RECORDED -> CONTESTED (2011-01-19): AFCAPS/TexCAPS made the specific claim
//     that LDL-lowering benefit extends to PRIMARY-prevention individuals with
//     AVERAGE cholesterol, women, and older persons — i.e. to a low-risk
//     population. That extension to low-risk primary prevention was genuinely
//     contested by the Cochrane systematic review "Statins for the primary
//     prevention of cardiovascular disease" (Taylor F, Ward K, Moore TH, et al.,
//     Cochrane Database Syst Rev 2011;(1):CD004816, DOI 10.1002/14651858.CD004816.pub4,
//     published online 19 January 2011). The review found only limited evidence of
//     benefit in low-risk populations, flagged evidence of selective outcome
//     reporting and potential bias, and concluded caution should be taken in
//     prescribing statins for primary prevention among people at low cardiovascular
//     risk. Community: EXPERT_LITERATURE. Precision: DAY (online publication date).
//
//   CONTESTED -> SETTLED (2012-08): The low-risk primary-prevention question was
//     adjudicated by the Cholesterol Treatment Trialists' (CTT) Collaboration
//     individual-participant meta-analysis "The effects of lowering LDL cholesterol
//     with statin therapy in people at low risk of vascular disease: meta-analysis
//     of individual data from 27 randomised trials" (Lancet 2012;380(9841):581-590,
//     DOI 10.1016/S0140-6736(12)60367-5). It showed that even in individuals with a
//     5-year major-vascular-event risk below 10%, each 1 mmol/L LDL reduction
//     produced a significant absolute reduction in major vascular events with
//     benefits greatly exceeding known hazards — settling the low-risk /
//     primary-prevention benefit AFCAPS/TexCAPS had asserted (AFCAPS/TexCAPS was
//     itself among the trials contributing data). Community: EXPERT_LITERATURE.
//     Precision: MONTH (CrossRef records issue month 2012-08).

const CLAIM_ID = 'cmplyc77c03x9saihfmzyq0kp'

async function main() {
  // ── RECORDED -> CONTESTED: 2011 Cochrane review questions low-risk primary prevention ──
  const cochrane = await prisma.source.upsert({
    where: { externalId: 'src:cochrane-2011-statins-primary-prevention-cd004816-pub4' },
    create: {
      externalId: 'src:cochrane-2011-statins-primary-prevention-cd004816-pub4',
      name: 'Taylor F, Ward K, Moore THM, Burke M, Davey Smith G, Casas J-P, Ebrahim S (2011). "Statins for the primary prevention of cardiovascular disease." Cochrane Database of Systematic Reviews 2011, Issue 1, Art. No. CD004816. (Found only limited evidence of benefit in low-risk populations; flagged selective outcome reporting; urged caution in prescribing statins for primary prevention among low-risk people.)',
      url: 'https://doi.org/10.1002/14651858.CD004816.pub4',
      publishedAt: new Date('2011-01-19'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-afcaps-texcaps-1998-lovastatin',
    },
    update: {
      name: 'Taylor F, Ward K, Moore THM, Burke M, Davey Smith G, Casas J-P, Ebrahim S (2011). "Statins for the primary prevention of cardiovascular disease." Cochrane Database of Systematic Reviews 2011, Issue 1, Art. No. CD004816. (Found only limited evidence of benefit in low-risk populations; flagged selective outcome reporting; urged caution in prescribing statins for primary prevention among low-risk people.)',
      url: 'https://doi.org/10.1002/14651858.CD004816.pub4',
      publishedAt: new Date('2011-01-19'),
    },
  })

  const contestedId = `${CLAIM_ID}-CONTESTED-2011-01-19`
  const contestedReason = 'AFCAPS/TexCAPS claimed that LDL-lowering benefit extends to primary-prevention individuals with average cholesterol, women, and older persons — a low-risk population. The 2011 Cochrane systematic review "Statins for the primary prevention of cardiovascular disease" (Taylor et al., CD004816.pub4, published online 19 January 2011) directly contested that extension: it found only limited evidence of benefit in low-risk populations, identified evidence of selective outcome reporting and potential bias, and concluded that caution should be taken in prescribing statins for primary prevention among people at low cardiovascular risk. This is a dated, citable expert-literature challenge to the finding.'
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2011-01-19'),
      datePrecision: 'DAY',
      reason: contestedReason,
      sourceId: cochrane.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2011-01-19'),
      datePrecision: 'DAY',
      reason: contestedReason,
      sourceId: cochrane.id,
    },
  })

  const cochraneEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: cochrane.id } })
  if (!cochraneEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: cochrane.id, type: 'AGAINST' } })
  }

  // ── CONTESTED -> SETTLED: CTT 2012 low-risk meta-analysis adjudicates primary-prevention benefit ──
  const ctt = await prisma.source.upsert({
    where: { externalId: 'src:ctt-2012-lancet-statin-low-risk-meta-analysis' },
    create: {
      externalId: 'src:ctt-2012-lancet-statin-low-risk-meta-analysis',
      name: 'Cholesterol Treatment Trialists\' (CTT) Collaborators (2012). "The effects of lowering LDL cholesterol with statin therapy in people at low risk of vascular disease: meta-analysis of individual data from 27 randomised trials." Lancet 380(9841):581-590. (Showed net benefit of statins even in individuals at <10% 5-year vascular risk; benefits greatly exceed known hazards.)',
      url: 'https://doi.org/10.1016/S0140-6736(12)60367-5',
      publishedAt: new Date('2012-08-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-afcaps-texcaps-1998-lovastatin',
    },
    update: {
      name: 'Cholesterol Treatment Trialists\' (CTT) Collaborators (2012). "The effects of lowering LDL cholesterol with statin therapy in people at low risk of vascular disease: meta-analysis of individual data from 27 randomised trials." Lancet 380(9841):581-590. (Showed net benefit of statins even in individuals at <10% 5-year vascular risk; benefits greatly exceed known hazards.)',
      url: 'https://doi.org/10.1016/S0140-6736(12)60367-5',
      publishedAt: new Date('2012-08-01'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2012-08-01`
  const settledReason = 'The contested question — whether the LDL-lowering benefit AFCAPS/TexCAPS reported truly extends to low-risk primary-prevention individuals — was adjudicated by the Cholesterol Treatment Trialists\' (CTT) Collaboration individual-participant meta-analysis of 27 randomised trials (Lancet 2012;380(9841):581-590). It demonstrated that even in people with a 5-year major-vascular-event risk below 10%, each 1 mmol/L LDL-cholesterol reduction produced a significant absolute reduction in major vascular events, with benefits greatly exceeding any known hazards. This settled the low-risk / primary-prevention benefit in favour of the AFCAPS/TexCAPS finding (AFCAPS/TexCAPS was among the contributing trials). CrossRef records only the issue month, so precision is MONTH.'
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2012-08-01'),
      datePrecision: 'MONTH',
      reason: settledReason,
      sourceId: ctt.id,
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2012-08-01'),
      datePrecision: 'MONTH',
      reason: settledReason,
      sourceId: ctt.id,
    },
  })

  const cttEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: ctt.id } })
  if (!cttEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: ctt.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED via Cochrane 2011, 2011-01-19; CONTESTED -> SETTLED via CTT 2012 low-risk meta-analysis, 2012-08)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
