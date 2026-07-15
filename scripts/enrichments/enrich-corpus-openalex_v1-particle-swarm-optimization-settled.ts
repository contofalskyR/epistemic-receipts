// Epistemic-receipt enrichment for claim cmq2w49c8005xsa8hktmi47kk
//
// Paper: Eberhart R, Kennedy J. "A new optimizer using particle swarm theory."
// MHS'95, Proc. Sixth Int'l Symposium on Micro Machine and Human Science, 1995.
// DOI 10.1109/mhs.1995.494215 · OpenAlex W2109364787 · ~14,887 citations
//
// Baseline row (fromAxis=null -> RECORDED at 2002-11-19) already exists; do not
// duplicate it. This script adds the post-publication adjudication:
//
//   RECORDED -> SETTLED  (2007-08, EXPERT_LITERATURE)
//     The finding — that particle swarm optimization is an effective method for
//     optimizing nonlinear functions — was adjudicated as a mature, established
//     technique by the field's authoritative overview, Poli, Kennedy & Blackwell,
//     "Particle swarm optimization," published in the inaugural volume of the
//     journal Swarm Intelligence (Vol. 1, No. 1, Aug. 2007). This peer-reviewed
//     survey (~4,000+ citations) consolidates a decade of benchmark results,
//     convergence analysis, and applications, treating PSO as a standard,
//     well-understood optimizer rather than a novel proposal.
//
// No retraction, expression of concern, failed replication, or methodological
// contest of this paper was found (Crossref/OpenAlex is_retracted = false;
// no Retraction Watch entry). The single verifiable adjudicating document is the
// consensus-establishing overview, so this is a clean RECORDED -> SETTLED with
// no intervening CONTESTED stage.
//
// Verified URLs (fetched):
//   - Poli/Kennedy/Blackwell overview DOI 10.1007/s11721-007-0002-0 -> 200
//   - Original paper DOI 10.1109/mhs.1995.494215 -> IEEE Xplore (200/202)
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-particle-swarm-optimization-settled.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-particle-swarm-optimization-settled.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w49c8005xsa8hktmi47kk'

interface TransitionDef {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED'
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

const TRANSITIONS: TransitionDef[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-08',
    datePrecision: 'MONTH',
    reason:
      'The finding that particle swarm optimization is an effective method for optimizing nonlinear functions was adjudicated as a mature, established technique by the field\'s authoritative overview: Poli, Kennedy & Blackwell, "Particle swarm optimization," in the inaugural issue of the journal Swarm Intelligence (Vol. 1, No. 1, August 2007). This peer-reviewed survey consolidates a decade of benchmark results, convergence and stability analysis, and applications, treating PSO as a standard, well-understood optimizer rather than a novel proposal. No retraction, expression of concern, or credible methodological contest of the original paper was found; the transition is therefore a direct RECORDED -> SETTLED via expert-literature consensus.',
    source: {
      externalId: 'src:poli-kennedy-blackwell-pso-overview-2007',
      name: 'Poli R, Kennedy J, Blackwell T. "Particle swarm optimization." Swarm Intelligence 1(1):33–57, August 2007.',
      url: 'https://doi.org/10.1007/s11721-007-0002-0',
      publishedAt: '2007-08-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source upsert ${t.source.externalId}`)
      console.log(`[dry-run] history upsert ${histId} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${histId} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
