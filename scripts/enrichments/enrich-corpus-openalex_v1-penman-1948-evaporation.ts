import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Penman, H. L. (1948), "Natural evaporation from open water, bare soil and grass,"
//   Proceedings of the Royal Society of London. Series A. 193(1032): 120-145.
//   DOI: 10.1098/rspa.1948.0037 · OpenAlex: W1969974566
//
// Baseline row (fromAxis=null -> RECORDED at 1948-04-22) already exists; NOT duplicated here.
//
// Penman's paper combined the aerodynamic (eddy-diffusion) and energy-balance
// approaches into a single "combination equation" that eliminates the hard-to-
// measure surface temperature. This became the foundational method of
// evaporation/evapotranspiration physics.
//
// Post-publication event added:
//   RECORDED -> SETTLED (1998): The FAO's Irrigation and Drainage Paper No. 56
//   ("Crop evapotranspiration — Guidelines for computing crop water requirements,"
//   Allen, Pereira, Raes & Smith, FAO Rome 1998) adopted the Penman combination
//   approach — in its Penman-Monteith form — as the SOLE standard reference
//   method for computing reference evapotranspiration worldwide, superseding the
//   patchwork of earlier empirical methods. This is an institutional
//   ratification (a UN agency defining the global standard) that settles
//   Penman's combination method as the accepted basis of the field.

const CLAIM_ID = 'cmq2w4vyz00jrsa8hj6z7cwag'

async function main() {
  // ── RECORDED -> SETTLED: FAO Irrigation & Drainage Paper 56 (1998) ──
  const fao56 = await prisma.source.upsert({
    where: { externalId: 'src:fao-56-crop-evapotranspiration-1998' },
    create: {
      externalId: 'src:fao-56-crop-evapotranspiration-1998',
      name: 'Allen, R. G., Pereira, L. S., Raes, D. & Smith, M. (1998). "Crop evapotranspiration — Guidelines for computing crop water requirements." FAO Irrigation and Drainage Paper No. 56. Food and Agriculture Organization of the United Nations, Rome.',
      url: 'https://www.fao.org/4/x0490e/x0490e00.htm',
      publishedAt: new Date('1998-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-penman-1948-evaporation',
    },
    update: {
      name: 'Allen, R. G., Pereira, L. S., Raes, D. & Smith, M. (1998). "Crop evapotranspiration — Guidelines for computing crop water requirements." FAO Irrigation and Drainage Paper No. 56. Food and Agriculture Organization of the United Nations, Rome.',
      url: 'https://www.fao.org/4/x0490e/x0490e00.htm',
      publishedAt: new Date('1998-01-01'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-1998-01-01`
  const reason =
    'FAO Irrigation and Drainage Paper No. 56 (Allen, Pereira, Raes & Smith, FAO Rome 1998) adopted Penman\'s combination approach — in its Penman-Monteith form — as the single standard reference method for computing reference evapotranspiration worldwide, replacing the earlier collection of competing empirical methods. This institutional ratification by a UN agency defining the global standard settles Penman\'s 1948 combination method (energy balance + aerodynamic term, eliminating surface temperature) as the accepted physical basis of the field.'

  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('1998-01-01'),
      datePrecision: 'YEAR',
      reason,
      sourceId: fao56.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('1998-01-01'),
      datePrecision: 'YEAR',
      reason,
      sourceId: fao56.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: fao56.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: fao56.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via FAO-56 1998)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
