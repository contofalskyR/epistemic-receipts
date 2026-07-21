// Enrichment: post-publication epistemic trajectory for the ISC 2009 Nature paper
// "Common polygenic variation contributes to risk of schizophrenia and bipolar disorder"
// (Purcell et al., International Schizophrenia Consortium, Nature 2009; DOI 10.1038/nature08185).
//
// Baseline row (fromAxis=null -> RECORDED at 2009-07-01) already exists; do NOT duplicate.
//
// This enrichment adds the one verified adjudicating transition:
//   RECORDED -> SETTLED (2013-08-11), community EXPERT_LITERATURE
// The finding was never formally contested; it was progressively vindicated. The Psychiatric
// Genomics Consortium Cross-Disorder Group (Lee et al., Nature Genetics 2013) estimated
// SNP-based genetic correlations across five psychiatric disorders and confirmed a substantial
// shared common-variant polygenic component between schizophrenia and bipolar disorder
// (genetic correlation ~0.68), directly settling the ISC 2009 shared-polygenic claim.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-purcell-polygenic-schizophrenia-bipolar-2009.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-purcell-polygenic-schizophrenia-bipolar-2009.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmpm48c6x1j1psadn4p0uj0kp'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface TransitionDef {
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

const TRANSITIONS: TransitionDef[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-08-11',
    datePrecision: 'DAY',
    reason:
      'The Cross-Disorder Group of the Psychiatric Genomics Consortium (Lee et al., Nature Genetics 2013) estimated SNP-based genetic correlations across five major psychiatric disorders and found a substantial shared common-variant polygenic component between schizophrenia and bipolar disorder (genetic correlation ~0.68). This large-consortium analysis directly confirmed the ISC 2009 finding that common polygenic variation contributes to — and is shared across — risk of schizophrenia and bipolar disorder, establishing it as settled consensus in psychiatric genetics.',
    source: {
      externalId: 'src:pgc-cross-disorder-snp-correlations-2013',
      name: 'Cross-Disorder Group of the Psychiatric Genomics Consortium (Lee SH, et al.). Genetic relationship between five psychiatric disorders estimated from genome-wide SNPs. Nature Genetics 2013;45(9):984–994.',
      url: 'https://doi.org/10.1038/ng.2711',
      publishedAt: '2013-08-11',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${t.source.externalId}`)
      console.log(`[dry-run] would upsert claimStatusHistory ${slug} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
      continue
    }

    await prisma.source.upsert({
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
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug}: ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
