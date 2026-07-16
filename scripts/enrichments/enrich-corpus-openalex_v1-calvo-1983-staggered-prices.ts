import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Calvo, G. A. (1983), "Staggered prices in a utility-maximizing framework,"
//   Journal of Monetary Economics 12(3): 383-398.
//   DOI: 10.1016/0304-3932(83)90060-0 · OpenAlex: W1995278743
//
// Baseline row (fromAxis=null -> RECORDED at 1983-09-01) already exists; NOT duplicated here.
//
// Calvo's paper introduced the time-dependent, memoryless price-adjustment
// mechanism ("Calvo pricing": each firm resets its price with a constant
// probability each period, independent of time since last change) that became
// the workhorse of New Keynesian DSGE modeling.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2004-10): Bils & Klenow, "Some Evidence on the
//   Importance of Sticky Prices," Journal of Political Economy 112(5): 947-985
//   (DOI 10.1086/422559). Using BLS micro-price data they found consumer prices
//   change roughly every ~4 months — far more frequently than the degree of
//   stickiness assumed in Calvo-based macro models — and that the timing of
//   changes looked state-dependent rather than the constant-hazard, time-
//   dependent process Calvo assumes. This launched the state-dependent-pricing
//   critique (Golosov-Lucas, Klenow-Kryvtsov, Nakamura-Steinsson) that
//   directly contests the empirical realism of the Calvo mechanism. Because the
//   Calvo model remains widely used and the time-dependent vs. state-dependent
//   debate is still active, the terminal state is CONTESTED (not REVERSED).

const CLAIM_ID = 'cmplzqz1000zpsa86q0rnpr0h'

async function main() {
  // ── RECORDED -> CONTESTED: Bils & Klenow (2004) JPE ──
  const bilsKlenow = await prisma.source.upsert({
    where: { externalId: 'src:bils-klenow-2004-sticky-prices' },
    create: {
      externalId: 'src:bils-klenow-2004-sticky-prices',
      name: 'Bils, M. & Klenow, P. J. (2004). "Some Evidence on the Importance of Sticky Prices." Journal of Political Economy 112(5): 947-985.',
      url: 'https://doi.org/10.1086/422559',
      publishedAt: new Date('2004-10-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-calvo-1983-staggered-prices',
    },
    update: {
      name: 'Bils, M. & Klenow, P. J. (2004). "Some Evidence on the Importance of Sticky Prices." Journal of Political Economy 112(5): 947-985.',
      url: 'https://doi.org/10.1086/422559',
      publishedAt: new Date('2004-10-01'),
    },
  })

  const histId = `${CLAIM_ID}-CONTESTED-2004-10-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-10-01'),
      datePrecision: 'MONTH',
      reason: 'Bils & Klenow (2004, JPE) used BLS micro-price data to show consumer prices change roughly every four months — far more frequently than the price stickiness assumed in Calvo-based macro models — and that the pattern of changes looked state-dependent rather than Calvo\'s constant-hazard, time-dependent process. This empirical evidence launched the state-dependent-pricing critique of the Calvo mechanism, moving the finding into active scholarly contestation. Because Calvo pricing remains widely used and the time- vs. state-dependent debate stayed live, the terminal state is CONTESTED rather than REVERSED.',
      sourceId: bilsKlenow.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-10-01'),
      datePrecision: 'MONTH',
      reason: 'Bils & Klenow (2004, JPE) used BLS micro-price data to show consumer prices change roughly every four months — far more frequently than the price stickiness assumed in Calvo-based macro models — and that the pattern of changes looked state-dependent rather than Calvo\'s constant-hazard, time-dependent process. This empirical evidence launched the state-dependent-pricing critique of the Calvo mechanism, moving the finding into active scholarly contestation. Because Calvo pricing remains widely used and the time- vs. state-dependent debate stayed live, the terminal state is CONTESTED rather than REVERSED.',
      sourceId: bilsKlenow.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: bilsKlenow.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: bilsKlenow.id, type: 'AGAINST' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED via Bils & Klenow 2004)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
