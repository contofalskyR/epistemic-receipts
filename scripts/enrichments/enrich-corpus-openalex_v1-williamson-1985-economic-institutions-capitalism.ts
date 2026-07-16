// Epistemic-receipt enrichment for corpus claim cmplzstp901vdsa86oet0j7i2
// Oliver E. Williamson, "The Economic Institutions of Capitalism: Firms,
// Markets, Relational Contracting" (1985; OpenAlex W3122093892, dated 1987-01-01).
// Foundational statement of transaction cost economics.
//
// Baseline row (fromAxis=null -> RECORDED at 1987-01-01) already exists; do NOT
// duplicate it. This script adds the post-publication arc.
//
// Post-publication event:
//   RECORDED -> SETTLED (2009-10-12, INSTITUTIONAL) — The Royal Swedish Academy
//   of Sciences awarded Williamson the 2009 Sveriges Riksbank Prize in Economic
//   Sciences in Memory of Alfred Nobel "for his analysis of economic governance,
//   especially the boundaries of the firm" — the transaction-cost / relational-
//   contracting governance framework set out in this book. The prize is the
//   canonical institutional consensus signal in economics and names this
//   finding directly, marking its settlement within the discipline.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-williamson-1985-economic-institutions-capitalism.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-williamson-1985-economic-institutions-capitalism.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzstp901vdsa86oet0j7i2'

interface Arc {
  slug: string
  fromAxis: string | null
  toAxis: string
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const ARCS: Arc[] = [
  {
    slug: `${CLAIM_ID}-SETTLED-2009-10-12`,
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2009-10-12',
    datePrecision: 'DAY',
    reason:
      'The Royal Swedish Academy of Sciences awarded Oliver Williamson the 2009 ' +
      'Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel ' +
      '"for his analysis of economic governance, especially the boundaries of the firm." ' +
      'The citation names precisely the transaction-cost economics and relational-contracting ' +
      'governance framework set out in this book, ratifying it as settled within the discipline.',
    source: {
      externalId: 'src:nobel-economics-2009-williamson',
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2009 — Oliver E. Williamson (facts)',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2009/williamson/facts/',
      publishedAt: '2009-10-12',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const arc of ARCS) {
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt} (${arc.community})`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: arc.slug },
      create: {
        id: arc.slug,
        claimId: CLAIM_ID,
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
    })
  }

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Done. ${ARCS.length} transition(s) processed for claim ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
