// Enrichment: epistemic arc for the Tetracycline Hydrochloride FDA-label claim.
//
// Claim: cmpixuqpm87ioplo7d7yl08st  (ingestedBy: openfda_labels_v1)
//   "Tetracycline Hydrochloride (TETRACYCLINE HYDROCHLORIDE): INDICATIONS AND
//    USAGE To reduce the development of drug-resistant bacteria ... should be
//    used only to treat infections that are proven or strongly suspected ..."
//
// Adds three ClaimStatusHistory transitions tracing the drug's evidentiary arc:
//   1. OPEN -> RECORDED     Discovery/first therapeutic record of tetracycline
//                           (Conover patent US2,699,054, granted 1955)
//   2. RECORDED -> SETTLED  Global standard-of-care via WHO Model List of
//                           Essential Medicines inclusion (first list, 1977)
//   3. SETTLED -> CONTESTED FDA antibacterial-resistance labeling rule (2003)
//                           restricting use to proven/strongly-suspected
//                           susceptible infection — the exact language carried
//                           on this label — under antimicrobial-stewardship
//                           safety concern about resistance.
//
// The claim itself already exists (do NOT create it) and already carries its
// initial null -> OPEN emergence entry. This script only adds the arc above.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic id = `${claimId}-${toAxis}-${occurredAt.slice(0,10)}`.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-tetracycline-hydrochloride.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixuqpm87ioplo7d7yl08st'

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
  // 1. OPEN -> RECORDED — discovery and first therapeutic record of tetracycline.
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1955-01-11',
    datePrecision: 'DAY',
    reason:
      'Tetracycline was discovered by Lloyd H. Conover at Pfizer as the first antibiotic produced by chemical modification of a naturally derived compound (catalytic dehalogenation of chlortetracycline); U.S. Patent 2,699,054, "Tetracycline," was granted January 11, 1955. Introduced clinically in the mid-1950s, it rapidly entered the therapeutic record as a broad-spectrum oral antibacterial for respiratory, genitourinary, rickettsial, and other susceptible infections. This datable entry marks the compound moving from an open discovery into the formal scientific and clinical record that the FDA label descends from.',
    source: {
      externalId: 'src:tetracycline-conover-patent-us2699054',
      name: 'Conover LH. Tetracycline. U.S. Patent 2,699,054 (granted Jan 11, 1955), assigned to Chas. Pfizer & Co.',
      url: 'https://patents.google.com/patent/US2699054A/en',
      publishedAt: '1955-01-11',
      methodologyType: 'primary',
    },
  },

  // 2. RECORDED -> SETTLED — global standard-of-care via WHO Essential Medicines listing.
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1977-01-01',
    datePrecision: 'YEAR',
    reason:
      'The tetracycline class was included on the first WHO Model List of Essential Medicines in 1977 and has been maintained across subsequent editions, designating it a medicine that should be available in functioning health systems worldwide. Placement on the WHO list by an international expert committee ratified tetracyclines as a global standard-of-care antibacterial rather than a merely trial-supported agent. This institutional endorsement settled tetracycline\'s place in routine antimicrobial therapy for susceptible infections.',
    source: {
      externalId: 'src:tetracycline-who-essential-medicines',
      name: 'WHO Model List of Essential Medicines — Expert Committee on Selection and Use of Essential Medicines (essential medicines lists, from the first 1977 list onward).',
      url: 'https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists',
      publishedAt: '1977-01-01',
      methodologyType: 'derivative',
    },
  },

  // 3. SETTLED -> CONTESTED — FDA antibacterial-resistance labeling restriction.
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2003-02-06',
    datePrecision: 'DAY',
    reason:
      'On February 6, 2003, the FDA issued its final rule on labeling for systemic antibacterial drug products (68 FR 6062), codified at 21 CFR 201.24, requiring that labels state the products should be used only to treat infections proven or strongly suspected to be caused by susceptible bacteria in order to slow the development of drug-resistant bacteria. This antimicrobial-stewardship action — the exact restriction language now carried on the tetracycline hydrochloride label — reopened the benefit–risk balance of broad empiric use out of concern that overuse drives resistance. It moved the settled standard-of-care posture of routine tetracycline prescribing into active contestation.',
    source: {
      externalId: 'src:tetracycline-fda-antibacterial-labeling-21cfr201.24',
      name: 'FDA, "Labeling Requirements for Systemic Antibacterial Drug Products Intended for Human Use," final rule, 68 FR 6062 (Feb 6, 2003); codified at 21 CFR 201.24.',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-201/subpart-B/section-201.24',
      publishedAt: '2003-02-06',
      methodologyType: 'opinion',
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
