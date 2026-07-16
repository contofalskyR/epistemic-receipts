// Epistemic-receipt enrichment for the endophenotype-concept claim
// (Gottesman & Gould 2003, "The Endophenotype Concept in Psychiatry:
//  Etymology and Strategic Intentions," Am J Psychiatry 160(4):636–645,
//  DOI 10.1176/appi.ajp.160.4.636, OpenAlex W2146738944).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2003-03-31 publication date) already exists; do NOT duplicate it.
//
// Post-publication event added here:
//   RECORDED -> CONTESTED (2006-09-18, EXPERT_LITERATURE)
//     Flint & Munafò's meta-analytic review "The endophenotype concept in
//     psychiatric genetics" (Psychological Medicine 37(2):163–180, online
//     2006-09-18) tested the central strategic premise of Gottesman & Gould
//     2003 — that the genetic loci contributing to endophenotypes have larger
//     effect sizes, and hence a simpler genetic architecture, than those
//     contributing to the disease phenotype. Pooling effect sizes across
//     putative endophenotypes for several psychiatric disorders, they found
//     no evidence that endophenotypic effect sizes were larger than for the
//     disorders themselves, directly contesting the concept's core rationale.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-gottesman-gould-endophenotype-concept.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-gottesman-gould-endophenotype-concept.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm2cw4o0nfpsadntz0ppjcv'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2006-09-18',
    datePrecision: 'DAY',
    reason:
      'Flint & Munafò\'s meta-analytic review "The endophenotype concept in psychiatric genetics" (Psychological Medicine 37(2):163–180, published online 2006-09-18) directly tested the central strategic premise of Gottesman & Gould 2003 — that endophenotypes have larger genetic effect sizes, and thus a simpler genetic architecture, than the disease syndrome. Pooling effect sizes for putative endophenotypes across several psychiatric disorders, they found no evidence that endophenotypic effects were larger than those for the disorders themselves, contesting the concept\'s core rationale for being easier to analyse genetically.',
    source: {
      externalId: 'src:flint-munafo-endophenotype-critique-2007',
      name: 'Flint J, Munafò MR. The endophenotype concept in psychiatric genetics. Psychological Medicine. 2007;37(2):163–180. doi:10.1017/S0033291706008750 (published online 2006-09-18).',
      url: 'https://doi.org/10.1017/S0033291706008750',
      publishedAt: '2006-09-18',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source ${tr.source.externalId}`)
      console.log(`  would upsert claimStatusHistory ${slug} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:openalex_v1-endophenotype-concept',
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
