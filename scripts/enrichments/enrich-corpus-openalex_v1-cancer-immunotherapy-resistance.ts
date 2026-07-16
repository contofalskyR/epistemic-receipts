// Enrichment: post-publication epistemic trajectory for
// "Primary, Adaptive, and Acquired Resistance to Cancer Immunotherapy"
// Sharma P, Hu-Lieskovan S, Wargo JA, Ribas A. Cell 2017;168(4):707–723.
// DOI 10.1016/j.cell.2017.01.017 · OpenAlex W2587048937
//
// Baseline RECORDED transition (fromAxis=null -> RECORDED at 2017-02-01) already
// exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2020-03-31, INSTITUTIONAL)
//     The Society for Immunotherapy of Cancer (SITC) convened a multistakeholder
//     Immunotherapy Resistance Taskforce (academia, industry, government) that
//     generated consensus clinical definitions of resistance to PD-(L)1 blockade
//     — primary resistance, secondary/acquired resistance, and progression after
//     discontinuation — operationalizing the primary/adaptive/acquired resistance
//     framework this paper introduced. Kluger HM et al., "Defining tumor resistance
//     to PD-1 pathway blockade: recommendations from the first meeting of the SITC
//     Immunotherapy Resistance Taskforce." J Immunother Cancer 2020;8(1):e000398.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cancer-immunotherapy-resistance.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmply856a01zrsaihp9mu12g6'

async function main() {
  // ── RECORDED -> SETTLED : SITC Immunotherapy Resistance Taskforce consensus (2020) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:sitc-immunotherapy-resistance-taskforce-2020' },
    create: {
      externalId: 'src:sitc-immunotherapy-resistance-taskforce-2020',
      name: 'Kluger HM, Tawbi HA, Ascierto ML, et al. "Defining tumor resistance to PD-1 pathway blockade: recommendations from the first meeting of the SITC Immunotherapy Resistance Taskforce." Journal for ImmunoTherapy of Cancer 2020;8(1):e000398.',
      url: 'https://doi.org/10.1136/jitc-2019-000398',
      publishedAt: new Date('2020-03-31'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Kluger HM, Tawbi HA, Ascierto ML, et al. "Defining tumor resistance to PD-1 pathway blockade: recommendations from the first meeting of the SITC Immunotherapy Resistance Taskforce." Journal for ImmunoTherapy of Cancer 2020;8(1):e000398.',
      url: 'https://doi.org/10.1136/jitc-2019-000398',
      publishedAt: new Date('2020-03-31'),
    },
  })

  const occurredAt = new Date('2020-03-31')
  const slug = `${claimId}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The Society for Immunotherapy of Cancer convened a multistakeholder Immunotherapy Resistance Taskforce (academia, industry, government) that generated consensus clinical definitions of resistance to PD-(L)1 blockade — primary resistance, secondary/acquired resistance, and progression after discontinuation. This position/guidelines statement operationalized into formal consensus criteria the primary/adaptive/acquired resistance framework this paper introduced, marking its adoption as field-standard classification.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The Society for Immunotherapy of Cancer convened a multistakeholder Immunotherapy Resistance Taskforce (academia, industry, government) that generated consensus clinical definitions of resistance to PD-(L)1 blockade — primary resistance, secondary/acquired resistance, and progression after discontinuation. This position/guidelines statement operationalized into formal consensus criteria the primary/adaptive/acquired resistance framework this paper introduced, marking its adoption as field-standard classification.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({
    where: { claimId, sourceId: source.id },
  })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`  ✓ enriched ${claimId} (+1 transition: RECORDED -> SETTLED 2020-03-31)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
