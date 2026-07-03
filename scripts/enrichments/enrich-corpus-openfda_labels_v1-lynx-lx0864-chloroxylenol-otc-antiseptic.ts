// Enrichment: epistemic arc for the OTC antiseptic active ingredient
// chloroxylenol (PCMX), attached to the openfda_labels_v1 claim
//   cmpiykakf90r0plo7xkwz49j2
//   "Lynx LX0864 peachy-foam antiseptic handsoap (CHLOROXYLENOL):
//    Drug Facts Box OTC-Purpose Section Antiseptic"
//
// The receipt traces chloroxylenol's evidentiary/regulatory arc, not this one
// product's 2026 label:
//   OPEN     -> RECORDED  : CDC 2002 hand-hygiene guideline documents PCMX's
//                           antimicrobial spectrum in the clinical literature.
//   RECORDED -> SETTLED   : WHO 2009 hand-hygiene guidelines include chloroxylenol
//                           among established antiseptic active agents (guideline
//                           adoption / standard-of-care recognition).
//   SETTLED  -> CONTESTED : FDA 2016 consumer-antiseptic final rule defers
//                           chloroxylenol's GRASE determination for insufficient
//                           safety/effectiveness data (not banned, not GRASE).
//
// Source rows are shared (same externalIds) with the sibling chloroxylenol
// enrichment for claim cmpiyk9k390piplo7rydgml66 ("Fresh Start"); the underlying
// active-ingredient fact is identical.
//
// Pattern mirrors scripts/seed-human-history-trajectories.ts.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-lynx-lx0864-chloroxylenol-otc-antiseptic.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-lynx-lx0864-chloroxylenol-otc-antiseptic.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiykakf90r0plo7xkwz49j2'

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

// Do NOT duplicate the existing null -> RECORDED first entry.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-10-25',
    datePrecision: 'DAY',
    reason:
      'The CDC "Guideline for Hand Hygiene in Health-Care Settings" (MMWR 2002;51(RR-16)) records chloroxylenol (para-chloro-meta-xylenol, PCMX) among the recognized antiseptic active ingredients, characterizing its antimicrobial spectrum as good against gram-positive organisms and fair against gram-negative bacteria, mycobacteria, and viruses. This placed the compound\'s antiseptic evidence base into an authoritative peer-reviewed clinical guideline. It marks the transition from an open question to a recorded, documented antiseptic agent.',
    source: {
      externalId: 'src:cdc-mmwr-hand-hygiene-2002',
      name: 'CDC. Guideline for Hand Hygiene in Health-Care Settings. MMWR 2002;51(RR-16).',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5116a1.htm',
      publishedAt: '2002-10-25',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2009-01-01',
    datePrecision: 'YEAR',
    reason:
      'The WHO Guidelines on Hand Hygiene in Health Care (2009) include chloroxylenol among the established antiseptic active agents used in hand-hygiene and antiseptic products, summarizing its mechanism, spectrum, and moderate onset of action. Inclusion in a global standard-of-care guideline reflects broad institutional and clinical adoption of chloroxylenol as an accepted antiseptic. Its status as a recognized antiseptic ingredient was, at the clinical-practice level, settled.',
    source: {
      externalId: 'src:who-hand-hygiene-guidelines-2009',
      name: 'WHO Guidelines on Hand Hygiene in Health Care: First Global Patient Safety Challenge (2009).',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK144013/',
      publishedAt: '2009-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-09-06',
    datePrecision: 'DAY',
    reason:
      'In its final rule "Safety and Effectiveness of Consumer Antiseptics; Topical Antimicrobial Drug Products for Over-the-Counter Human Use" (81 FR 61106, September 6, 2016), the FDA banned triclosan, triclocarban, and 17 other active ingredients from consumer antiseptic washes as not Generally Recognized as Safe and Effective (GRASE). Chloroxylenol was not banned; instead the agency deferred its final GRASE determination to allow additional safety and effectiveness data to be developed. That deferral left chloroxylenol\'s regulatory standing unresolved, reopening a formerly settled antiseptic as an actively contested question.',
    source: {
      externalId: 'src:fda-consumer-antiseptic-final-rule-2016',
      name: 'FDA. Safety and Effectiveness of Consumer Antiseptics; Topical Antimicrobial Drug Products for Over-the-Counter Human Use. Final rule, 81 FR 61106.',
      url: 'https://www.federalregister.gov/documents/2016/09/06/2016-21337/safety-and-effectiveness-of-consumer-antiseptics-topical-antimicrobial-drug-products-for-over-the',
      publishedAt: '2016-09-06',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} chloroxylenol transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  if (DRY_RUN) {
    for (const tr of TRANSITIONS) {
      const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
      console.log(`  [dry] ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt}  (${histId})`)
    }
    await prisma.$disconnect()
    return
  }

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-chloroxylenol',
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

    console.log(`  ✓ ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} @ ${tr.occurredAt}  (${histId})`)
  }

  console.log(`\nDone. ${TRANSITIONS.length} transitions upserted for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
