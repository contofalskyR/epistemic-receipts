// Enrichment: post-publication epistemic trajectory for the Durlak et al. (2011)
// meta-analysis of school-based universal social and emotional learning (SEL)
// programs — "The Impact of Enhancing Students' Social and Emotional Learning:
// A Meta-Analysis of School-Based Universal Interventions," Child Development,
// DOI 10.1111/j.1467-8624.2010.01564.x (OpenAlex W2128689084).
//
// The claim's baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2011 publication date) already exists and is NOT duplicated here.
//
// Post-publication finding:
//   - No retraction or expression of concern (Crossref/PubMed clean).
//   - No dated failed replication or major methodological critique located.
//   - The finding was adjudicated by a subsequent follow-up meta-analysis from
//     the same core research team: Taylor, Oberle, Durlak & Weissberg (2017),
//     "Promoting Positive Youth Development Through School-Based Social and
//     Emotional Learning Interventions: A Meta-Analysis of Follow-Up Effects,"
//     Child Development, DOI 10.1111/cdev.12864 (PMID 28685826), published
//     online 2017-07-07. It extended the 2011 result by showing SEL program
//     benefits — including academic performance — persist at follow-up (mean
//     3.75 years), vindicating rather than overturning the original finding.
//   - No prior contest => RECORDED -> SETTLED at the follow-up review date.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-durlak-2011-sel-meta-analysis.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-durlak-2011-sel-meta-analysis.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

const CLAIM_ID = 'cmplyonwa00n5saqk8gj61z7x'

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
    occurredAt: '2017-07-07',
    datePrecision: 'DAY',
    reason:
      'Taylor, Oberle, Durlak & Weissberg (2017), a follow-up meta-analysis in Child Development (DOI 10.1111/cdev.12864, PMID 28685826), adjudicated the 2011 finding by testing durability. Across dozens of school-based universal SEL programs it found that benefits — including academic performance — persisted at follow-up (mean 3.75 years), extending and confirming rather than overturning Durlak et al. (2011). With no prior contest, this establishes the finding as settled in the expert literature.',
    source: {
      externalId: 'src:openalex_v1-durlak-2011-sel-taylor-2017-followup-meta',
      name: 'Taylor RD, Oberle E, Durlak JA, Weissberg RP. "Promoting Positive Youth Development Through School-Based Social and Emotional Learning Interventions: A Meta-Analysis of Follow-Up Effects." Child Development, 2017;88(4):1156–1171. DOI 10.1111/cdev.12864 (PMID 28685826).',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28685826/',
      publishedAt: '2017-07-07',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${histId} — ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.source.externalId})`)
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
        ingestedBy: 'enrich:openalex_v1-durlak-2011-sel-meta-analysis',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
