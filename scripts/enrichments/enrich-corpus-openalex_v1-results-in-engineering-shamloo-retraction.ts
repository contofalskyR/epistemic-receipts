// Enrichment: epistemic trajectory for the retracted Results in Engineering article
// (claim 80177906-30e1-4475-9512-ce30263699ac).
//
// The claim is the retraction notice itself (ingested via openalex_v1). Its
// underlying paper was published in Elsevier's Results in Engineering (RECORDED),
// then retracted by the journal's Executive Editors for suspected plagiarism of a
// manuscript submitted to Thermal Science and Engineering Progress by the same
// authors together with Prof. Amir Shamloo (Sharif University of Technology), who
// supervised the original data collection (REVERSED).
//
// Only the retraction transition is added. The original publication date/DOI could
// not be verified without a live lookup, so no OPEN->RECORDED or CONTESTED arc is
// fabricated. The single high-confidence, verbatim-in-claim source is the Elsevier
// article-withdrawal policy page.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-results-in-engineering-shamloo-retraction.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-results-in-engineering-shamloo-retraction.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = '80177906-30e1-4475-9512-ce30263699ac'

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

// Only include transitions backed by a specific, high-confidence source.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-12-26',
    datePrecision: 'DAY',
    reason:
      'The Executive Editors of Results in Engineering (Elsevier) retracted the article for suspected plagiarism of a manuscript submitted to Thermal Science and Engineering Progress by the same authors, together with Professor Amir Shamloo of Sharif University of Technology, who supervised the original data collection underpinning the research. The retraction notice invokes the Elsevier Policy on Article Withdrawal, reversing the article\'s standing in the peer-reviewed record.',
    source: {
      externalId: 'src:elsevier-article-withdrawal-policy:results-in-engineering-shamloo-2024',
      name: 'Retraction notice — Results in Engineering (Elsevier), invoking the Elsevier Policy on Article Withdrawal (suspected plagiarism; authors incl. Prof. Amir Shamloo, Sharif University of Technology).',
      url: 'https://www.elsevier.com/about/policies/article-withdrawal',
      publishedAt: '2024-12-26',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${tr.source.externalId}`)
      console.log(`[dry-run] would upsert claimStatusHistory ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
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
        ingestedBy: 'enrich:corpus-openalex_v1-shamloo-retraction',
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

    console.log(`upserted ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
