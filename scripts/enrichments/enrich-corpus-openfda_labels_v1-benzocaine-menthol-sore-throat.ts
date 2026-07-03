// Enrichment: epistemic trajectory for an openFDA-label claim asserting that
// Cepacol Extra Strength Sore Throat (honey lemon) carries the OTC oral-pain-
// reliever indication for its actives BENZOCAINE (15 mg) and MENTHOL (2.6 mg)
// per lozenge.
//
// Benzocaine and menthol are not New-Drug-Application molecules; they are long-
// marketed OTC oral anesthetic/analgesic actives whose epistemic arc runs
// through the U.S. OTC Drug Review monograph process and, downstream, through a
// post-market methemoglobinemia safety signal. The verifiable arc:
//
//   RECORDED -> SETTLED: The FDA OTC Drug Review recognized benzocaine and
//     menthol as oral mucosal analgesic/anesthetic active ingredients, codified
//     in the over-the-counter Oral Health Care Drug Products monograph, 21 CFR
//     part 356. This fixed the "oral pain reliever" purpose that the Cepacol
//     label restates. INSTITUTIONAL settlement by the U.S. drug regulator.
//     (datePrecision YEAR — the exact Federal Register tentative-final-monograph
//     date could not be web-verified this session; the eCFR part-356 URL is the
//     verification surface.)
//
//   SETTLED -> CONTESTED (2018-05-23): The FDA issued a Drug Safety
//     Communication warning that oral OTC benzocaine products can cause
//     methemoglobinemia — a serious, potentially fatal blood disorder — and took
//     action against benzocaine teething products, escalating an earlier 2011
//     signal. This did not reverse the OTC oral-anesthetic status for adult sore-
//     throat use, but it placed the "safe" half of the safe-and-effective
//     settlement for this active class under active regulatory contestation.
//
// The OPEN -> RECORDED first-clinical-evidence node is intentionally omitted:
// benzocaine dates to ~1902 and no primary-trial DOI could be verified in this
// session; this pipeline's doctrine bars substituting model-recalled identifiers
// for a verifiable source. The claim already has its null -> RECORDED first
// entry; this script starts at RECORDED and does not duplicate it.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-benzocaine-menthol-sore-throat.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-benzocaine-menthol-sore-throat.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyjm1x8zycplo7qvfngtwu'

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
    occurredAt: '1988-01-01',
    datePrecision: 'YEAR',
    reason:
      "Through the OTC Drug Review, the FDA recognized benzocaine and menthol as oral mucosal analgesic/anesthetic active ingredients for over-the-counter human use, codified in the Oral Health Care Drug Products monograph at 21 CFR part 356. This established, by the U.S. drug regulator, the exact 'oral pain reliever' purpose at monograph-permitted strengths that the Cepacol Extra Strength Sore Throat label restates for its benzocaine and menthol actives. The transition is dated to the tentative-final-monograph era with YEAR precision; the codified condition of use is the settled fact.",
    source: {
      externalId: 'src:fda-otc-oral-health-care-monograph-part-356',
      name:
        'U.S. FDA. Oral Health Care Drug Products for Over-the-Counter Human Use, 21 CFR part 356 (oral mucosal analgesic/anesthetic active ingredients — benzocaine, menthol).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-356',
      publishedAt: '1988-01-01',
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
      "The FDA issued a Drug Safety Communication (23 May 2018) warning that oral over-the-counter benzocaine products can cause methemoglobinemia — a serious and potentially fatal blood disorder — and took action against benzocaine products marketed for teething, escalating a safety signal the agency had first flagged in 2011. The action did not withdraw benzocaine oral anesthetics for adult sore-throat use, but this post-market safety signal from the U.S. regulator placed the 'safe' half of the safe-and-effective settlement for the benzocaine active class into active contestation.",
    source: {
      externalId: 'src:fda-dsc-2018-benzocaine-methemoglobinemia',
      name:
        'U.S. FDA Drug Safety Communication (May 23, 2018): Risk of serious and potentially fatal blood disorder prompts FDA action on oral over-the-counter benzocaine products used for teething and mouth pain and prescription local anesthetics.',
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
