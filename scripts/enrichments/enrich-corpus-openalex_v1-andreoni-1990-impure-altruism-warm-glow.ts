// Epistemic enrichment: Andreoni (1990) "Impure Altruism and Donations to
// Public Goods: A Theory of Warm-Glow Giving", The Economic Journal 100(401):464-477.
// DOI 10.2307/2234133 · OpenAlex W2111222789 · claim cmpm00yyk05nvsa86738ws2kz
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED, 1990-06) already exists.
// This script adds the post-publication adjudicating event only.
//
// Arc added:
//   RECORDED -> SETTLED (2016-07-28, EXPERT_LITERATURE)
//     de Wit & Bekkers (2017) meta-analysis of the crowding-out hypothesis
//     empirically adjudicates Andreoni's neutrality/invariance proposition.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-andreoni-1990-impure-altruism-warm-glow.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-andreoni-1990-impure-altruism-warm-glow.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm00yyk05nvsa86738ws2kz'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  edgeType: 'FOR' | 'AGAINST'
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-07-28',
    datePrecision: 'DAY',
    reason:
      'The de Wit & Bekkers meta-analysis in the Journal of Public Administration Research and Theory synthesized dozens of estimates of how government support affects private charitable donations and found crowding-out is generally partial and mixed — not the complete, dollar-for-dollar crowd-out that the pure-altruism neutrality benchmark predicts. Incomplete crowding-out is precisely what Andreoni\'s impure-altruism (warm-glow) model implies, empirically vindicating the paper\'s central claim that the invariance/neutrality proposition fails when donors derive private warm-glow utility from the act of giving.',
    edgeType: 'FOR',
    source: {
      externalId: 'src:dewit-bekkers-2017-crowding-out-meta-analysis',
      name: 'de Wit & Bekkers (2017), "Government Support and Charitable Donations: A Meta-Analysis of the Crowding-out Hypothesis", J. Public Administration Research and Theory 27(2):301-319',
      url: 'https://doi.org/10.1093/jopart/muw044',
      publishedAt: '2016-07-28',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID}${DRY_RUN ? ' [DRY RUN]' : ''} with ${TRANSITIONS.length} transition(s)...`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug}  ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.source.externalId})`)
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
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: tr.edgeType } })
    }

    console.log(`  ✓ ${slug}  ${tr.fromAxis} -> ${tr.toAxis}`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
