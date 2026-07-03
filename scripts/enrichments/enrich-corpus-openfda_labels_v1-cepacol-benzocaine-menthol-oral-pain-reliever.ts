// Enrichment: epistemic trajectory for the openFDA-label claim asserting that
// Cepacol Extra Strength Sore Throat (cherry) lozenges — benzocaine 15 mg +
// menthol 3.6 mg — are OTC "Oral pain reliever[s]."
//
// Claim: Cepacol Extra Strength Sore Throat cherry (BENZOCAINE AND MENTHOL):
//   Active ingredients (in each lozenge) Purposes Benzocaine 15 mg Oral pain
//   reliever Menthol 3.6 mg Oral pain reliever
// Claim id: cmpiycu6e8s66plo7sldsl946  (ingestedBy: openfda_labels_v1)
//
// The claim already carries its OPEN/null -> RECORDED first entry (benzocaine has
// been used as a topical/oral anesthetic since the early 20th century). This
// script adds only the downstream arc, anchored to high-confidence canonical URLs:
//
//   RECORDED -> SETTLED (1991): Through the FDA over-the-counter (OTC) drug review,
//     benzocaine was classified as a Category I (generally recognized as safe and
//     effective, GRASE) oral anesthetic/analgesic for the temporary relief of sore
//     mouth and sore throat pain. That monograph status cemented benzocaine
//     lozenges as a standard, self-selectable OTC treatment — the institutional
//     ratification underpinning the Cepacol label's "Oral pain reliever" purpose.
//
//   SETTLED -> CONTESTED (2018): The FDA, escalating an earlier 2011 Drug Safety
//     Communication, took action against oral OTC benzocaine products after linking
//     them to methemoglobinemia — a rare but serious and potentially fatal blood
//     disorder. The FDA warned benzocaine should not be used to treat teething in
//     children under two, asked manufacturers to stop marketing those products, and
//     required warning-label changes for remaining oral benzocaine products. This
//     put the "benign OTC oral pain reliever" framing of oral benzocaine into active
//     contestation on safety grounds.
//
// Only .gov-anchored (FDA) arcs are encoded here.
// NOTE: live web-verification tooling (WebFetch/WebSearch) was unavailable when
// authoring; both URLs are canonical regulator links asserted at high confidence,
// not a live 200 check. The 2018 FDA action URL is high confidence; the OTC
// rulemaking-history URL documents the monograph timeline.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-cepacol-benzocaine-menthol-oral-pain-reliever.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-cepacol-benzocaine-menthol-oral-pain-reliever.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiycu6e8s66plo7sldsl946'

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
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> RECORDED first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1991-01-01',
    datePrecision: 'YEAR',
    reason:
      "Through the FDA over-the-counter (OTC) drug review for oral health care drug products, benzocaine was classified as a Category I (generally recognized as safe and effective) oral anesthetic/analgesic for the temporary relief of sore mouth and sore throat pain. That monograph standing established benzocaine lozenges as a standard, self-selectable OTC treatment without a prescription. It is the institutional ratification that underpins the Cepacol label's 'Oral pain reliever' purpose statement.",
    source: {
      externalId: 'src:fda-otc-oral-health-care-rulemaking-history-benzocaine',
      name:
        'US Food and Drug Administration. Rulemaking History for OTC Oral Health Care (Oral and Dental) Products (OTC Drug Review; benzocaine classified as a Category I oral anesthetic/analgesic).',
      url: 'https://www.fda.gov/drugs/status-otc-rulemakings/rulemaking-history-otc-oral-health-care-oral-and-dental-products',
      publishedAt: '1991-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-05-23',
    datePrecision: 'DAY',
    reason:
      "The US Food and Drug Administration took action against oral over-the-counter benzocaine products after linking them to methemoglobinemia — a rare but serious and potentially fatal blood disorder — escalating an earlier April 2011 Drug Safety Communication. The FDA warned that benzocaine should not be used to treat teething pain in children under two, requested that manufacturers stop marketing those products, and required new warnings on remaining oral benzocaine products. This put the framing of oral benzocaine as a benign everyday OTC pain reliever into active contestation on safety grounds, directly implicating benzocaine lozenges of the Cepacol type.",
    source: {
      externalId: 'src:fda-benzocaine-methemoglobinemia-action-2018',
      name:
        'US Food and Drug Administration. Risk of serious and potentially fatal blood disorder prompts FDA action on oral over-the-counter benzocaine products used for teething and mouth pain. May 23, 2018.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/risk-serious-and-potentially-fatal-blood-disorder-prompts-fda-action-oral-over-counter-benzocaine',
      publishedAt: '2018-05-23',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
