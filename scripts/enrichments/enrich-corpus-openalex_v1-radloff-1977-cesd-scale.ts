// Epistemic-receipt enrichment for claim cmpm3uzon1a6asaeru060h1jd
// Radloff LS. "The CES-D Scale: A Self-Report Depression Scale for Research in the
// General Population." Applied Psychological Measurement 1(3):385–401, June 1977.
// DOI 10.1177/014662167700100306 · OpenAlex W2112778345
//
// Baseline row (fromAxis=null -> RECORDED at 1977-06) already exists; do NOT duplicate it.
//
// Post-publication trajectory found:
//  - No retraction or expression of concern (Crossref shows no update-to/relation records;
//    Retraction Watch / PubMed / SAGE publisher page show no notice).
//  - Adjudicating document: Vilagut, Forero, Barbaglia & Alonso (2016), a PRISMA systematic
//    review with meta-analysis in PLOS ONE, pooled the diagnostic-accuracy evidence and
//    confirmed the CES-D as a valid screening instrument for depression in the general
//    population — vindicating the 1977 validity claim. => RECORDED -> SETTLED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-radloff-1977-cesd-scale.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-radloff-1977-cesd-scale.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm3uzon1a6asaeru060h1jd'

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
    occurredAt: '2016-05-16',
    datePrecision: 'DAY',
    reason:
      'Vilagut, Forero, Barbaglia & Alonso published a PRISMA systematic review with meta-analysis in PLOS ONE that pooled the diagnostic-accuracy literature for the CES-D across general-population and primary-care samples. It found acceptable, well-characterised screening performance (pooled sensitivity/specificity trading off by cut-point), adjudicating four decades of validation studies and confirming the CES-D as a valid depression-screening instrument — vindicating Radloff\'s 1977 validity claim rather than overturning it.',
    source: {
      externalId: 'src:vilagut-2016-cesd-meta-analysis',
      name: 'Vilagut G, Forero CG, Barbaglia G, Alonso J. Screening for Depression in the General Population with the Center for Epidemiologic Studies Depression (CES-D): A Systematic Review with Meta-Analysis. PLOS ONE 2016;11(5):e0155431.',
      url: 'https://doi.org/10.1371/journal.pone.0155431',
      publishedAt: '2016-05-16',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${tr.source.externalId}`)
      console.log(`[dry-run] would upsert ClaimStatusHistory ${slug} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:openalex_v1-radloff-1977-cesd-scale',
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

    console.log(`Upserted ${slug} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
