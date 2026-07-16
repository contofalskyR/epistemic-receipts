import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Chaiken, S. & Trope, Y. (eds.) (1999), "Dual-Process Theories in Social
//   Psychology." New York: Guilford Press.
//   OpenAlex: W1832238961 (1999) · DOI: none
//
// Baseline row (fromAxis=null -> RECORDED at 1999-01-01) already exists; NOT duplicated here.
//
// Post-publication arc added (dual-process / two-system framework):
//   RECORDED -> CONTESTED (2009-11): Keren, G. & Schul, Y., "Two Is Not Always
//     Better Than One: A Critical Evaluation of Two-System Theories" (Perspectives
//     on Psychological Science 4(6): 533-550, PMID 26161732). A prominent, widely
//     cited critique arguing that the two-system/dual-process family (including the
//     social-psychology models catalogued in this volume) is under-specified,
//     largely unfalsifiable, and not empirically warranted over single-system
//     accounts — a specific, dated methodological challenge to the framework.
//   CONTESTED -> SETTLED (2013-05): Evans, J.St.B.T. & Stanovich, K.E.,
//     "Dual-Process Theories of Higher Cognition: Advancing the Debate"
//     (Perspectives on Psychological Science 8(3): 223-241, PMID 26172965). This
//     is the canonical adjudicating review that answers the Keren-Schul and
//     Kruglanski-Gigerenzer critiques point by point. It defends the core
//     Type-1/Type-2 (autonomous vs. controlled) distinction as empirically robust
//     while explicitly abandoning the strong "two discrete systems" reading,
//     consolidating a refined dual-process consensus that became the standard
//     textbook treatment. This is a qualified expert-literature settling
//     (vindicated-with-refinement), not an unconditional one.

const CLAIM_ID = 'cmplxoxpa023jsa7f6p0c8yn3'

async function main() {
  // ── RECORDED -> CONTESTED: Keren & Schul (2009) critical evaluation of two-system theories ──
  const keren2009 = await prisma.source.upsert({
    where: { externalId: 'src:keren-schul-2009-two-is-not-always-better' },
    create: {
      externalId: 'src:keren-schul-2009-two-is-not-always-better',
      name: 'Keren, G. & Schul, Y. (2009). "Two Is Not Always Better Than One: A Critical Evaluation of Two-System Theories." Perspectives on Psychological Science 4(6): 533-550.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26161732/',
      publishedAt: new Date('2009-11-01'),
      methodologyType: 'review',
      ingestedBy: 'enrich:openalex_v1-chaiken-trope-1999-dual-process-social-psychology',
    },
    update: {
      name: 'Keren, G. & Schul, Y. (2009). "Two Is Not Always Better Than One: A Critical Evaluation of Two-System Theories." Perspectives on Psychological Science 4(6): 533-550.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26161732/',
      publishedAt: new Date('2009-11-01'),
    },
  })

  const contestedId = `${CLAIM_ID}-CONTESTED-2009-11-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-11-01'),
      datePrecision: 'MONTH',
      reason: 'Keren & Schul (2009) mounted a prominent, dated critique of the two-system / dual-process family that this volume codified for social psychology, arguing the distinction is under-specified, largely unfalsifiable, and not empirically warranted over parsimonious single-system accounts. Published in Perspectives on Psychological Science, it moved the framework from settled-in-passing to actively contested in the expert literature.',
      sourceId: keren2009.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-11-01'),
      datePrecision: 'MONTH',
      reason: 'Keren & Schul (2009) mounted a prominent, dated critique of the two-system / dual-process family that this volume codified for social psychology, arguing the distinction is under-specified, largely unfalsifiable, and not empirically warranted over parsimonious single-system accounts. Published in Perspectives on Psychological Science, it moved the framework from settled-in-passing to actively contested in the expert literature.',
      sourceId: keren2009.id,
    },
  })

  const contestEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: keren2009.id } })
  if (!contestEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: keren2009.id, type: 'AGAINST' } })
  }

  // ── CONTESTED -> SETTLED: Evans & Stanovich (2013) adjudicating review "Advancing the Debate" ──
  const evans2013 = await prisma.source.upsert({
    where: { externalId: 'src:evans-stanovich-2013-advancing-the-debate' },
    create: {
      externalId: 'src:evans-stanovich-2013-advancing-the-debate',
      name: 'Evans, J.St.B.T. & Stanovich, K.E. (2013). "Dual-Process Theories of Higher Cognition: Advancing the Debate." Perspectives on Psychological Science 8(3): 223-241.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26172965/',
      publishedAt: new Date('2013-05-01'),
      methodologyType: 'review',
      ingestedBy: 'enrich:openalex_v1-chaiken-trope-1999-dual-process-social-psychology',
    },
    update: {
      name: 'Evans, J.St.B.T. & Stanovich, K.E. (2013). "Dual-Process Theories of Higher Cognition: Advancing the Debate." Perspectives on Psychological Science 8(3): 223-241.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26172965/',
      publishedAt: new Date('2013-05-01'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2013-05-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-05-01'),
      datePrecision: 'MONTH',
      reason: 'Evans & Stanovich (2013) is the canonical review that adjudicated the contest, answering the Keren-Schul and Kruglanski-Gigerenzer critiques directly. It defends the core Type-1 (autonomous) vs. Type-2 (controlled) distinction as empirically robust while explicitly discarding the strong "two discrete systems" reading, consolidating a refined dual-process consensus that became the standard textbook treatment. This is a qualified expert-literature settling — vindicated with refinement rather than unconditionally.',
      sourceId: evans2013.id,
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-05-01'),
      datePrecision: 'MONTH',
      reason: 'Evans & Stanovich (2013) is the canonical review that adjudicated the contest, answering the Keren-Schul and Kruglanski-Gigerenzer critiques directly. It defends the core Type-1 (autonomous) vs. Type-2 (controlled) distinction as empirically robust while explicitly discarding the strong "two discrete systems" reading, consolidating a refined dual-process consensus that became the standard textbook treatment. This is a qualified expert-literature settling — vindicated with refinement rather than unconditionally.',
      sourceId: evans2013.id,
    },
  })

  const settleEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: evans2013.id } })
  if (!settleEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: evans2013.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED via Keren & Schul 2009; CONTESTED -> SETTLED via Evans & Stanovich 2013)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
