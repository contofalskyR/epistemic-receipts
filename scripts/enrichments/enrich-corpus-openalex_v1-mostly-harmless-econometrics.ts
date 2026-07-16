// Epistemic-receipt enrichment for Angrist & Pischke (2009), "Mostly Harmless
// Econometrics: An Empiricist's Companion," Princeton University Press.
// DOI 10.1515/9781400829828. OpenAlex W2577227262.
//
// Claim id (existing): cmplzpiax00b1sa86tbttxm11
// The baseline row (fromAxis=null -> RECORDED @ 2009-12-31) already exists; this
// script only adds the post-publication arc.
//
// This is a methods textbook, not a single empirical finding, so there is no
// retraction, failed replication, or adjudicating meta-analysis. The claim it
// makes — that the modern experimentalist toolkit (linear regression for control,
// instrumental variables for natural experiments, differences-in-differences for
// policy changes) answers clear causal questions — was ratified by the field's
// highest institutional honour.
//
// Arc:
//   RECORDED -> SETTLED (2021-10-11) : The Royal Swedish Academy of Sciences
//                awarded the 2021 Sveriges Riksbank Prize in Economic Sciences in
//                Memory of Alfred Nobel jointly to Joshua D. Angrist (co-author of
//                this book) and Guido W. Imbens "for their methodological
//                contributions to the analysis of causal relationships" — the
//                natural-experiment / IV / diff-in-diff credibility-revolution
//                paradigm this book codifies. An institutional consensus event
//                settling the standing of these methods as the field's core toolkit.
//
// Idempotent: upserts source on externalId and claimStatusHistory on id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mostly-harmless-econometrics.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmplzpiax00b1sa86tbttxm11'

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
    community: 'INSTITUTIONAL',
    occurredAt: '2021-10-11',
    datePrecision: 'DAY',
    reason:
      'On 11 October 2021 the Royal Swedish Academy of Sciences awarded the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel jointly to Joshua D. Angrist (co-author of Mostly Harmless Econometrics) and Guido W. Imbens "for their methodological contributions to the analysis of causal relationships." The prize explicitly recognized the natural-experiment, instrumental-variables, and differences-in-differences methodology — the "credibility revolution" experimentalist paradigm — that this book codifies, ratifying these tools as the settled core of the applied econometric toolkit.',
    source: {
      externalId: 'src:nobel-econ-2021-angrist-imbens-causal-methods',
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2021 — David Card; Joshua D. Angrist and Guido W. Imbens "for their methodological contributions to the analysis of causal relationships." Royal Swedish Academy of Sciences.',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2021/summary/',
      publishedAt: '2021-10-11',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1-mostly-harmless-econometrics',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions upserted for claim ${claimId}.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
