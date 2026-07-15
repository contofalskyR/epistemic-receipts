// Enrichment: post-publication epistemic trajectory for
// Bandura, "Social Foundations of Thought and Action: A Social Cognitive Theory" (1985/1986)
// OpenAlex W2888190061 · no DOI (book) · claim cmplxk8zf000dsa6hllmowqoa
//
// Baseline row (fromAxis=null -> RECORDED at 1985-10-11) already exists; not duplicated here.
//
// Arc added:
//   RECORDED -> SETTLED (1998-09) via Stajkovic & Luthans (1998), Psychological Bulletin,
//   "Self-efficacy and work-related performance: A meta-analysis." The book's central and
//   most-cited construct (self-efficacy, Ch. 9) is adjudicated as a robust, generalizable
//   predictor of performance across 114 studies — settling the theory's core empirical
//   prediction in the expert literature.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bandura-1986-social-foundations.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bandura-1986-social-foundations.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxk8zf000dsa6hllmowqoa'

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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1998-09-01',
    datePrecision: 'MONTH',
    reason:
      'Stajkovic and Luthans meta-analyzed 114 studies in Psychological Bulletin and found a strong positive relationship between self-efficacy and work-related performance (weighted average correlation G(r) = .38, corresponding to a 28% average gain), adjudicating the central empirical prediction of Bandura\'s social cognitive theory. Self-efficacy — the book\'s core construct (Ch. 9) — was thereby established as a robust, generalizable predictor of performance across domains, converging with earlier academic-outcome meta-analyses (Multon, Brown & Lent, 1991). This settled the theory\'s key claim in the expert literature rather than merely accumulating citations.',
    source: {
      externalId: 'src:stajkovic-luthans-1998-self-efficacy-meta',
      name: 'Stajkovic & Luthans (1998), "Self-efficacy and work-related performance: A meta-analysis," Psychological Bulletin 124(2), 240–261',
      url: 'https://doi.org/10.1037/0033-2909.124.2.240',
      publishedAt: '1998-09-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} (Bandura 1986, Social Foundations of Thought and Action)`)
  console.log(DRY_RUN ? '[DRY RUN — no writes]\n' : '')

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source  ${tr.source.externalId}`)
      console.log(`  would upsert history ${slug}  (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:openalex_v1-bandura-1986-social-foundations',
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug}  (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
