// Epistemic-receipt enrichment for Kahn (1990), "Psychological Conditions of
// Personal Engagement and Disengagement at Work," Academy of Management Journal
// 33(4):692–724. DOI 10.2307/256287 (alias 10.5465/256287). OpenAlex W2132199097.
//
// Claim id (existing): cmplxuks704svsa7f7u81ehks
// The baseline row (fromAxis=null -> RECORDED @ 1990-12-01) already exists; this
// script only adds the post-publication arc.
//
// Arc:
//   RECORDED  -> CONTESTED (2008-03) : Macey & Schneider argue the engagement
//                construct Kahn seeded is defined inconsistently across academic
//                and practitioner usage — a jangle-fallacy concern that it is
//                redundant with satisfaction/commitment/involvement.
//   CONTESTED -> SETTLED   (2011-03) : Christian, Garza & Slaughter's quantitative
//                review/meta-analysis establishes work engagement as a distinct
//                construct with incremental validity for task and contextual
//                performance beyond job attitudes; building on Rich, LePine &
//                Crawford's (2010, AMJ) operationalization of Kahn's three-
//                component (physical/cognitive/emotional) engagement.
//
// Idempotent: upserts source on externalId and claimStatusHistory on id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kahn-personal-engagement.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmplxuks704svsa7f7u81ehks'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-03-01',
    datePrecision: 'MONTH',
    reason:
      'Macey & Schneider ("The Meaning of Employee Engagement," Industrial and Organizational Psychology, March 2008) subjected the engagement construct Kahn introduced to a construct-validity critique, arguing that "engagement" is defined inconsistently across academic and practitioner usage and risks a jangle fallacy — being redundant with established constructs such as job satisfaction, organizational commitment, and job involvement. The paper opened a sustained debate over whether personal/work engagement is a distinct, measurable construct.',
    source: {
      externalId: 'src:macey-schneider-2008-meaning-employee-engagement',
      name: 'Macey WH, Schneider B. The Meaning of Employee Engagement. Industrial and Organizational Psychology 2008;1(1):3–30.',
      url: 'https://doi.org/10.1111/j.1754-9434.2007.0002.x',
      publishedAt: '2008-03-01',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-03-01',
    datePrecision: 'MONTH',
    reason:
      'Christian, Garza & Slaughter\'s quantitative review ("Work Engagement: A Quantitative Review and Test of Its Relations with Task and Contextual Performance," Personnel Psychology, March 2011) meta-analytically established work engagement as a construct distinct from job attitudes with incremental validity for task and contextual performance, directly answering the redundancy critique. It built on Rich, LePine & Crawford (2010, Academy of Management Journal) which operationalized Kahn\'s three-component physical/cognitive/emotional engagement into a validated Job Engagement Scale predicting performance — vindicating Kahn\'s original conceptualization.',
    source: {
      externalId: 'src:christian-garza-slaughter-2011-work-engagement-meta-analysis',
      name: 'Christian MS, Garza AS, Slaughter JE. Work Engagement: A Quantitative Review and Test of Its Relations with Task and Contextual Performance. Personnel Psychology 2011;64(1):89–136.',
      url: 'https://doi.org/10.1111/j.1744-6570.2010.01203.x',
      publishedAt: '2011-03-01',
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
        ingestedBy: 'enrich:corpus-openalex_v1-kahn-personal-engagement',
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
