import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Claim: Kirschner, Sweller & Clark (2006), "Why Minimal Guidance During
// Instruction Does Not Work", Educational Psychologist 41(2):75-86.
// DOI 10.1207/s15326985ep4102_1 | OpenAlex W1976637107
// Baseline row (fromAxis=null -> RECORDED @ 2006-05-01) already exists; do NOT duplicate.
const claimId = 'cmplxnlkn01fpsa7fy0sb53fq'

type Transition = {
  fromAxis: 'RECORDED' | 'CONTESTED'
  toAxis: 'CONTESTED' | 'SETTLED'
  community: 'EXPERT_LITERATURE'
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

const transitions: Transition[] = [
  {
    // Post-publication contest: the April 2007 rebuttal cluster in Educational Psychologist.
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-04-26',
    datePrecision: 'DAY',
    reason:
      'In April 2007 Educational Psychologist (vol 42, issue 2) published a cluster of direct, peer-reviewed rebuttals to Kirschner, Sweller & Clark (2006). Hmelo-Silver, Duncan & Chinn ("Scaffolding and Achievement in Problem-Based and Inquiry Learning: A Response to Kirschner, Sweller, and Clark") and Schmidt, Loyens, van Gog & Paas argued that the paper conflated scaffolded inquiry with pure discovery and that problem-based learning is in fact compatible with human cognitive architecture. This moved the central claim that minimally guided instruction fails from RECORDED to CONTESTED.',
    source: {
      externalId: 'src:hmelo-silver-2007-response-ksc',
      name: 'Hmelo-Silver, Duncan & Chinn (2007), "Scaffolding and Achievement in Problem-Based and Inquiry Learning: A Response to Kirschner, Sweller, and Clark (2006)", Educational Psychologist 42(2):99-107',
      url: 'https://doi.org/10.1080/00461520701263368',
      publishedAt: '2007-04-26',
      methodologyType: 'opinion',
    },
  },
  {
    // Adjudicating meta-analysis largely vindicating the core empirical thesis.
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-02-01',
    datePrecision: 'MONTH',
    reason:
      'Alfieri, Brooks, Aldrich & Tenenbaum (2011), "Does discovery-based instruction enhance learning?" (Journal of Educational Psychology 103(1):1-18), meta-analyzed the disputed literature and found that unassisted/pure discovery did not benefit learners and was outperformed by explicit direct instruction, while guided/enhanced discovery did help. This adjudicated the contested question largely in favor of KSC\'s core thesis that minimal, unguided instruction is ineffective, while nuancing it by validating scaffolded guidance—moving the finding from CONTESTED to SETTLED in the expert literature.',
    source: {
      externalId: 'src:alfieri-2011-discovery-meta-analysis',
      name: 'Alfieri, Brooks, Aldrich & Tenenbaum (2011), "Does discovery-based instruction enhance learning? A meta-analysis", Journal of Educational Psychology 103(1):1-18',
      url: 'https://doi.org/10.1037/a0021017',
      publishedAt: '2011-02-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of transitions) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1-kirschner-minimal-guidance-2006',
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

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
  }

  console.log('Done: 2 transitions upserted for Kirschner/Sweller/Clark 2006.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
