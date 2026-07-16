// Enrichment: post-publication epistemic trajectory for Marsha Linehan's 1993
// "Cognitive-Behavioral Treatment of Borderline Personality Disorder" (Guilford
// Press) — the founding text of Dialectical Behavior Therapy (DBT).
//
// Claim:    cmplxlrto00jjsa7fppqu0i7x
// DOI:      not available (Guilford Press monograph)
// OpenAlex: W1637267194
//
// The baseline row (fromAxis=null -> RECORDED at 1993-01-01) already exists; do
// NOT duplicate it. This script adds the single verified downstream transition.
//
// Arc:
//   RECORDED -> SETTLED (2020-05-04, EXPERT_LITERATURE)
//     The book's central claim was that its DBT strategies were "proven effective
//     in controlled clinical trials." The Cochrane systematic review and
//     meta-analysis "Psychological therapies for people with borderline
//     personality disorder" (Storebø, Stoffers-Winterling, Völlm et al.,
//     Cochrane Database Syst Rev 2020;5:CD012955, DOI 10.1002/14651858.CD012955.pub2)
//     is the definitive evidence synthesis of exactly those trials. Pooling the
//     RCT evidence, it found DBT superior to treatment-as-usual for reducing BPD
//     severity, self-harm, and improving psychosocial functioning — the largest
//     and most-studied psychotherapy in the review. This adjudicates the 1993
//     efficacy claim as durable field consensus (corroborated by DBT's inclusion
//     in the NICE BPD guideline CG78, 2009). Because DBT was progressively
//     validated rather than seriously contested, the arc goes RECORDED -> SETTLED
//     directly.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-linehan-1993-cognitive-behavioral-treatment-bpd.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-linehan-1993-cognitive-behavioral-treatment-bpd.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxlrto00jjsa7fppqu0i7x'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-05-04',
    datePrecision: 'DAY',
    reason:
      'The book claimed its DBT strategies were "proven effective in controlled clinical trials." The 2020 Cochrane systematic review and meta-analysis of psychological therapies for BPD (Storebø, Stoffers-Winterling, Völlm et al., CD012955.pub2) is the definitive synthesis of exactly those trials: pooling the RCT evidence it found DBT superior to treatment-as-usual for reducing BPD severity, self-harm, and improving psychosocial functioning, with DBT the most-studied intervention in the review. This adjudicates the 1993 efficacy claim as durable field consensus, further corroborated by DBT\'s recommendation in the NICE BPD guideline (CG78, 2009).',
    source: {
      externalId: 'src:cochrane-storebo-2020-psychotherapies-bpd-CD012955',
      name: 'Storebø OJ, Stoffers-Winterling JM, Völlm BA, et al. Psychological therapies for people with borderline personality disorder. Cochrane Database of Systematic Reviews 2020, Issue 5. Art. No.: CD012955. DOI: 10.1002/14651858.CD012955.pub2.',
      url: 'https://www.cochrane.org/evidence/CD012955_psychological-therapies-people-borderline-personality-disorder',
      publishedAt: '2020-05-04',
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
