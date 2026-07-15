// Enrichment: post-publication epistemic trajectory for
// Huang et al. (2020), "Clinical features of patients infected with 2019 novel
// coronavirus in Wuhan, China," The Lancet 395(10223):497–506.
// DOI: 10.1016/s0140-6736(20)30183-5 · OpenAlex: W3001118548
// Claim id (existing): cmply49n7003fsaihmvsb7rxj
//
// Baseline row (fromAxis=null -> RECORDED at 2020-01-24) already exists; do NOT
// duplicate it. This script adds only the post-publication arc.
//
// Identity verified via Crossref: title/authors (Huang, Wang, Li) and journal
// (The Lancet) match. Crossref shows an ERRATUM (10.1016/s0140-6736(20)30252-x,
// 2020-02-15) — a minor correction — and NO retraction or expression of concern
// (update-to: null; no retraction relation). Retraction Watch / PubMed: none.
//
// Post-publication trajectory:
//  - The first-cohort clinical description of COVID-19 (fever, cough, dyspnea,
//    lymphopenia, ground-glass opacities, ARDS as the leading complication) was
//    never contested; it was rapidly corroborated by larger cohorts and pooled
//    by systematic review. RECORDED -> SETTLED at the publication of
//    Rodriguez-Morales et al. (2020), a PRISMA systematic review and
//    meta-analysis of COVID-19 clinical, laboratory and imaging features that
//    adjudicated (vindicated) the clinical picture across the early literature.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-huang-2020-covid-clinical-features.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-huang-2020-covid-clinical-features.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply49n7003fsaihmvsb7rxj'

type FactStatus = 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
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
    occurredAt: '2020-03-01',
    datePrecision: 'MONTH',
    reason:
      'Rodriguez-Morales et al. published a PRISMA systematic review and meta-analysis of the clinical, laboratory and imaging features of COVID-19, pooling the early cohort literature (including Huang et al.). It confirmed the clinical picture first described in Wuhan — fever and cough as dominant symptoms, lymphopenia, bilateral ground-glass opacities, and ARDS as the leading severe complication — settling the finding as the corroborated clinical presentation of the disease rather than a single-cohort observation.',
    source: {
      externalId: 'src:rodriguez-morales-2020-covid-clinical-meta-analysis',
      name: 'Rodriguez-Morales AJ, Cardona-Ospina JA, Gutiérrez-Ocampo E, et al. Clinical, laboratory and imaging features of COVID-19: A systematic review and meta-analysis. Travel Medicine and Infectious Disease. 2020;34:101623.',
      url: 'https://doi.org/10.1016/j.tmaid.2020.101623',
      publishedAt: '2020-03-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' [DRY-RUN]' : ''}`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source ${tr.source.externalId}`)
      console.log(`  would upsert history ${slug}: ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.datePrecision})`)
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
        ingestedBy: 'enrich:openalex_v1-huang-2020-covid-clinical-features',
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug}: ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}`)
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
