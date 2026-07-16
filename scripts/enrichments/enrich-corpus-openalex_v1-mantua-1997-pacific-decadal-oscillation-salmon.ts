import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Mantua, Hare, Zhang, Wallace & Francis (1997),
//   "A Pacific Interdecadal Climate Oscillation with Impacts on Salmon Production",
//   Bulletin of the American Meteorological Society 78:1069–1079.
//   DOI: 10.1175/1520-0477(1997)078<1069:APICOW>2.0.CO;2 · OpenAlex W2093401535
//
// This is the paper that named and defined the Pacific Decadal Oscillation (PDO).
// The baseline ClaimStatusHistory row (null -> RECORDED at 1997-06) already exists;
// this script adds only the post-publication arc.
//
// Verified adjudicating event (one transition):
//   RECORDED -> SETTLED (2016-06-15) — Newman et al., "The Pacific Decadal
//   Oscillation, Revisited," Journal of Climate 29:4399–4427. A 15-author synthesis
//   review (co-authored by Mantua, the original author) that consolidated the PDO as
//   a robust, canonical descriptor of North Pacific ocean–atmosphere variability while
//   refining its mechanism (the sum of several independent processes rather than a
//   single dynamical mode). Community: EXPERT_LITERATURE.
//
// No retraction, expression of concern, failed replication, or polarity reversal exists.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mantua-1997-pacific-decadal-oscillation-salmon.ts

const claimId = 'cmq2w4xwc00kxsa8hvcykxk3l'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-06-15',
    datePrecision: 'DAY',
    reason:
      'Newman et al., "The Pacific Decadal Oscillation, Revisited" (Journal of Climate 29:4399–4427, 2016) — a 15-author synthesis review co-authored by Mantua, the original 1997 author — adjudicated two decades of research and affirmed the PDO as a robust, canonical feature of North Pacific climate variability whose leading-EOF index is a standard descriptor across oceanography and climate science. The review settled the finding while refining its physical interpretation: the PDO is best understood as the sum of several independent processes (ENSO teleconnections, Aleutian Low variability, and oceanic re-emergence/memory) rather than a single dynamical mode, but the pattern, its multidecadal irregularity, and the mid-century polarity reversals reported by Mantua et al. (1997) were upheld.',
    source: {
      externalId: 'src:newman-2016-pdo-revisited',
      name: 'Newman M, Alexander MA, Ault TR, Cobb KM, Deser C, Di Lorenzo E, Mantua NJ, Miller AJ, Minobe S, Nakamura H, Schneider N, Vimont DJ, Phillips AS, Scott JD, Smith CA. The Pacific Decadal Oscillation, Revisited. Journal of Climate 2016;29(12):4399–4427.',
      url: 'https://doi.org/10.1175/JCLI-D-15-0508.1',
      publishedAt: '2016-06-15',
      methodologyType: 'derivative',
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
