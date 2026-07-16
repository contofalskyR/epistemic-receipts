import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Uppala S. M. et al. (2005), "The ERA-40 re-analysis",
//   Quarterly Journal of the Royal Meteorological Society 131(612):2961–3012.
//   DOI: 10.1256/qj.04.176 · OpenAlex W2090249381
//
// ERA-40 was ECMWF's second-generation global atmospheric reanalysis
// (Sept 1957 – Aug 2002). The baseline ClaimStatusHistory row
// (null -> RECORDED at 2005-10) already exists; this script adds only the
// post-publication arc.
//
// Verified arc (two transitions):
//   RECORDED -> CONTESTED (2011-04) — Dee et al., "The ERA-Interim reanalysis"
//     (QJRMS 137:553–597). ERA-Interim was produced "in part to prepare for a
//     new atmospheric reanalysis to replace ERA-40," with special emphasis on
//     "various difficulties encountered in the production of ERA-40" — notably
//     the misrepresentation of the hydrological cycle and spurious signals from
//     the changing satellite observing system. This is a dated, citable,
//     authoritative (same-institution, peer-reviewed) qualification of ERA-40's
//     reliability. Community: EXPERT_LITERATURE.
//   CONTESTED -> ABANDONED (2020-06-15) — Hersbach et al., "The ERA5 global
//     reanalysis" (QJRMS 146:1999–2049). ERA5 became ECMWF's reference global
//     reanalysis and completed the supersession of the ERA-40 -> ERA-Interim ->
//     ERA5 lineage, retiring ERA-40 as the recommended product. A reanalysis
//     superseded by an improved successor is deprecated, not disproven, so the
//     terminal state is ABANDONED. Community: INSTITUTIONAL (ECMWF, the
//     producing institution).
//
// No retraction, expression of concern, or failed replication exists.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-uppala-2005-era40-reanalysis.ts

const claimId = 'cmq2w4y6500l3sa8he5sgcq3y'

interface Arc {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const ARCS: Arc[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-04-01',
    datePrecision: 'MONTH',
    reason:
      'Dee et al., "The ERA-Interim reanalysis: configuration and performance of the data assimilation system" (QJRMS 137(656):553–597, April 2011) introduced ERA-40\'s successor and, in ECMWF\'s own words, was conducted "in part to prepare for a new atmospheric reanalysis to replace ERA-40." The paper places "special emphasis" on "various difficulties encountered in the production of ERA-40," documenting well-known deficiencies — notably an unrealistic representation of the hydrological cycle and spurious trends introduced by the evolving satellite observing system. This is a dated, peer-reviewed, same-institution qualification of ERA-40\'s reliability that formally contested specific fields of the reanalysis.',
    source: {
      externalId: 'src:dee-2011-era-interim',
      name: 'Dee DP, Uppala SM, Simmons AJ, et al. The ERA-Interim reanalysis: configuration and performance of the data assimilation system. Quarterly Journal of the Royal Meteorological Society 2011;137(656):553–597.',
      url: 'https://doi.org/10.1002/qj.828',
      publishedAt: '2011-04-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'ABANDONED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-06-15',
    datePrecision: 'DAY',
    reason:
      'Hersbach et al., "The ERA5 global reanalysis" (QJRMS 146(730):1999–2049, 15 June 2020) documented ECMWF\'s fifth-generation reanalysis, which replaced ERA-Interim (itself the replacement for ERA-40) and became the institution\'s reference global reanalysis from 1950 onward. ERA5 completed the supersession of the ERA-40 -> ERA-Interim -> ERA5 lineage, and ECMWF retired ERA-40 as a recommended product. A reanalysis dataset superseded by an improved successor is deprecated rather than disproven, so the finding\'s terminal state is ABANDONED.',
    source: {
      externalId: 'src:hersbach-2020-era5',
      name: 'Hersbach H, Bell B, Berrisford P, et al. The ERA5 global reanalysis. Quarterly Journal of the Royal Meteorological Society 2020;146(730):1999–2049.',
      url: 'https://doi.org/10.1002/qj.3803',
      publishedAt: '2020-06-15',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } })
  if (!claim) throw new Error(`Claim ${claimId} not found — aborting.`)

  for (const arc of ARCS) {
    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
      },
    })

    const histId = `${claimId}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: claim.id,
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`Upserted ${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
