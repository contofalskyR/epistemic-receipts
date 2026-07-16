import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Knack, S. & Keefer, P. (1995), "Institutions and Economic Performance:
//   Cross-Country Tests Using Alternative Institutional Measures,"
//   Economics & Politics 7(3): 207-227.
//   DOI: 10.1111/j.1468-0343.1995.tb00111.x · OpenAlex: W2010235856
//
// Identity verified via Crossref (title/authors/journal/1995-11 issue) — no
// retraction or correction flags (update-to / updated-by both null).
//
// Baseline row (fromAxis=null -> RECORDED at 1995-11) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2004-09): Glaeser, La Porta, Lopez-de-Silanes &
//   Shleifer, "Do Institutions Cause Growth?", Journal of Economic Growth
//   9(3): 271-303 (DOI 10.1023/b:joeg.0000038933.16398.ed). This is the
//   canonical measurement critique of the strand Knack & Keefer launched:
//   it argues the ICRG subjective country-risk indicators (risk of
//   expropriation, contract repudiation, rule of law) that Knack & Keefer
//   introduced are "conceptually unsuitable" for establishing that
//   institutions cause growth — they reflect realized outcomes and the
//   choices of dictators rather than durable constraints (e.g. the USSR
//   scoring low expropriation risk in 1984), and that human capital, not
//   these institutions, is the more basic source of growth. The causal
//   and measurement claim remains actively contested, not overturned:
//   terminal state CONTESTED.

const CLAIM_ID = 'cmplyr9sa01whsaqksxyy0v0t'

async function main() {
  // ── RECORDED -> CONTESTED: Glaeser et al. (2004) measurement critique ──
  const glaeser = await prisma.source.upsert({
    where: { externalId: 'src:glaeser-2004-do-institutions-cause-growth' },
    create: {
      externalId: 'src:glaeser-2004-do-institutions-cause-growth',
      name: 'Glaeser, E. L., La Porta, R., Lopez-de-Silanes, F. & Shleifer, A. (2004). "Do Institutions Cause Growth?" Journal of Economic Growth 9(3): 271-303.',
      url: 'https://doi.org/10.1023/b:joeg.0000038933.16398.ed',
      publishedAt: new Date('2004-09-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-knack-keefer-1995-institutions',
    },
    update: {
      name: 'Glaeser, E. L., La Porta, R., Lopez-de-Silanes, F. & Shleifer, A. (2004). "Do Institutions Cause Growth?" Journal of Economic Growth 9(3): 271-303.',
      url: 'https://doi.org/10.1023/b:joeg.0000038933.16398.ed',
      publishedAt: new Date('2004-09-01'),
    },
  })

  const histId = `${CLAIM_ID}-CONTESTED-2004-09-01`
  const reason =
    'Glaeser, La Porta, Lopez-de-Silanes & Shleifer (2004), "Do Institutions Cause Growth?", mounted the canonical measurement critique of this literature, targeting exactly the ICRG country-risk indicators (risk of expropriation, contract repudiation, rule of law) that Knack & Keefer introduced. They argue these subjective evaluator-provided measures are conceptually unsuitable for establishing that institutions cause growth because they reflect realized outcomes and the choices of dictators rather than durable constraints (e.g. the USSR ranking among the lowest expropriation-risk countries in 1984), and that human capital is a more basic source of growth. The causal and measurement claim thus entered active scholarly contestation rather than being settled or overturned.'
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-09-01'),
      datePrecision: 'MONTH',
      reason,
      sourceId: glaeser.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-09-01'),
      datePrecision: 'MONTH',
      reason,
      sourceId: glaeser.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: glaeser.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: glaeser.id, type: 'AGAINST' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED via Glaeser et al. 2004)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
