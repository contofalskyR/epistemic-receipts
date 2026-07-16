import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4ome00f9sa8hlctpncsm'

// Post-publication trajectory for Vitousek, Mooney, Lubchenco & Melillo (1997),
// "Human Domination of Earth's Ecosystems," Science 277(5325):494–499.
// DOI 10.1126/science.277.5325.494 — verified via Crossref (no retraction, no update-to).
//
// The paper's thesis — that human alteration of Earth is substantial and growing —
// moved from a foundational synthesis (RECORDED, 1997) to intergovernmental
// scientific consensus. The IPBES Global Assessment (2019), approved by the 7th
// IPBES Plenary (Paris, 4 May 2019), confirmed and quantified the thesis at
// consensus scale (e.g. ~75% of the terrestrial environment severely altered by
// human action), vindicating the 1997 claim. This is an INSTITUTIONAL ratification.
const transitions = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2019-05-04',
    datePrecision: 'DAY',
    reason:
      'The intergovernmental IPBES Global Assessment Report on Biodiversity and Ecosystem Services, whose Summary for Policymakers was approved by the 7th IPBES Plenary in Paris on 4 May 2019, established scientific-policy consensus that human action has substantially and increasingly transformed Earth\'s ecosystems — directly confirming and updating Vitousek et al. (1997) (e.g. ~75% of the land surface significantly altered; ~1 million species threatened). The finding is now settled consensus rather than a contested synthesis.',
    source: {
      externalId: 'src:ipbes-global-assessment-spm-2019',
      name: 'IPBES (2019), Summary for policymakers of the global assessment report on biodiversity and ecosystem services (approved 7th IPBES Plenary, Paris, 4 May 2019)',
      url: 'https://doi.org/10.5281/zenodo.3553579',
      publishedAt: '2019-05-04',
      methodologyType: 'secondary',
    },
  },
]

async function main() {
  for (const tr of transitions) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-vitousek-human-domination-1997',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({
        data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' },
      })
    }

    console.log(`  ✓ ${histId}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
