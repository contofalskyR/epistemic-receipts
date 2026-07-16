import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Acemoglu, Johnson & Robinson (2001), "The Colonial Origins of Comparative
//   Development: An Empirical Investigation," American Economic Review 91(5).
//   DOI: 10.1257/aer.91.5.1369 · OpenAlex: W3124166904
//
// Baseline row (fromAxis=null -> RECORDED at 2001-12-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2012-12): David Albouy's AER Comment
//   ("...: Comment", AER 102(6): 3059-3076, DOI 10.1257/aer.102.6.3059)
//   challenged the settler-mortality data underpinning the instrument —
//   arguing the mortality estimates are error-ridden, mismatched across
//   campaign/labourer/civilian populations, and that including capped/
//   dummied observations drives the results, weakening the first stage.
//   AJR issued a same-issue Reply (10.1257/aer.102.6.3077) defending the
//   estimates, so the finding is contested (not overturned): terminal
//   state CONTESTED, not SETTLED/REVERSED.

const CLAIM_ID = 'cmpm05aej07ojsa8665d2960e'

async function main() {
  // ── RECORDED -> CONTESTED: Albouy (2012) AER Comment ──
  const albouy = await prisma.source.upsert({
    where: { externalId: 'src:albouy-2012-colonial-origins-comment' },
    create: {
      externalId: 'src:albouy-2012-colonial-origins-comment',
      name: 'Albouy, D. Y. (2012). "The Colonial Origins of Comparative Development: An Empirical Investigation: Comment." American Economic Review 102(6): 3059-3076.',
      url: 'https://doi.org/10.1257/aer.102.6.3059',
      publishedAt: new Date('2012-12-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-acemoglu-2001-colonial-origins',
    },
    update: {
      name: 'Albouy, D. Y. (2012). "The Colonial Origins of Comparative Development: An Empirical Investigation: Comment." American Economic Review 102(6): 3059-3076.',
      url: 'https://doi.org/10.1257/aer.102.6.3059',
      publishedAt: new Date('2012-12-01'),
    },
  })

  const histId = `${CLAIM_ID}-CONTESTED-2012-12-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2012-12-01'),
      datePrecision: 'MONTH',
      reason: 'David Albouy\'s AER Comment (2012) mounted a detailed methodological critique of the settler-mortality instrument, arguing the underlying mortality data are error-ridden and inconsistently matched across soldier, labourer, and civilian populations, and that the headline results hinge on capped and dummied observations that weaken the first stage. Acemoglu, Johnson & Robinson published a same-issue Reply defending their estimates, so the finding entered active scholarly contestation rather than being settled or overturned.',
      sourceId: albouy.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2012-12-01'),
      datePrecision: 'MONTH',
      reason: 'David Albouy\'s AER Comment (2012) mounted a detailed methodological critique of the settler-mortality instrument, arguing the underlying mortality data are error-ridden and inconsistently matched across soldier, labourer, and civilian populations, and that the headline results hinge on capped and dummied observations that weaken the first stage. Acemoglu, Johnson & Robinson published a same-issue Reply defending their estimates, so the finding entered active scholarly contestation rather than being settled or overturned.',
      sourceId: albouy.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: albouy.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: albouy.id, type: 'AGAINST' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED via Albouy 2012)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
