import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Hayes, S.C., Luoma, J.B., Bond, F.W., Masuda, A., & Lillis, J. (2006),
//   "Acceptance and Commitment Therapy: Model, processes and outcomes,"
//   Behaviour Research and Therapy 44(1): 1-25.
//   DOI: 10.1016/j.brat.2005.06.006 · OpenAlex: W2133963272
//
// Baseline row (fromAxis=null -> RECORDED at 2005-11-22) already exists; do NOT
// duplicate it. This script adds the post-publication epistemic arc:
//
//   RECORDED -> CONTESTED  (Öst 2008 systematic review & meta-analysis: the
//     "third wave" therapies including ACT were judged methodologically weaker
//     than established CBT and not yet to meet criteria for empirical support)
//   CONTESTED -> SETTLED   (A-Tjak et al. 2015 meta-analysis: ACT shown
//     efficacious across a range of clinically relevant mental and physical
//     health problems, adjudicating the contest in ACT's favor)
//
// Both adjudications sit within the expert literature (EXPERT_LITERATURE).

const CLAIM_ID = 'cmpm1skto0dz1sadnnqgdsb71'

async function main() {
  // ── RECORDED -> CONTESTED: Öst (2008) third-wave meta-analysis / methodological critique ──
  const ost = await prisma.source.upsert({
    where: { externalId: 'src:ost-2008-third-wave-efficacy-meta-analysis' },
    create: {
      externalId: 'src:ost-2008-third-wave-efficacy-meta-analysis',
      name: 'Öst, L.-G. (2008). Efficacy of the third wave of behavioral therapies: A systematic review and meta-analysis. Behaviour Research and Therapy 46(3): 296-321.',
      url: 'https://doi.org/10.1016/j.brat.2007.12.005',
      publishedAt: new Date('2008-03-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-hayes-2006-acceptance-commitment-therapy',
    },
    update: {
      name: 'Öst, L.-G. (2008). Efficacy of the third wave of behavioral therapies: A systematic review and meta-analysis. Behaviour Research and Therapy 46(3): 296-321.',
      url: 'https://doi.org/10.1016/j.brat.2007.12.005',
      publishedAt: new Date('2008-03-01'),
    },
  })

  const contestedId = `${CLAIM_ID}-CONTESTED-2008-03-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2008-03-01'),
      datePrecision: 'MONTH',
      reason: 'Öst\'s systematic review and meta-analysis in the same journal assessed the empirical status of the "third wave" behavioral therapies, of which ACT is the flagship. It found the ACT randomized trials significantly less methodologically rigorous than established CBT trials and concluded that none of the third-wave therapies yet met the criteria for empirically supported treatments, placing the ACT efficacy claim into open contest within the expert literature.',
      sourceId: ost.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2008-03-01'),
      datePrecision: 'MONTH',
      sourceId: ost.id,
    },
  })

  const ostEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: ost.id } })
  if (!ostEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: ost.id, type: 'AGAINST' } })
  }

  // ── CONTESTED -> SETTLED: A-Tjak et al. (2015) meta-analysis of ACT efficacy ──
  const atjak = await prisma.source.upsert({
    where: { externalId: 'src:a-tjak-2015-act-efficacy-meta-analysis' },
    create: {
      externalId: 'src:a-tjak-2015-act-efficacy-meta-analysis',
      name: 'A-Tjak, J.G.L., Davis, M.L., Morina, N., et al. (2015). A Meta-Analysis of the Efficacy of Acceptance and Commitment Therapy for Clinically Relevant Mental and Physical Health Problems. Psychotherapy and Psychosomatics 84(1): 30-36.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/25547522/',
      publishedAt: new Date('2014-12-24'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-hayes-2006-acceptance-commitment-therapy',
    },
    update: {
      name: 'A-Tjak, J.G.L., Davis, M.L., Morina, N., et al. (2015). A Meta-Analysis of the Efficacy of Acceptance and Commitment Therapy for Clinically Relevant Mental and Physical Health Problems. Psychotherapy and Psychosomatics 84(1): 30-36.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/25547522/',
      publishedAt: new Date('2014-12-24'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2014-12-24`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2014-12-24'),
      datePrecision: 'DAY',
      reason: 'A-Tjak and colleagues published a meta-analysis pooling randomized controlled trials of ACT across a range of clinically relevant mental and physical health problems, finding ACT more efficacious than control conditions and comparable to established treatments at follow-up. Appearing after Öst\'s critique had improved trial standards, it adjudicated the contest in ACT\'s favor and settled the efficacy claim within the expert literature.',
      sourceId: atjak.id,
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2014-12-24'),
      datePrecision: 'DAY',
      sourceId: atjak.id,
    },
  })

  const atjakEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: atjak.id } })
  if (!atjakEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: atjak.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED via Öst 2008; CONTESTED -> SETTLED via A-Tjak 2015)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
