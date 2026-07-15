// Epistemic-receipt enrichment for OpenAlex claim cmplyo3yo00dbsaqk2g1brjjd
// Hall, P. A. & Soskice, D. (2001), "Varieties of Capitalism", OUP.
//   DOI 10.1093/0199247757.001.0001 | OpenAlex W4229738978
//
// Baseline row (fromAxis=null -> RECORDED at 2001-08-30) already exists; not duplicated here.
//
// Post-publication arc added:
//   RECORDED -> CONTESTED (2007-05-17): the independent edited volume "Beyond
//   Varieties of Capitalism" (Hancké, Rhodes & Thatcher, eds., OUP) critically
//   re-examines the LME/CME dichotomy — a major, dated, citable methodological
//   critique of the framework's core typology. Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmplyo3yo00dbsaqk2g1brjjd'

async function main() {
  // --- RECORDED -> CONTESTED (2007-05-17) ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:beyond-varieties-of-capitalism-2007' },
    create: {
      externalId: 'src:beyond-varieties-of-capitalism-2007',
      name: 'Hancké, Rhodes & Thatcher (eds.), Beyond Varieties of Capitalism, OUP (2007)',
      url: 'https://doi.org/10.1093/acprof:oso/9780199206483.001.0001',
      publishedAt: new Date('2007-05-17'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:varieties-of-capitalism',
    },
    update: {
      name: 'Hancké, Rhodes & Thatcher (eds.), Beyond Varieties of Capitalism, OUP (2007)',
      url: 'https://doi.org/10.1093/acprof:oso/9780199206483.001.0001',
      publishedAt: new Date('2007-05-17'),
    },
  })

  const occurredAt = new Date('2007-05-17')
  const histId = `${claimId}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The independent OUP edited volume "Beyond Varieties of Capitalism" (Hancké, Rhodes & Thatcher, eds.) critically re-examined the LME/CME dichotomy that underpins Hall & Soskice, arguing the two-type framework is too static and coarse to capture mixed and Southern/Eastern European political economies. As a major, dated, widely-cited methodological critique from authors independent of the original volume, it marks the framework moving from RECORDED to actively CONTESTED in comparative political economy.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The independent OUP edited volume "Beyond Varieties of Capitalism" (Hancké, Rhodes & Thatcher, eds.) critically re-examined the LME/CME dichotomy that underpins Hall & Soskice, arguing the two-type framework is too static and coarse to capture mixed and Southern/Eastern European political economies. As a major, dated, widely-cited methodological critique from authors independent of the original volume, it marks the framework moving from RECORDED to actively CONTESTED in comparative political economy.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'AGAINST' } })
  }

  console.log(`✓ ${claimId}: added RECORDED->CONTESTED (${histId})`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
