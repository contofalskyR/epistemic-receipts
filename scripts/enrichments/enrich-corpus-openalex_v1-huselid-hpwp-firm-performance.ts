// Enrichment: epistemic trajectory for Huselid (1995),
// "The Impact of Human Resource Management Practices on Turnover, Productivity,
//  and Corporate Financial Performance," Academy of Management Journal 38:635–672.
// Claim: cmplyokyq00lnsaqk9691dtpz · DOI 10.2307/256741 · OpenAlex W3122125999
//
// Baseline RECORDED (1995-06-01) already exists — NOT duplicated here.
// Adds the post-publication arc:
//   RECORDED → CONTESTED : Wright, Gardner, Moynihan & Allen (2005) causal-order
//                          critique — cross-sectional HR→performance inference
//                          largely vanishes once past performance is controlled.
//   CONTESTED → SETTLED  : Combs, Liu, Hall & Ketchen (2006) meta-analysis —
//                          corrected r ≈ .28 HPWS→performance, confirming the
//                          systems-synergy claim central to Huselid (1995).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-huselid-hpwp-firm-performance.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-huselid-hpwp-firm-performance.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyokyq00lnsaqk9691dtpz'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  // ── Causal-order critique contests the finding (Wright et al. 2005) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2005-05-01',
    datePrecision: 'MONTH',
    reason:
      'Wright, Gardner, Moynihan & Allen (2005), "The relationship between HR practices and firm performance: Examining causal order" (Personnel Psychology 58:409–446), directly challenged the causal inference of the cross-sectional HR–performance studies exemplified by Huselid (1995). Controlling for past firm performance, they found the HR-practices → future-performance relationship largely disappeared, raising reverse-causality and endogeneity doubts about the claimed impact of high-performance work practices.',
    source: {
      externalId: 'src:wright-causal-order-hr-performance-2005',
      name: 'Wright PM, Gardner TM, Moynihan LM, Allen MR. The relationship between HR practices and firm performance: examining causal order. Personnel Psychology 2005;58(2):409–446.',
      url: 'https://doi.org/10.1111/j.1744-6570.2005.00487.x',
      publishedAt: '2005-05-01',
      methodologyType: 'primary',
    },
  },
  // ── Meta-analysis adjudicates and vindicates the association (Combs et al. 2006) ──
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2006-08-01',
    datePrecision: 'MONTH',
    reason:
      'Combs, Liu, Hall & Ketchen (2006), "How much do high-performance work practices matter? A meta-analysis of their effects on organizational performance" (Personnel Psychology 59:501–528), statistically aggregated the accumulated evidence and reported a corrected correlation of about .28 between high-performance work systems and organizational performance, with systems of practices outperforming individual practices — vindicating the core systems-synergy claim of Huselid (1995) as a robust, replicated empirical regularity.',
    source: {
      externalId: 'src:combs-hpwp-meta-analysis-2006',
      name: 'Combs J, Liu Y, Hall A, Ketchen D. How much do high-performance work practices matter? A meta-analysis of their effects on organizational performance. Personnel Psychology 2006;59(3):501–528.',
      url: 'https://doi.org/10.1111/j.1744-6570.2006.00045.x',
      publishedAt: '2006-08-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transitions`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} → ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
        ingestedBy: 'enrich:corpus-openalex_v1-huselid',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} → ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
