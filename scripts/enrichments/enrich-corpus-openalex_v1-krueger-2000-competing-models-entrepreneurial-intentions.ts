// Enrichment: post-publication epistemic trajectory for
//   Krueger, Reilly & Carsrud (2000), "Competing models of entrepreneurial
//   intentions," Journal of Business Venturing 15(5–6):411–432.
//   DOI 10.1016/S0883-9026(98)00033-0 · OpenAlex W2050226767
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2000-09-01) already
// exists — NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2014-03) — Schlaegel & Koenig meta-analytically test and
//   integrate the two "competing models" this paper pitted against each other
//   (Ajzen's Theory of Planned Behavior vs. Shapero–Krueger Entrepreneurial Event
//   Model). Pooling 98 studies / 123 samples / n = 114,007 via meta-analytic SEM,
//   they find empirical support for the competing theories and for an integrated
//   model — vindicating the intentions-based approach as the settled framework for
//   predicting entrepreneurial intent. Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on externalId (source) and deterministic id (history row).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-krueger-2000-competing-models-entrepreneurial-intentions.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-krueger-2000-competing-models-entrepreneurial-intentions.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm9ha0c3x8lsafw9sjae4vi'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-03-01',
    datePrecision: 'MONTH',
    reason:
      'Schlaegel & Koenig (Entrepreneurship Theory and Practice, Mar 2014) meta-analytically tested and integrated the very "competing models" Krueger et al. compared — Ajzen\'s Theory of Planned Behavior and the Shapero–Krueger Entrepreneurial Event Model. Pooling 98 studies (123 samples, n = 114,007) with meta-analytic structural equation modeling, they found empirical support for both competing theories and additional explanatory power from an integrated model. This adjudicating synthesis settled the intentions-based approach as the field\'s validated framework for predicting entrepreneurial intent, confirming rather than overturning the 2000 finding.',
    source: {
      externalId: 'src:schlaegel-koenig-2014-entrepreneurial-intent-meta-analysis',
      name: 'Schlaegel C, Koenig M. Determinants of Entrepreneurial Intent: A Meta-Analytic Test and Integration of Competing Models. Entrepreneurship Theory and Practice 2014;38(2):291–332. DOI 10.1111/etap.12087.',
      url: 'https://api.crossref.org/works/10.1111/etap.12087',
      publishedAt: '2014-03-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source ${tr.source.externalId}`)
      console.log(`  would upsert history ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:corpus-openalex_v1',
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

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
