import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   IPCC (2023), "Climate Change 2021 – The Physical Science Basis. Contribution
//   of Working Group I to the Sixth Assessment Report of the Intergovernmental
//   Panel on Climate Change." Cambridge University Press.
//   DOI: 10.1017/9781009157896 · OpenAlex: W4382363623
//
// Baseline row (fromAxis=null -> RECORDED at 2023-06-29, the book edition's
// publication date) already exists; do NOT duplicate it.
//
// This is a consensus assessment report, not a single empirical finding, so there
// is no retraction, failed replication, or meta-analysis to record — and a high
// citation count alone is not evidence of settling. The defensible post-publication
// arc is a FIELD/INSTITUTIONAL CONSENSUS event: the AR6 physical-science conclusions
// were formally ratified at the highest political level when the Parties to the
// Paris Agreement (CMA) adopted the outcome of the first Global Stocktake at COP28.
//
//   RECORDED -> SETTLED  (Decision 1/CMA.5, "Outcome of the first global
//     stocktake," adopted at COP28 in Dubai on 2023-12-13. The decision explicitly
//     recognizes the findings of the IPCC AR6 — including that global GHG emissions
//     need to be cut 43% by 2030 relative to 2019 to limit warming to 1.5 °C — as
//     the evidentiary basis of the stocktake. This is the near-universal
//     intergovernmental body under the Paris Agreement incorporating AR6's physical-
//     science assessment into a binding process outcome.)
//
// The adjudicating body is the Conference of the Parties serving as the meeting of
// the Parties to the Paris Agreement (CMA), hence community INSTITUTIONAL.

const CLAIM_ID = 'cmpm15lq10oddsa86ibu35ar4'

async function main() {
  // ── RECORDED -> SETTLED: COP28 first Global Stocktake (decision 1/CMA.5) ──
  const gst = await prisma.source.upsert({
    where: { externalId: 'src:unfccc-gst-1-cma5-2023' },
    create: {
      externalId: 'src:unfccc-gst-1-cma5-2023',
      name: 'UNFCCC (2023). Decision 1/CMA.5, "Outcome of the first global stocktake." Adopted at COP28 (CMA 5), Dubai, 2023-12-13. The first Global Stocktake outcome recognizes the findings of the IPCC Sixth Assessment Report (AR6) as its evidentiary basis, including that global GHG emissions must fall 43% by 2030 (vs. 2019) to keep 1.5 °C within reach. Near-universal adoption by the Parties to the Paris Agreement.',
      url: 'https://unfccc.int/topics/global-stocktake/about-the-global-stocktake/outcome-of-the-first-global-stocktake',
      publishedAt: new Date('2023-12-13'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-ipcc-2023-ar6-wg1-physical-science-basis',
    },
    update: {
      name: 'UNFCCC (2023). Decision 1/CMA.5, "Outcome of the first global stocktake." Adopted at COP28 (CMA 5), Dubai, 2023-12-13. The first Global Stocktake outcome recognizes the findings of the IPCC Sixth Assessment Report (AR6) as its evidentiary basis, including that global GHG emissions must fall 43% by 2030 (vs. 2019) to keep 1.5 °C within reach. Near-universal adoption by the Parties to the Paris Agreement.',
      url: 'https://unfccc.int/topics/global-stocktake/about-the-global-stocktake/outcome-of-the-first-global-stocktake',
      publishedAt: new Date('2023-12-13'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2023-12-13`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2023-12-13'),
      datePrecision: 'DAY',
      reason: 'The IPCC AR6 Working Group I assessment of the physical science basis was ratified at the highest political level when the Parties to the Paris Agreement adopted the outcome of the first Global Stocktake (decision 1/CMA.5) at COP28 in Dubai on 2023-12-13. The decision explicitly recognizes the findings of the IPCC AR6 — including the 43%-by-2030 emissions-reduction pathway for 1.5 °C — as the evidentiary foundation of the stocktake. This near-universal intergovernmental adoption marks the institutional consensus around the report\'s assessment.',
      sourceId: gst.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2023-12-13'),
      datePrecision: 'DAY',
      sourceId: gst.id,
    },
  })

  const gEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: gst.id } })
  if (!gEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: gst.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via COP28 first Global Stocktake, decision 1/CMA.5)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
