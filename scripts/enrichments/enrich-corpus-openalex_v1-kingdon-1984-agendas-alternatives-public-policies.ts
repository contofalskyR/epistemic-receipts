import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Kingdon, J. W. (1984), "Agendas, Alternatives, and Public Policies."
//   Boston: Little, Brown. (No DOI.) · OpenAlex: W2037927976
//   The founding statement of the Multiple Streams Framework/Approach (MSA):
//   problem, policy, and political streams joined at a "policy window."
//
// Baseline row (fromAxis=null -> RECORDED at 1984-01-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2016-02): Jones, Peterson, Pierce, Herweg, Bernal,
//   Raney & Zahariadis, "A River Runs Through It: A Multiple Streams
//   Meta-Review," Policy Studies Journal 44(1): 13-36 (DOI 10.1111/psj.12115).
//   This systematic content analysis of 311 peer-reviewed articles testing
//   MSA concepts (2000-2013) adjudicates Kingdon's framework as a foundational
//   and empirically robust theory of the policy process — applied across 65
//   countries, multiple governance levels, and 22 policy areas. It anchored
//   a dedicated PSJ special issue on MSA's "theoretical and empirical
//   crossroads," establishing the framework's settled standing in the expert
//   literature (while calling for greater operational consistency going
//   forward). Terminal state SETTLED, not CONTESTED/REVERSED: the review
//   vindicates rather than challenges the framework.

const CLAIM_ID = 'cmplyndqw000nsaqkjts510f6'

async function main() {
  // ── RECORDED -> SETTLED: Jones et al. (2016) MSA meta-review ──
  const metaReview = await prisma.source.upsert({
    where: { externalId: 'src:jones-2016-msa-meta-review-river-runs-through-it' },
    create: {
      externalId: 'src:jones-2016-msa-meta-review-river-runs-through-it',
      name: 'Jones, M. D., Peterson, H. L., Pierce, J. J., Herweg, N., Bernal, A., Raney, H. L., & Zahariadis, N. (2016). "A River Runs Through It: A Multiple Streams Meta-Review." Policy Studies Journal 44(1): 13-36.',
      url: 'https://doi.org/10.1111/psj.12115',
      publishedAt: new Date('2016-02-01'),
      methodologyType: 'meta_analysis',
      ingestedBy: 'enrich:openalex_v1-kingdon-1984-agendas-alternatives',
    },
    update: {
      name: 'Jones, M. D., Peterson, H. L., Pierce, J. J., Herweg, N., Bernal, A., Raney, H. L., & Zahariadis, N. (2016). "A River Runs Through It: A Multiple Streams Meta-Review." Policy Studies Journal 44(1): 13-36.',
      url: 'https://doi.org/10.1111/psj.12115',
      publishedAt: new Date('2016-02-01'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2016-02-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-02-01'),
      datePrecision: 'MONTH',
      reason: 'Jones et al.\'s "A River Runs Through It: A Multiple Streams Meta-Review" (Policy Studies Journal, 2016) systematically content-analyzed 311 peer-reviewed articles testing Kingdon\'s Multiple Streams framework (2000-2013), documenting its application across 65 countries, multiple governance levels, and 22 policy areas. Anchoring a dedicated PSJ special issue on MSA\'s theoretical and empirical status, the meta-review adjudicated the framework as a foundational, empirically robust theory of agenda-setting and the policy process. The finding thus moved from recorded to settled in the expert literature (with a call for greater operational consistency, not a challenge to the framework itself).',
      sourceId: metaReview.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-02-01'),
      datePrecision: 'MONTH',
      reason: 'Jones et al.\'s "A River Runs Through It: A Multiple Streams Meta-Review" (Policy Studies Journal, 2016) systematically content-analyzed 311 peer-reviewed articles testing Kingdon\'s Multiple Streams framework (2000-2013), documenting its application across 65 countries, multiple governance levels, and 22 policy areas. Anchoring a dedicated PSJ special issue on MSA\'s theoretical and empirical status, the meta-review adjudicated the framework as a foundational, empirically robust theory of agenda-setting and the policy process. The finding thus moved from recorded to settled in the expert literature (with a call for greater operational consistency, not a challenge to the framework itself).',
      sourceId: metaReview.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: metaReview.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: metaReview.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via Jones et al. 2016 MSA meta-review)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
