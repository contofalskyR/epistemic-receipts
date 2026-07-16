import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   The LIPID Study Group (1998), "Prevention of Cardiovascular Events and Death
//   with Pravastatin in Patients with Coronary Heart Disease and a Broad Range of
//   Initial Cholesterol Levels." N Engl J Med 1998;339:1349-1357.
//   DOI: 10.1056/nejm199811053391902 · OpenAlex: W38523360 · published 1998-11-05
//
// Baseline row (fromAxis=null -> RECORDED at 1998-11-05, the NEJM publication)
// already exists; NOT duplicated here.
//
// Post-publication arc added (single terminal step):
//   RECORDED -> SETTLED (2005-10-08): The LIPID paper's own framing was that
//     cholesterol-lowering reduces coronary EVENTS, but "the effects on mortality
//     from coronary heart disease and overall mortality have remained uncertain."
//     That specific uncertainty was adjudicated by the Cholesterol Treatment
//     Trialists' (CTT) Collaboration prospective individual-participant meta-analysis
//     of 90,056 participants across 14 randomised statin trials — which INCLUDED the
//     LIPID trial — published in The Lancet (Baigent et al., Lancet 2005;366:1267-1278,
//     DOI 10.1016/S0140-6736(05)67394-1). The CTT meta-analysis demonstrated that
//     statin therapy produces a highly significant reduction in all-cause mortality
//     (~12% per mmol/L LDL reduction) and coronary mortality, resolving the residual
//     mortality question the LIPID paper had raised. No retraction or expression of
//     concern exists (verified via CrossRef and DOI resolution).
//     Terminal state: SETTLED. Community: EXPERT_LITERATURE.
//   Precision: DAY — The Lancet issue 366(9493) carries the dated cover date
//     8 October 2005 (CrossRef records the month; the issue date is the citable day).

const CLAIM_ID = 'cmply5vxu00w9saihwagyc07v'

async function main() {
  // ── RECORDED -> SETTLED: CTT Collaboration 2005 meta-analysis adjudicates mortality benefit ──
  const ctt = await prisma.source.upsert({
    where: { externalId: 'src:ctt-2005-lancet-statin-meta-analysis' },
    create: {
      externalId: 'src:ctt-2005-lancet-statin-meta-analysis',
      name: 'Cholesterol Treatment Trialists\' (CTT) Collaborators; Baigent C, et al. (2005). "Efficacy and safety of cholesterol-lowering treatment: prospective meta-analysis of data from 90,056 participants in 14 randomised trials of statins." Lancet 366(9493):1267-1278. (Included the LIPID trial; established statin reduction of all-cause and coronary mortality.)',
      url: 'https://doi.org/10.1016/S0140-6736(05)67394-1',
      publishedAt: new Date('2005-10-08'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-lipid-1998-pravastatin',
    },
    update: {
      name: 'Cholesterol Treatment Trialists\' (CTT) Collaborators; Baigent C, et al. (2005). "Efficacy and safety of cholesterol-lowering treatment: prospective meta-analysis of data from 90,056 participants in 14 randomised trials of statins." Lancet 366(9493):1267-1278. (Included the LIPID trial; established statin reduction of all-cause and coronary mortality.)',
      url: 'https://doi.org/10.1016/S0140-6736(05)67394-1',
      publishedAt: new Date('2005-10-08'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2005-10-08`
  const settledReason = 'The LIPID trial reported that cholesterol-lowering reduced coronary events but framed the effects on coronary and overall mortality as still "uncertain." That residual uncertainty was adjudicated by the Cholesterol Treatment Trialists\' (CTT) Collaboration prospective individual-participant meta-analysis of 90,056 participants across 14 randomised statin trials (which included LIPID itself), published in The Lancet on 8 October 2005. The meta-analysis showed statin therapy produces a highly significant reduction in all-cause and coronary mortality per unit LDL-cholesterol lowering, settling the mortality question through pooled expert-literature synthesis rather than contest.'
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2005-10-08'),
      datePrecision: 'DAY',
      reason: settledReason,
      sourceId: ctt.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2005-10-08'),
      datePrecision: 'DAY',
      reason: settledReason,
      sourceId: ctt.id,
    },
  })

  const cttEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: ctt.id } })
  if (!cttEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: ctt.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via CTT 2005 statin meta-analysis, 2005-10-08)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
