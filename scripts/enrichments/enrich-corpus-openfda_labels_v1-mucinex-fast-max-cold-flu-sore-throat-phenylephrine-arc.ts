// Enrich the epistemic arc for the Mucinex Fast-Max Cold, Flu and Sore Throat
// FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiyi4f38y7uplo7tq7qtj5g — Mucinex Fast-Max Cold, Flu and Sore Throat
// (ACETAMINOPHEN 650 mg, DEXTROMETHORPHAN HBr 20 mg, GUAIFENESIN 400 mg,
// PHENYLEPHRINE HCl 10 mg per 20 mL). The epistemically live component of this
// multi-symptom OTC combination is the oral nasal decongestant, phenylephrine HCl.
//
// Arc (monotonic on the epistemic axis; occurredAt carries the true date):
//   OPEN     -> RECORDED  1976  FDA OTC Drug Review Cough-Cold advisory panel
//                               recommends oral phenylephrine HCl as Category I
//                               (GRASE) nasal decongestant; codified in the OTC
//                               monograph, 21 CFR Part 341 (10 mg q4h dosing).
//   RECORDED -> SETTLED   2006  Combat Methamphetamine Epidemic Act of 2005
//                               (Pub. L. 109-177, signed 2006-03-09) restricts
//                               pseudoephedrine; oral phenylephrine becomes the
//                               dominant nonprescription oral decongestant and the
//                               default active in mass-market cold/flu combinations.
//   SETTLED  -> CONTESTED 2007  Hatton et al. systematic review/meta-analysis finds
//                               oral phenylephrine no better than placebo at the
//                               monograph dose; escalates to the unanimous FDA NDAC
//                               vote (16-0, 2023-09-12) and FDA's Nov-2024 proposed
//                               order to remove oral phenylephrine from the monograph.
//                               Product remains legally marketed pending final action
//                               -> CONTESTED, not REVERSED.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fast-max-cold-flu-sore-throat-phenylephrine-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fast-max-cold-flu-sore-throat-phenylephrine-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyi4f38y7uplo7tq7qtj5g'

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
  // ── OPEN -> RECORDED: OTC monograph recognition of phenylephrine (1976) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1976-01-01',
    datePrecision: 'YEAR',
    reason:
      'The active ingredients in this product were evaluated under FDA\'s OTC Drug Review, where the advisory review panel recommended oral phenylephrine hydrochloride as Category I — generally recognized as safe and effective — as a nasal decongestant in 1976. The recommendation was codified in the OTC monograph for Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products (21 CFR Part 341), which fixes the 10 mg-per-dose decongestant regimen reflected verbatim on this label. This entered the ingredient\'s decongestant claim into the federal regulatory record as an established, marketable indication.',
    source: {
      externalId: 'src:phenylephrine-otc-monograph-21cfr341',
      name: 'Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use — OTC monograph codifying phenylephrine HCl as a Category I nasal decongestant (21 CFR Part 341; FDA OTC Drug Review panel recommendation, 1976).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1976-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED: CMEA drives phenylephrine to standard OTC status (2006) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2006-03-09',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005 (Title VII of the USA PATRIOT Improvement and Reauthorization Act, Pub. L. 109-177), signed March 9, 2006, moved pseudoephedrine behind the pharmacy counter with purchase logging and quantity limits. Manufacturers reformulated mass-market oral decongestants around phenylephrine, making it the dominant nonprescription oral nasal decongestant on U.S. shelves. Its role as the standard OTC decongestant — the default active in multi-symptom cold and flu combinations like this one — was thereby settled in the marketplace.',
    source: {
      externalId: 'src:cmea-2005-pl109-177-hr3199',
      name: 'USA PATRIOT Improvement and Reauthorization Act of 2005 (H.R. 3199, Pub. L. 109-177), which enacted the Combat Methamphetamine Epidemic Act of 2005 restricting retail pseudoephedrine sales. Signed into law March 9, 2006.',
      url: 'https://www.congress.gov/bill/109th-congress/house-bill/3199',
      publishedAt: '2006-03-09',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: efficacy meta-analysis + FDA NDAC vote (2007 →) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      'A 2007 systematic review and meta-analysis (Hatton et al., Annals of Pharmacotherapy) found that oral phenylephrine at the 10 mg monograph dose was no more effective than placebo as a nasal decongestant, opening a sustained evidentiary challenge to the ingredient\'s efficacy. The signal escalated when FDA\'s Nonprescription Drug Advisory Committee voted unanimously (16-0) on September 12, 2023 that oral phenylephrine is not effective at monograph doses, and FDA issued a proposed order in November 2024 to remove it from the OTC monograph. The product remains legally marketed pending final action, so its oral decongestant claim is contested rather than reversed.',
    source: {
      externalId: 'src:hatton-2007-oral-phenylephrine-meta-analysis',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381–390.',
      url: 'https://doi.org/10.1345/aph.1H128',
      publishedAt: '2007-03-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${historyId})`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda-labels',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
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

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Done — ${TRANSITIONS.length} transitions processed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
