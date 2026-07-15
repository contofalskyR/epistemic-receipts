import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Dansgaard, W. (1964). "Stable isotopes in precipitation." Tellus 16(4):436-468.
//   DOI 10.1111/j.2153-3490.1964.tb00181.x  |  OpenAlex W1988378253
//   Claim id: cmq2w4rvj00h9sa8h7rhlx5jd
//
// Baseline (fromAxis=null -> RECORDED at 1964-11-01) already exists; not duplicated here.
//
// Post-publication adjudication:
//   Dansgaard's condensation-temperature effect (δ decreasing with temperature),
//   the amount effect, and the δD–δ¹⁸O (meteoric water) relationship were confirmed
//   and consolidated on the comprehensive global IAEA/WMO GNIP dataset by
//   Rozanski, Araguás-Araguás & Gonfiantini (1993), "Isotopic Patterns in Modern
//   Global Precipitation" (AGU Geophysical Monograph 78). This canonical review
//   (1200+ citations) is the standard adjudicating reference vindicating the
//   original relationships on a worldwide observational basis: RECORDED -> SETTLED.

const CLAIM_ID = 'cmq2w4rvj00h9sa8h7rhlx5jd'

interface Transition {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
  fromAxis: 'RECORDED'
  toAxis: 'SETTLED'
  community: 'EXPERT_LITERATURE'
  occurredAt: string
  datePrecision: 'YEAR'
  reason: string
}

const TRANSITIONS: Transition[] = [
  {
    externalId: 'src:rozanski-araguas-gonfiantini-1993-global-precipitation',
    name: 'Rozanski, K., Araguás-Araguás, L. & Gonfiantini, R. (1993). Isotopic Patterns in Modern Global Precipitation. In Climate Change in Continental Isotopic Records, AGU Geophysical Monograph 78, 1–36.',
    url: 'https://doi.org/10.1029/GM078p0001',
    publishedAt: '1993-01-01',
    methodologyType: 'derivative',
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1993-01-01',
    datePrecision: 'YEAR',
    reason:
      "Using the comprehensive global IAEA/WMO Global Network of Isotopes in Precipitation (GNIP) dataset, this canonical review confirmed and consolidated Dansgaard's core relationships: the condensation-temperature effect (δ decreasing with temperature), the amount effect, and the global δD–δ¹⁸O meteoric water relationship. It is the standard adjudicating reference (1200+ citations) that vindicated the 1964 findings on a worldwide observational basis, moving the finding from RECORDED to SETTLED within the expert isotope-hydrology literature.",
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.externalId },
      create: {
        externalId: tr.externalId,
        name: tr.name,
        url: tr.url,
        publishedAt: new Date(tr.publishedAt),
        methodologyType: tr.methodologyType,
        ingestedBy: 'enrich:openalex_v1-dansgaard-1964',
      },
      update: {
        name: tr.name,
        url: tr.url,
        publishedAt: new Date(tr.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
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

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
