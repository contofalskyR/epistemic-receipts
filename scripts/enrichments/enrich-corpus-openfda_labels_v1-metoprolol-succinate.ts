// Enrichment: epistemic arc for the metoprolol succinate ER FDA-label claim.
//
// Claim: cmpiygrv88wpuplo75bjf4ohs  (ingestedBy: openfda_labels_v1)
//   "metoprolol succinate (METOPROLOL SUCCINATE): 1 INDICATIONS AND USAGE ..."
//
// Adds three ClaimStatusHistory transitions tracing the drug's evidentiary arc:
//   1. OPEN -> RECORDED    Landmark phase-3 mortality evidence (MERIT-HF, Lancet 1999)
//   2. RECORDED -> SETTLED  Standard-of-care via the 2005 ACC/AHA chronic-HF guideline
//   3. SETTLED -> CONTESTED Post-market safety signal (POISE trial, Lancet 2008)
//
// The claim itself already exists (do NOT create it) and already carries its
// initial null -> OPEN emergence entry. This script only adds the arc above.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic id = `${claimId}-${toAxis}-${occurredAt.slice(0,10)}`.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-metoprolol-succinate.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiygrv88wpuplo75bjf4ohs'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // 1. OPEN -> RECORDED — first landmark phase-3 mortality evidence.
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1999-06-12',
    datePrecision: 'DAY',
    reason:
      'The MERIT-HF trial (Effect of metoprolol CR/XL in chronic heart failure, Lancet 1999;353(9169):2001–2007) randomised 3,991 patients with NYHA class II–IV heart failure and reported that once-daily metoprolol succinate extended-release (CR/XL) cut all-cause mortality by 34% versus placebo, prompting early termination for benefit. This was the first large randomized trial to establish metoprolol succinate ER specifically on a hard mortality endpoint in heart failure, entering the drug\'s survival benefit into the peer-reviewed record. It is the pivotal evidence underlying the heart-failure indication now carried on the Toprol-XL label.',
    source: {
      externalId: 'src:metoprolol-succinate-merit-hf-lancet-1999',
      name: 'MERIT-HF Study Group. Effect of metoprolol CR/XL in chronic heart failure: Metoprolol CR/XL Randomised Intervention Trial in Congestive Heart Failure (MERIT-HF). Lancet. 1999;353(9169):2001–2007.',
      url: 'https://doi.org/10.1016/S0140-6736(99)04440-2',
      publishedAt: '1999-06-12',
      methodologyType: 'primary',
    },
  },

  // 2. RECORDED -> SETTLED — standard-of-care status via major guideline inclusion.
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2005-09-20',
    datePrecision: 'DAY',
    reason:
      'The ACC/AHA 2005 Guideline Update for the Diagnosis and Management of Chronic Heart Failure in the Adult (Hunt et al., Circulation 2005;112(12):e154–e235) gave a Class I recommendation to evidence-based beta-blockers — bisoprolol, carvedilol, and sustained-release metoprolol succinate — for all stable patients with reduced ejection fraction unless contraindicated. Endorsement by the principal U.S. cardiology bodies moved metoprolol succinate ER from a trial-supported agent to guideline-directed medical therapy. This institutional ratification settled its place as standard of care for heart failure with reduced ejection fraction.',
    source: {
      externalId: 'src:metoprolol-succinate-acc-aha-hf-guideline-2005',
      name: 'Hunt SA, Abraham WT, Chin MH, et al. ACC/AHA 2005 Guideline Update for the Diagnosis and Management of Chronic Heart Failure in the Adult. Circulation. 2005;112(12):e154–e235.',
      url: 'https://doi.org/10.1161/CIRCULATIONAHA.105.167586',
      publishedAt: '2005-09-20',
      methodologyType: 'derivative',
    },
  },

  // 3. SETTLED -> CONTESTED — post-market safety signal.
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-05-31',
    datePrecision: 'DAY',
    reason:
      'The POISE trial (POISE Study Group, Lancet 2008;371(9627):1839–1847) randomised 8,351 patients to perioperative extended-release metoprolol succinate or placebo before non-cardiac surgery and found that, although the drug reduced myocardial infarction, it significantly increased total mortality and the risk of stroke. The result challenged the presumed safety of routine perioperative beta-blockade with metoprolol succinate ER and drove downgrades in perioperative guideline recommendations. It surfaced a post-market safety signal that moved the drug\'s benefit–risk balance in that setting from settled to contested.',
    source: {
      externalId: 'src:metoprolol-succinate-poise-lancet-2008',
      name: 'POISE Study Group. Effects of extended-release metoprolol succinate in patients undergoing non-cardiac surgery (POISE trial): a randomised controlled trial. Lancet. 2008;371(9627):1839–1847.',
      url: 'https://doi.org/10.1016/S0140-6736(08)60601-7',
      publishedAt: '2008-05-31',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const publishedAt = new Date(t.source.publishedAt)

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt,
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt,
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
