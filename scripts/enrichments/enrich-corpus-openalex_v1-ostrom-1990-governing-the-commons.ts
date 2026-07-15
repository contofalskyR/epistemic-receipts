// Enrichment: post-publication epistemic trajectory for Elinor Ostrom,
// "Governing the Commons: The Evolution of Institutions for Collective Action"
// (Cambridge University Press, 1990). DOI 10.1017/cbo9780511807763.
// OpenAlex W4233654598. Claim id cmplynyv900atsaqk6v2jrcv2.
//
// Baseline RECORDED row (fromAxis=null -> RECORDED at 1990-11-30) already exists;
// this script adds only the subsequent transition(s).
//
// Arc added:
//   RECORDED -> SETTLED (INSTITUTIONAL) — 2009-10-12: the Royal Swedish Academy
//   of Sciences awarded Ostrom the 2009 Sveriges Riksbank Prize in Economic
//   Sciences in Memory of Alfred Nobel "for her analysis of economic governance,
//   especially the commons," the analysis whose empirical and institutional core
//   is this book. The award constitutes a top-tier institutional ratification of
//   the finding that self-organized communities can sustainably govern common-pool
//   resources without state control or privatization.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ostrom-1990-governing-the-commons.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ostrom-1990-governing-the-commons.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplynyv900atsaqk6v2jrcv2'

interface Arc {
  fromAxis: string | null
  toAxis: string
  community: string
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
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2009-10-12',
    datePrecision: 'DAY',
    reason:
      'On 12 October 2009 the Royal Swedish Academy of Sciences awarded Elinor Ostrom the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel "for her analysis of economic governance, especially the commons." Governing the Commons is the empirical and theoretical core of that body of work, demonstrating that user communities can craft durable institutions to manage common-pool resources without resorting to state control or privatization. The prize represents a top-tier institutional ratification of the book\'s central finding.',
    source: {
      externalId: 'src:nobel-econ-2009-ostrom-commons',
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2009 — Elinor Ostrom, "for her analysis of economic governance, especially the commons." Royal Swedish Academy of Sciences.',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2009/ostrom/facts/',
      publishedAt: '2009-10-12',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const arc of ARCS) {
    const id = `${CLAIM_ID}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`
    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${arc.source.externalId} and history ${id}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich-openalex_v1',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
        claimId: CLAIM_ID,
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community as never,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community as never,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${id} (${arc.fromAxis} -> ${arc.toAxis}, ${arc.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
