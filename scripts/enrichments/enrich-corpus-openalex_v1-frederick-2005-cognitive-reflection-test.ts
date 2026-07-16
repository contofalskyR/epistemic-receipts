import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Frederick, S. (2005), "Cognitive Reflection and Decision Making,"
//   Journal of Economic Perspectives 19(4): 25-42.
//   DOI: 10.1257/089533005775196732 · OpenAlex: W2161080627
//
// Baseline row (fromAxis=null -> RECORDED at 2005-11-01) already exists; NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> CONTESTED (2016-09-30): Haigh, "Has the Standard Cognitive
//     Reflection Test Become a Victim of Its Own Success?" (Advances in
//     Cognitive Psychology 12(3): 145-149, DOI 10.5709/acp-0193-5) argued that
//     the CRT's runaway popularity meant its three items now circulate so widely
//     (teaching, media, repeated participation) that scores increasingly reflect
//     prior familiarity rather than genuine reflective ability — a direct
//     methodological threat to the measure's validity.
//   CONTESTED -> SETTLED (2018-10): Bialek & Pennycook, "The cognitive reflection
//     test is robust to multiple exposures" (Behavior Research Methods 50: 1953-1959,
//     DOI 10.3758/s13428-017-0963-x) empirically tested the exposure-contamination
//     concern and found CRT performance and its predictive relationships were not
//     meaningfully degraded by repeated encounters, resolving the challenge in the
//     measure's favor. Terminal state: SETTLED.

const CLAIM_ID = 'cmplxkx65005dsa7ff7cpd455'

async function main() {
  // ── RECORDED -> CONTESTED: Haigh (2016) exposure-contamination critique ──
  const haigh = await prisma.source.upsert({
    where: { externalId: 'src:haigh-2016-crt-victim-of-success' },
    create: {
      externalId: 'src:haigh-2016-crt-victim-of-success',
      name: 'Haigh, M. (2016). "Has the Standard Cognitive Reflection Test Become a Victim of Its Own Success?" Advances in Cognitive Psychology 12(3): 145-149.',
      url: 'https://doi.org/10.5709/acp-0193-5',
      publishedAt: new Date('2016-09-30'),
      methodologyType: 'opinion',
      ingestedBy: 'enrich:openalex_v1-frederick-2005-cognitive-reflection-test',
    },
    update: {
      name: 'Haigh, M. (2016). "Has the Standard Cognitive Reflection Test Become a Victim of Its Own Success?" Advances in Cognitive Psychology 12(3): 145-149.',
      url: 'https://doi.org/10.5709/acp-0193-5',
      publishedAt: new Date('2016-09-30'),
    },
  })

  const contestedId = `${CLAIM_ID}-CONTESTED-2016-09-30`
  const contestedReason = 'Matthew Haigh\'s 2016 critique in Advances in Cognitive Psychology argued that the extraordinary uptake of Frederick\'s three-item CRT had itself become a threat to its validity: because the same three items now circulate through teaching, media, and repeated study participation, many respondents meet them already knowing the answers, so scores increasingly reflect prior exposure rather than genuine reflective ability. This placed the measure\'s core interpretation into active methodological contestation.'
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-09-30'),
      datePrecision: 'DAY',
      reason: contestedReason,
      sourceId: haigh.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-09-30'),
      datePrecision: 'DAY',
      reason: contestedReason,
      sourceId: haigh.id,
    },
  })

  const haighEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: haigh.id } })
  if (!haighEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: haigh.id, type: 'AGAINST' } })
  }

  // ── CONTESTED -> SETTLED: Bialek & Pennycook (2018) robustness rebuttal ──
  const bialek = await prisma.source.upsert({
    where: { externalId: 'src:bialek-pennycook-2018-crt-robust-multiple-exposures' },
    create: {
      externalId: 'src:bialek-pennycook-2018-crt-robust-multiple-exposures',
      name: 'Bialek, M. & Pennycook, G. (2018). "The cognitive reflection test is robust to multiple exposures." Behavior Research Methods 50: 1953-1959.',
      url: 'https://doi.org/10.3758/s13428-017-0963-x',
      publishedAt: new Date('2018-10-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-frederick-2005-cognitive-reflection-test',
    },
    update: {
      name: 'Bialek, M. & Pennycook, G. (2018). "The cognitive reflection test is robust to multiple exposures." Behavior Research Methods 50: 1953-1959.',
      url: 'https://doi.org/10.3758/s13428-017-0963-x',
      publishedAt: new Date('2018-10-01'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2018-10-01`
  const settledReason = 'Bialek and Pennycook (2018), "The cognitive reflection test is robust to multiple exposures" (Behavior Research Methods), directly tested the exposure-contamination concern by comparing CRT responses across participants with varying prior exposure and found that neither CRT performance nor its predictive relationships were meaningfully degraded by repeated encounters. This empirical rebuttal resolved the contamination challenge in the measure\'s favor, and the CRT retained its standing as a valid index of reflective thinking.'
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2018-10-01'),
      datePrecision: 'MONTH',
      reason: settledReason,
      sourceId: bialek.id,
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2018-10-01'),
      datePrecision: 'MONTH',
      reason: settledReason,
      sourceId: bialek.id,
    },
  })

  const bialekEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: bialek.id } })
  if (!bialekEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: bialek.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED via Haigh 2016; CONTESTED -> SETTLED via Bialek & Pennycook 2018)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
