// Enrichment: epistemic trajectory for Joe H. Ward Jr. (1963), "Hierarchical
// Grouping to Optimize an Objective Function," Journal of the American
// Statistical Association 58(301): 236–244.
// DOI 10.1080/01621459.1963.10500845. OpenAlex W2016381774.
//
// Ward's 1963 paper introduced the agglomerative hierarchical clustering
// criterion now universally called "Ward's method": at each step it merges the
// pair of clusters whose union yields the minimum increase in an error /
// within-group variance objective. It is one of the most cited papers in all of
// statistics (~19,000+ citations) and the default hierarchical method in most
// statistical software.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum. Crossref returns null
//     for both `update-to` and `updated-by`; DOI is live.
//   - The finding was never contested as to validity. Its arc is a vindication
//     that also carried a genuine, long-lived ambiguity: over the decades two
//     different Lance–Williams recurrence implementations ("Ward1"/ward.D and
//     "Ward2"/ward.D2) were BOTH shipped in statistical packages under the label
//     "Ward's method," silently producing different dendrograms. Murtagh &
//     Legendre (2014, Journal of Classification) adjudicated this directly:
//     they proved that only the ward.D2 implementation (with squared
//     dissimilarities) faithfully optimizes Ward's 1963 objective, settling
//     which algorithm implements Ward's criterion. Their finding was
//     incorporated into R's stats::hclust (the `ward.D2` option) and is now the
//     canonical statement of the method.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 1963-03 publication). This script adds a single downstream arc:
//
//   RECORDED -> SETTLED (2014-10): Murtagh F, Legendre P, "Ward's Hierarchical
//     Agglomerative Clustering Method: Which Algorithms Implement Ward's
//     Criterion?" (Journal of Classification 31(3): 274–295). Community
//     EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ward-1963-hierarchical-grouping.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ward-1963-hierarchical-grouping.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w45sb003rsa8hinsa2w42'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> RECORDED (1963-03 publication) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-10-01',
    datePrecision: 'MONTH',
    reason:
      'Murtagh F, Legendre P, "Ward\'s Hierarchical Agglomerative Clustering Method: Which Algorithms Implement Ward\'s Criterion?" (Journal of Classification 31(3): 274–295, Oct 2014) adjudicated a decades-long ambiguity in which two different Lance–Williams recurrences ("Ward1"/ward.D and "Ward2"/ward.D2) were both distributed under the label "Ward\'s method" while producing different results. They proved that only the ward.D2 form (operating on squared dissimilarities) faithfully optimizes Ward\'s 1963 minimum-variance objective. This canonized the correct implementation — adopted as R\'s stats::hclust ward.D2 option — settling how Ward\'s criterion is realized in the expert literature.',
    source: {
      externalId: 'src:jclass-murtagh-legendre-2014-ward-criterion',
      name:
        'F. Murtagh, P. Legendre, "Ward\'s Hierarchical Agglomerative Clustering Method: Which Algorithms Implement Ward\'s Criterion?" Journal of Classification 31(3): 274–295 (October 2014). DOI 10.1007/s00357-014-9161-z.',
      url: 'https://doi.org/10.1007/s00357-014-9161-z',
      publishedAt: '2014-10-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
