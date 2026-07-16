// Enrichment: post-publication epistemic trajectory for the L-BFGS-B algorithm paper.
//
// Claim cmq2w56qs00q9sa8h0jubne2w — Byrd, Lu, Nocedal & Zhu (1995),
// "A Limited Memory Algorithm for Bound Constrained Optimization"
// (SIAM J. Sci. Comput., DOI 10.1137/0916069, OpenAlex W2000359198).
//
// The baseline RECORDED row (fromAxis=null -> RECORDED at 1995-09-01) already exists.
// This script adds ONE verified post-publication transition:
//
//   RECORDED -> CONTESTED (2011-11) — Morales & Nocedal published a formal Remark on
//   the L-BFGS-B algorithm/implementation (ACM TOMS 38(1), DOI 10.1145/2049662.2049669),
//   documenting a *correction* of an error in the subspace-minimization phase (caused by
//   the routine dpmeps used to estimate machine precision) and a significant performance
//   improvement. A dated, citable self-correction by the original author (Nocedal) of a
//   defect in the published algorithm's implementation — an EXPERT_LITERATURE contest.
//
// No retraction, failed replication, or adjudicating systematic review exists; the
// algorithm remains the de facto standard for bound-constrained optimization. Only the
// verified correction event is recorded here.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lbfgsb-1995.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lbfgsb-1995.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmq2w56qs00q9sa8h0jubne2w'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: string
  }
}

const transitions: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-11-01',
    datePrecision: 'MONTH',
    reason:
      'Morales & Nocedal published a formal Remark on the L-BFGS-B algorithm (ACM TOMS 38(1), 2011) ' +
      'documenting a correction of an error in the algorithm — caused by the routine dpmeps used to ' +
      'estimate machine precision — and a significant improvement to its subspace-minimization phase. ' +
      'A dated self-correction (by original author Nocedal) of a defect in the published algorithm, ' +
      'establishing a documented expert-literature contest over the 1995 implementation.',
    source: {
      externalId: 'src:doi:10.1145/2049662.2049669',
      name:
        'Morales & Nocedal (2011), "Remark on Algorithm 778: L-BFGS-B: Fortran subroutines for ' +
        'large-scale bound constrained optimization", ACM Trans. Math. Softw. 38(1)',
      url: 'https://doi.org/10.1145/2049662.2049669',
      publishedAt: '2011-11-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of transitions) {
    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source ${tr.source.externalId}`)
      console.log(`[dry-run] history ${histId}: ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1-lbfgsb-1995',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId,
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
      where: { claimId, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${histId}: ${tr.fromAxis} -> ${tr.toAxis}`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
