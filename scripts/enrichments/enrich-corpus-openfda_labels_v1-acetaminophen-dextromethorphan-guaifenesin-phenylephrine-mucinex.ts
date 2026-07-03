// Enrichment: epistemic trajectory for an openFDA-label claim asserting the OTC
// active-ingredient/purpose statement for Mucinex Fast-Max Cold, Flu and Sore
// Throat — a fixed-dose combination of ACETAMINOPHEN (325 mg, analgesic/
// antipyretic), DEXTROMETHORPHAN HBr (10 mg, cough suppressant), GUAIFENESIN
// (200 mg, expectorant), and PHENYLEPHRINE HCl (5 mg, nasal decongestant) per
// caplet.
//
// None of these four are New-Drug-Application molecules; they are long-marketed
// OTC actives whose regulatory status runs through the U.S. OTC Drug Review
// monograph system. Their combined epistemic arc is best anchored on the
// phenylephrine active, which is the subject of a well-documented, still-open
// post-market EFFICACY contestation at the FDA:
//
//   RECORDED -> SETTLED: The FDA OTC Drug Review recognized the three respiratory
//     actives — phenylephrine (nasal decongestant), dextromethorphan (antitussive/
//     cough suppressant), and guaifenesin (expectorant) — as generally recognized
//     as safe and effective, codified in the Cold, Cough, Allergy, Bronchodilator,
//     and Antiasthmatic Drug Products monograph, 21 CFR part 341; acetaminophen's
//     analgesic/antipyretic purpose is codified in the Internal Analgesic monograph,
//     21 CFR part 343. This monograph settlement fixed the exact "Purposes" the
//     Mucinex label restates. INSTITUTIONAL settlement by the U.S. drug regulator.
//     (datePrecision YEAR — the tentative/final-monograph Federal Register dates
//     could not be web-verified this session; the eCFR part-341 URL is the
//     verification surface.)
//
//   SETTLED -> CONTESTED (2024-11-07): After the FDA's Nonprescription Drugs
//     Advisory Committee voted unanimously (16-0, Sept 11-12 2023) that oral
//     phenylephrine is not effective as a nasal decongestant at the monograph dose,
//     the FDA issued a proposed order to remove oral phenylephrine as an OTC
//     monograph nasal-decongestant active ingredient. This does not touch the
//     acetaminophen/dextromethorphan/guaifenesin actives, but it places the
//     "effective" half of the GRASE settlement for one of this product's four
//     stated purposes — the nasal decongestant — under active regulatory
//     contestation.
//
// The OPEN -> RECORDED first-clinical-evidence node is intentionally omitted: no
// primary-trial DOI for the original efficacy basis of these actives could be
// verified this session, and this pipeline's doctrine bars substituting model-
// recalled identifiers for a verifiable source. The claim already carries its
// null -> RECORDED first entry; this script starts at RECORDED and does not
// duplicate it.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acetaminophen-dextromethorphan-guaifenesin-phenylephrine-mucinex.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acetaminophen-dextromethorphan-guaifenesin-phenylephrine-mucinex.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyjnaw8zzoplo74agep5ks'

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
    occurredAt: '1994-01-01',
    datePrecision: 'YEAR',
    reason:
      "Through the OTC Drug Review, the FDA recognized phenylephrine (nasal decongestant), dextromethorphan (cough suppressant), and guaifenesin (expectorant) as generally recognized as safe and effective active ingredients for over-the-counter use, codified in the Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products monograph at 21 CFR part 341; acetaminophen's pain-reliever/fever-reducer purpose is codified in the Internal Analgesic monograph at 21 CFR part 343. This established, by the U.S. drug regulator, the exact 'Purposes' at monograph-permitted strengths that the Mucinex Fast-Max Cold, Flu and Sore Throat label restates. Dated with YEAR precision to the monograph era; the codified conditions of use are the settled fact.",
    source: {
      externalId: 'src:fda-otc-cold-cough-allergy-monograph-part-341',
      name:
        'U.S. FDA. Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use, 21 CFR part 341 (nasal decongestant — phenylephrine; antitussive — dextromethorphan; expectorant — guaifenesin).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-341',
      publishedAt: '1994-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-11-07',
    datePrecision: 'DAY',
    reason:
      "After the FDA's Nonprescription Drugs Advisory Committee voted unanimously (16-0) on September 11-12, 2023 that oral phenylephrine is not effective as a nasal decongestant at the monograph dose, the FDA issued a proposed order (November 7, 2024) to remove oral phenylephrine as an over-the-counter monograph nasal-decongestant active ingredient. The action does not touch the acetaminophen, dextromethorphan, or guaifenesin actives, but it places the 'effective' half of the GRASE settlement for one of this product's four stated purposes — the nasal decongestant — into active regulatory contestation.",
    source: {
      externalId: 'src:fda-2024-proposed-order-oral-phenylephrine',
      name:
        'U.S. FDA (Nov 7, 2024): FDA Proposes Ending Use of Oral Phenylephrine as OTC Monograph Nasal Decongestant Active Ingredient After Extensive Review.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-proposes-ending-use-oral-phenylephrine-otc-monograph-nasal-decongestant-active-ingredient-after',
      publishedAt: '2024-11-07',
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
