// Enrichment: post-publication epistemic trajectory for
// Paivio, A. (1986). Mental Representations: A Dual Coding Approach. Oxford University Press.
// DOI: 10.1093/acprof:oso/9780195066661.001.0001 · OpenAlex: W1483155202
// Claim: cmplxocm201svsa7fnwe467cn
//
// Baseline (fromAxis=null -> RECORDED @ 1986-03-13) already exists — NOT duplicated here.
// This script adds one documented post-publication transition:
//   RECORDED -> CONTESTED (2024): Higdon, Neath, Surprenant & Ensor directly test dual
//     coding against a distinctiveness account of the picture-superiority effect — the
//     flagship prediction of the imaginal/nonverbal coding system restated in the 1986
//     book — and conclude dual coding is no longer a viable explanation of that effect.
//
// No SETTLED/REVERSED step is added: the picture-superiority mechanism remains actively
// disputed (competing distinctiveness and aphantasia-based challenges through 2026), and
// no meta-analysis or consensus statement adjudicates dual coding theory as a whole.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-paivio-mental-representations.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxocm201svsa7fnwe467cn'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  // ── RECORDED -> CONTESTED (2024): the flagship prediction is attributed to a rival mechanism ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2024-02-15',
    datePrecision: 'DAY',
    reason:
      'The picture-superiority effect is the flagship empirical prediction of the imaginal/nonverbal ' +
      'coding system that Paivio restated in this 1986 book. Higdon, Neath, Surprenant, and Ensor ' +
      'directly pitted dual coding against a distinctiveness account: by equating physical ' +
      'distinctiveness across modalities (varying word fonts/colours, using plain line drawings) they ' +
      'eliminated the effect, and conclude that "distinctiveness, not dual coding, explains the ' +
      'picture-superiority effect" — making dual coding theory\'s account of its signature phenomenon ' +
      'contested within the expert literature.',
    source: {
      externalId: 'src:higdon-2024-distinctiveness-not-dual-coding',
      name: 'Higdon, K. F., Neath, I., Surprenant, A. M., & Ensor, T. M. (2024). Distinctiveness, not dual coding, explains the picture-superiority effect. Quarterly Journal of Experimental Psychology, 78(1).',
      url: 'https://doi.org/10.1177/17470218241235520',
      publishedAt: '2024-02-15',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} post-publication transition(s)...`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-paivio-mental-representations',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
