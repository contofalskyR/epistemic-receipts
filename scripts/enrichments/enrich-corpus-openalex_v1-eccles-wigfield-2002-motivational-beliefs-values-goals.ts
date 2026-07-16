import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Eccles, J. S., & Wigfield, A. (2002), "Motivational Beliefs, Values, and Goals,"
//   Annual Review of Psychology 53: 109-132.
//   DOI: 10.1146/annurev.psych.53.100901.135153 · OpenAlex: W2111638337
//
// Baseline row (fromAxis=null -> RECORDED at 2002-02-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2020-04): Eccles & Wigfield, "From expectancy-value
//   theory to situated expectancy-value theory: A developmental, social cognitive,
//   and sociocultural perspective on motivation," Contemporary Educational
//   Psychology 61: 101859 (DOI 10.1016/j.cedpsych.2020.101859). This is the
//   canonical restatement — by the same authors, 18 years on and already cited
//   ~1,800 times — that the field treats as the mature consolidation of the
//   expectancy-value framework that anchored the 2002 review. It reaffirms the
//   core expectancy x value architecture (expectancies for success and subjective
//   task value jointly predict achievement-related choice, persistence, and
//   performance) while situating it in developmental and sociocultural context.
//   The framework was elaborated and re-centered, not overturned, so the arc is a
//   straight vindication: RECORDED -> SETTLED, no intervening CONTESTED.
//
// A high citation count alone was NOT treated as settling; the transition is
// anchored to this specific, dated, field-recognized adjudicating document.

const CLAIM_ID = 'cmpm1kc6w0a4dsadnvq1oalrj'

async function main() {
  // ── RECORDED -> SETTLED: Eccles & Wigfield (2020) situated expectancy-value theory ──
  const sevt = await prisma.source.upsert({
    where: { externalId: 'src:eccles-wigfield-2020-situated-expectancy-value-theory' },
    create: {
      externalId: 'src:eccles-wigfield-2020-situated-expectancy-value-theory',
      name: 'Eccles, J. S., & Wigfield, A. (2020). "From expectancy-value theory to situated expectancy-value theory: A developmental, social cognitive, and sociocultural perspective on motivation." Contemporary Educational Psychology 61: 101859.',
      url: 'https://doi.org/10.1016/j.cedpsych.2020.101859',
      publishedAt: new Date('2020-04-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-eccles-wigfield-2002-motivational-beliefs',
    },
    update: {
      name: 'Eccles, J. S., & Wigfield, A. (2020). "From expectancy-value theory to situated expectancy-value theory: A developmental, social cognitive, and sociocultural perspective on motivation." Contemporary Educational Psychology 61: 101859.',
      url: 'https://doi.org/10.1016/j.cedpsych.2020.101859',
      publishedAt: new Date('2020-04-01'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2020-04-01`
  const reason = 'Eccles and Wigfield (2020) published the canonical restatement of the framework that anchored their 2002 review, recasting expectancy-value theory as "situated expectancy-value theory." Rather than overturning the model, the paper reaffirms its core expectancy x value architecture — that expectancies for success and subjective task value jointly predict achievement-related choices, persistence, and performance — while situating those beliefs in developmental and sociocultural context. As the field-recognized, heavily cited consolidation of this line of work by its originators, it marks the framework as an enduring, settled account rather than a contested one, moving the claim directly from RECORDED to SETTLED with no intervening contest.'
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-04-01'),
      datePrecision: 'MONTH',
      reason,
      sourceId: sevt.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-04-01'),
      datePrecision: 'MONTH',
      reason,
      sourceId: sevt.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: sevt.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: sevt.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via Eccles & Wigfield 2020 situated EVT)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
