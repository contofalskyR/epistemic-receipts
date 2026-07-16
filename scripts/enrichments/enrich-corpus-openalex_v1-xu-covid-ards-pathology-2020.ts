// Enrichment: epistemic trajectory for Xu et al. 2020,
// "Pathological findings of COVID-19 associated with acute respiratory distress syndrome"
// Lancet Respiratory Medicine 8(4):420-422. DOI 10.1016/S2213-2600(20)30076-X. OpenAlex W3007940623.
//
// Baseline (fromAxis=null -> RECORDED @ 2020-02-18) already exists; do NOT duplicate it.
// This script adds the post-publication adjudication:
//   RECORDED -> SETTLED  @ 2020-06-22  (Polak et al. systematic review, Modern Pathology)
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-xu-covid-ards-pathology-2020.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-xu-covid-ards-pathology-2020.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyb9ux03hlsaih3bk4qq85'

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
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-06-22',
    datePrecision: 'DAY',
    reason:
      "Polak et al.'s systematic review of COVID-19 pathological findings pooled the emerging autopsy and biopsy " +
      "literature and identified diffuse alveolar damage as the predominant pulmonary pattern across studies, " +
      "corroborating and generalizing Xu et al.'s original single-case biopsy observation. This consolidated the " +
      "finding from an initial case report into the established pathological signature of COVID-19-associated ARDS.",
    source: {
      externalId: 'src:polak-2020-modpathol-covid-pathology-review',
      name: 'Polak SB et al., "A systematic review of pathological findings in COVID-19: a pathophysiological timeline and possible mechanisms of disease progression," Modern Pathology 33:2128-2138 (2020)',
      url: 'https://doi.org/10.1038/s41379-020-0603-3',
      publishedAt: '2020-06-22',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (${slug})`)
      console.log(`          source: ${tr.source.externalId}`)
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
        ingestedBy: 'enrich:openalex_v1-xu-covid-ards-pathology-2020',
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

    console.log(`✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}  (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
