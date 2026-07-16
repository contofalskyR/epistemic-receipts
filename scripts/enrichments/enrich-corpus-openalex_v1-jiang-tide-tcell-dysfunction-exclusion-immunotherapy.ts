// Epistemic-receipt enrichment for corpus claim:
//   "Signatures of T cell dysfunction and exclusion predict cancer immunotherapy response"
//   Jiang et al., Nature Medicine 2018 (the TIDE method).
//   Claim id: cmplzmmqt03c7sat0zl014293
//   DOI: https://doi.org/10.1038/s41591-018-0136-1 · OpenAlex: W2886498337
//
// Post-publication arc added (baseline fromAxis=null -> RECORDED at 2018-08-13 already exists — NOT duplicated here):
//   RECORDED -> CONTESTED (2026-01-21): a systematic benchmarking review in npj Precision
//   Oncology (Zhou, Kirshtein & Shahriyari) evaluated gene-based tumor-microenvironment
//   scoring methods — including TIDE — for predicting immune-checkpoint-inhibitor response
//   across many cancer cohorts. It found substantial variability, no score robustly
//   applicable across all cancer types, and TIDE not among the most robust performers
//   (TIP Hot ranked ahead in NSCLC/HNSCC/urothelial). This is a specific, dated
//   methodological critique of the generalizability of the TIDE finding beyond its
//   melanoma-centric validation — it does not allege fraud or retract the original result.
//
// No retraction or expression of concern exists for the original paper (checked
// PubMed 30127393, publisher page, Retraction Watch — none found).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-jiang-tide-tcell-dysfunction-exclusion-immunotherapy.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-jiang-tide-tcell-dysfunction-exclusion-immunotherapy.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzmmqt03c7sat0zl014293'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
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
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2026-01-21',
    datePrecision: 'DAY',
    reason:
      'A systematic benchmarking review in npj Precision Oncology (Zhou, Kirshtein & Shahriyari, 2026) evaluated gene-based tumor-microenvironment scoring methods — including TIDE — for predicting immune-checkpoint-inhibitor response across many cancer cohorts. It reported substantial variability in performance and that no single score, TIDE included, is robustly applicable across all cancer types, with other methods (e.g. TIP Hot) ranking ahead in NSCLC, HNSCC and urothelial cancer. This is a dated, peer-reviewed methodological critique of the generalizability of the TIDE signature beyond its original melanoma-centric validation; it does not retract or allege error in the 2018 result.',
    source: {
      externalId: 'src:tme-scoring-benchmark-npj-2026',
      name: 'Zhou Q, Kirshtein A, Shahriyari L. Towards the tumor microenvironment scoring methods for immune checkpoint inhibitor response. npj Precision Oncology 2026;10:88.',
      url: 'https://www.nature.com/articles/s41698-025-01221-z',
      publishedAt: '2026-01-21',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
        ingestedBy: 'enrich:openalex_v1-tide-immunotherapy',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
