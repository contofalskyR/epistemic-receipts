// Enrichment: post-publication epistemic trajectory for Rosenstock, Strecher &
// Becker 1988, "Social Learning Theory and the Health Belief Model"
// (Health Education & Behavior 15(2):175-183).
//
// Claim:    cmplxt95o046jsa7fhpl5h7hm
// DOI:      10.1177/109019818801500203  (SAGE page confirms identity)
// OpenAlex: W2158216255
//
// The baseline row (fromAxis=null -> RECORDED at 1988-06-01) already exists; do
// NOT duplicate it. This script adds the one verified downstream transition.
//
// Arc:
//   RECORDED -> CONTESTED (2010-12-09, EXPERT_LITERATURE)
//     The paper's central prediction — that a revised Health Belief Model
//     incorporating self-efficacy "will more fully account for health-related
//     behavior than did earlier formulations" — was directly contested by
//     Carpenter's meta-analysis of 18 studies (2,702 subjects), "A Meta-Analysis
//     of the Effectiveness of Health Belief Model Variables in Predicting
//     Behavior" (Health Communication 2010;25(8):661-669,
//     DOI 10.1080/10410236.2010.521906). It found that two of the four core HBM
//     predictors (perceived severity and susceptibility) were weak, and concluded
//     that "the continued use of the direct effects version of the HBM is not
//     recommended" — disputing the model's claimed predictive strength. Benefits
//     and barriers remained the strongest predictors, so the model was contested
//     rather than wholly overturned; no REVERSED node is added.
//
// No retraction or expression of concern exists (Retraction Watch / PubMed
// negative), and no later systematic review vindicates the revised formulation as
// settled consensus, so the arc terminates at CONTESTED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rosenstock-1988-social-learning-theory-health-belief-model.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rosenstock-1988-social-learning-theory-health-belief-model.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxt95o046jsa7fhpl5h7hm'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-12-09',
    datePrecision: 'DAY',
    reason:
      'The paper predicted that its revised Health Belief Model — incorporating self-efficacy alongside perceived susceptibility, severity, benefits, and barriers — would "more fully account for health-related behavior than did earlier formulations." Carpenter\'s meta-analysis of 18 studies (2,702 subjects) found that two of the four core HBM predictors (perceived severity and susceptibility) were weak, with only benefits and barriers consistently predictive, and concluded that "the continued use of the direct effects version of the HBM is not recommended." This directly disputes the model\'s claimed predictive strength, moving the finding into contested status.',
    source: {
      externalId: 'src:carpenter-hbm-meta-analysis-2010',
      name: 'Carpenter CJ. A Meta-Analysis of the Effectiveness of Health Belief Model Variables in Predicting Behavior. Health Communication. 2010;25(8):661-669. DOI 10.1080/10410236.2010.521906.',
      url: 'https://doi.org/10.1080/10410236.2010.521906',
      publishedAt: '2010-12-09',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry] ${slug}  ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
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
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
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
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${slug}  ${tr.fromAxis} -> ${tr.toAxis} (${tr.community})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
