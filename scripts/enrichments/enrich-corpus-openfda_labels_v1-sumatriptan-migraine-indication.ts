// Enrichment: epistemic arc for sumatriptan (SUMATRIPTAN SUCCINATE) FDA-label claim.
//
// Claim id: cmpiyfnus8vi6plo7jd028yat
//   "Sumatriptan (SUMATRIPTAN SUCCINATE): 1 INDICATIONS AND USAGE ... acute
//    treatment of migraine with or without aura in adults ..."
//
// Sumatriptan (Imitrex) is the first-in-class selective 5-HT1B/1D receptor
// agonist ("triptan") for acute migraine.
// Arc: pivotal placebo-controlled trial evidence (1991) → AAN/US Headache
// Consortium first-line guideline standard-of-care (2000) → post-market
// serotonin-syndrome safety signal (FDA alert, 19 Jul 2006) and the ensuing
// expert contestation of that warning (2010).
//
// Idempotent: upserts Source rows on externalId, ClaimStatusHistory rows on id.
// Does NOT create or modify the existing Claim.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-sumatriptan-migraine-indication.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-sumatriptan-migraine-indication.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyfnus8vi6plo7jd028yat'

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

// NOTE: the existing first ClaimStatusHistory row (fromAxis=null -> first axis)
// is left untouched. These transitions extend the arc from OPEN onward.
const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: pivotal placebo-controlled trial evidence (1991) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1991-08-01',
    datePrecision: 'DAY',
    reason:
      'The pivotal large-scale evidence was published in the New England Journal of Medicine on 1 August 1991, when the Subcutaneous Sumatriptan International Study Group reported that subcutaneous sumatriptan relieved migraine headache in about 70% of attacks within one hour versus 22% with placebo. This first-in-class selective 5-HT1 receptor agonist demonstrated rapid, reproducible efficacy in a randomized placebo-controlled trial, moving the drug from an open question to a recorded empirical result. It established the mechanistic and clinical basis for the entire triptan class.',
    source: {
      externalId: 'src:sumatriptan-nejm-subcutaneous-study-group-1991',
      name: 'The Subcutaneous Sumatriptan International Study Group. Treatment of Migraine Attacks with Sumatriptan. N Engl J Med 1991;325:316–321.',
      url: 'https://doi.org/10.1056/NEJM199108013250505',
      publishedAt: '1991-08-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: AAN / US Headache Consortium first-line guideline (2000) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2000-09-26',
    datePrecision: 'DAY',
    reason:
      'Following FDA approval of injectable (1992) and oral (1995) sumatriptan, the American Academy of Neurology Quality Standards Subcommittee, working with the US Headache Consortium, published evidence-based practice parameters in Neurology on 26 September 2000 that recommended triptans, including sumatriptan, as a first-line option for moderate-to-severe migraine attacks. Endorsement by the primary neurology specialty body settled the drug\'s status as an accepted standard of care for acute migraine treatment. The parameters carried Grade A evidence ratings for the triptan class.',
    source: {
      externalId: 'src:aan-migraine-practice-parameter-2000-silberstein',
      name: 'Silberstein SD. Practice parameter: evidence-based guidelines for migraine headache (an evidence-based review): report of the Quality Standards Subcommittee of the American Academy of Neurology. Neurology 2000;55(6):754–762.',
      url: 'https://doi.org/10.1212/WNL.55.6.754',
      publishedAt: '2000-09-26',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: post-market serotonin-syndrome safety signal (2006 FDA alert; 2010 expert contestation) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2006-07-19',
    datePrecision: 'DAY',
    reason:
      'On 19 July 2006 the FDA issued a public-health advisory warning that combining triptans such as sumatriptan with SSRIs or SNRIs could cause life-threatening serotonin syndrome, prompting new class labeling. The alert reopened the benefit–risk consensus around a previously settled first-line therapy. The American Headache Society subsequently contested the strength of the evidence in a 2010 position paper, concluding the data were insufficient to support the warning and that co-prescription remained appropriate — leaving the safety claim actively contested.',
    source: {
      externalId: 'src:ahs-position-paper-triptan-ssri-serotonin-syndrome-2010',
      name: 'Evans RW, Tepper SJ, Shapiro RE, Sun-Edelstein C, Tietjen GE. The FDA alert on serotonin syndrome with use of triptans combined with selective serotonin reuptake inhibitors or selective serotonin-norepinephrine reuptake inhibitors: American Headache Society position paper. Headache 2010;50(6):1089–1099.',
      url: 'https://doi.org/10.1111/j.1526-4610.2010.01691.x',
      publishedAt: '2010-06-01',
      methodologyType: 'opinion',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [dry-run]' : ''}`,
  )

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`,
      )
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
        ingestedBy: 'enrich:openfda_labels_v1:sumatriptan-migraine-indication',
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
