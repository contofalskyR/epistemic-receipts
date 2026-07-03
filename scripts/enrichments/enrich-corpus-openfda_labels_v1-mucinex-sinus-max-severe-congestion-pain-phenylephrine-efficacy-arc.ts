// Enrichment: epistemic trajectory for the FDA drug-label claim
//   "Maximum Strength Mucinex Sinus-Max Severe Congestion and Pain
//    (ACETAMINOPHEN, GUAIFENESIN, AND PHENYLEPHRINE HYDROCHLORIDE):
//    Acetaminophen 650 mg / Guaifenesin 400 mg / Phenylephrine HCl 10 mg per 20 mL"
// Claim id: cmpiyirh88z06plo767g4p5io  (ingestedBy openfda_labels_v1)
//
// The claim already carries its label-ingestion first entry (fromAxis=null ->
// <first>); this script does NOT duplicate it. It adds the downstream epistemic
// arc of this fixed-dose combination, tracked through its most-contested active,
// oral phenylephrine hydrochloride — the labeled "nasal decongestant":
//
//   1. OPEN -> RECORDED (1994): the three actives (acetaminophen, guaifenesin,
//      phenylephrine HCl) are codified as generally recognized as safe and
//      effective (GRASE) in the FDA OTC cough-cold monograph, 21 CFR part 341 —
//      the regulatory recording that permits this product to be marketed without
//      a product-specific NDA. INSTITUTIONAL.
//   2. RECORDED -> SETTLED (2006-03-09): the Combat Methamphetamine Epidemic Act
//      of 2005 (Public Law 109-177) moved pseudoephedrine behind the counter,
//      driving manufacturers to reformulate mass-market oral decongestants around
//      phenylephrine and settling this class of combination as the de facto
//      self-care standard for sinus congestion + pain. MARKET.
//   3. SETTLED -> CONTESTED (2007-03-01): the Hatton et al. meta-analysis found
//      oral phenylephrine 10 mg no better than placebo as a decongestant, opening
//      a sustained post-market efficacy challenge that culminated in the FDA
//      Nonprescription Drugs Advisory Committee's unanimous 16-0 vote (12 Sep 2023)
//      that the data do not support oral phenylephrine's effectiveness.
//      EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-sinus-max-severe-congestion-pain-phenylephrine-efficacy-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-sinus-max-severe-congestion-pain-phenylephrine-efficacy-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyirh88z06plo767g4p5io'

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

// Do NOT duplicate the existing null -> <first> (label-ingestion) entry.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-01-01',
    datePrecision: 'YEAR',
    reason:
      'Each of this product\'s three labeled actives — acetaminophen (pain reliever), guaifenesin (expectorant), and phenylephrine hydrochloride (nasal decongestant) — was codified as generally recognized as safe and effective (GRASE) in the FDA over-the-counter cough-cold-allergy monograph (21 CFR part 341). That monograph is the regulatory recording of the accumulated mid-20th-century efficacy evidence for each ingredient, and it is what permits a fixed-dose combination like Mucinex Sinus-Max Severe Congestion and Pain to be marketed without a product-specific New Drug Application. The verbatim "Active ingredients … Purposes" block captured in the claim descends directly from these monograph designations.',
    source: {
      externalId: 'src:otc-coughcold-monograph-21cfr341-mucinex-sinusmax-scp',
      name:
        'FDA OTC monograph — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use, 21 CFR part 341 (acetaminophen, guaifenesin, and phenylephrine HCl listed among GRASE active ingredients).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1994-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2006-03-09',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005 — enacted within Public Law 109-177, signed 9 March 2006 — moved pseudoephedrine behind the pharmacy counter with purchase limits, prompting manufacturers to reformulate mass-market oral decongestants (including Mucinex Sinus-Max combinations) around phenylephrine hydrochloride. Phenylephrine consequently became the dominant nonprescription oral decongestant on U.S. shelves, and multi-symptom fixed-dose products pairing it with acetaminophen and guaifenesin settled as the de facto self-care standard for sinus congestion with pain. This is the commercial ratification of the labeled combination the claim describes.',
    source: {
      externalId: 'src:cmea-2005-pl-109-177-mucinex-sinusmax-scp',
      name:
        'Combat Methamphetamine Epidemic Act of 2005 (Title VII of the USA PATRIOT Improvement and Reauthorization Act, H.R.3199, 109th Congress; became Public Law 109-177, 9 March 2006).',
      url: 'https://www.congress.gov/bill/109th-congress/house-bill/3199',
      publishedAt: '2006-03-09',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      'A systematic review and meta-analysis by Hatton and colleagues (Annals of Pharmacotherapy, March 2007) found that oral phenylephrine at the monograph dose of 10 mg — exactly the "Phenylephrine HCl 10 mg … Nasal decongestant" line in this claim — was no more effective than placebo, opening a sustained post-market efficacy challenge to a designated active ingredient in the product. The signal culminated on 12 September 2023, when the FDA Nonprescription Drugs Advisory Committee voted 16-0 that current data do not support the effectiveness of orally administered phenylephrine, followed by FDA moves toward removing oral phenylephrine from the OTC monograph. The nasal-decongestant claim is thus actively contested, though the product remained on the market at the FDA-approval date recorded for this claim.',
    source: {
      externalId: 'src:hatton-oral-phenylephrine-meta-analysis-2007-mucinex-scp',
      name:
        'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381-390.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'derivative',
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
    throw new Error(
      `Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`,
    )
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
