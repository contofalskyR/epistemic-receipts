// Epistemic-receipt enrichment for claim cmply6usd01d9saih3q3daf2v
// "The PHQ-9: Validity of a Brief Depression Severity Measure" (Kroenke, Spitzer, Williams)
// Journal of General Internal Medicine 2001;16(9):606–613. DOI 10.1046/j.1525-1497.2001.016009606.x
// OpenAlex W2132322340. Published 2001-09.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2001-09-01) already exists.
// This script adds the post-publication arc:
//   RECORDED -> CONTESTED  (Manea et al., CMAJ 2012 — optimal-cutoff meta-analysis)
//   CONTESTED -> SETTLED   (Levis et al., BMJ 2019 — DEPRESSD individual participant data meta-analysis)
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-phq9-kroenke-2001.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply6usd01d9saih3q3daf2v'

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
    occurredAt: '2012-02-01',
    datePrecision: 'MONTH',
    reason:
      "Manea, Gilbody & McMillan's meta-analysis (CMAJ 2012;184(3):E191–E196) placed the PHQ-9's diagnostic operating characteristics into methodological contest. Pooling validation studies, it found that the instrument's accuracy for detecting major depression was cutoff-dependent and that the widely recommended >=10 threshold was not uniquely optimal — acceptable properties spanned cutoffs of 8 to 11 — raising concern that data-driven cutoff selection in earlier validations had overstated its performance.",
    source: {
      externalId: 'src:phq9-manea-cmaj-2012',
      name: 'Manea L, Gilbody S, McMillan D. Optimal cut-off score for diagnosing depression with the Patient Health Questionnaire (PHQ-9): a meta-analysis. CMAJ 2012;184(3):E191–E196.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/22184363/',
      publishedAt: '2012-02-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2019-04-09',
    datePrecision: 'DAY',
    reason:
      "The DEPRESSD Collaboration's individual participant data meta-analysis (Levis, Benedetti & Thombs, BMJ 2019;365:l1476) settled the debate by pooling raw participant-level data across 44 studies (~17,000 participants), avoiding the cutoff-selection bias of prior reviews. It confirmed that a PHQ-9 score of >=10 maximizes combined sensitivity (0.85) and specificity (0.85) for major depression, vindicating the standard cutoff and the instrument's validity as a brief depression measure.",
    source: {
      externalId: 'src:phq9-levis-bmj-2019',
      name: 'Levis B, Benedetti A, Thombs BD, on behalf of the DEPRESSD Collaboration. Accuracy of Patient Health Questionnaire-9 (PHQ-9) for screening to detect major depression: individual participant data meta-analysis. BMJ 2019;365:l1476.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/30967483/',
      publishedAt: '2019-04-09',
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
        ingestedBy: 'enrich:openalex_v1-phq9-kroenke-2001',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
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

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done: 2 transitions upserted for PHQ-9 (claim ' + CLAIM_ID + ').')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
