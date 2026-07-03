// Enrichment: epistemic arc for the FDA OTC label claim for Mucinex Fast-Max
// Congestion and Headache Maximum Strength (acetaminophen / dextromethorphan HBr /
// phenylephrine HCl liquid gels).
//
// Claim: cmpiyjkyb8zx6plo7yqnwyl2k (openfda_labels_v1)
//   Combination OTC cold/flu product: acetaminophen 325 mg (analgesic/antipyretic),
//   dextromethorphan HBr 10 mg (antitussive), phenylephrine HCl 5 mg (nasal decongestant).
//
// The arc is anchored on the phenylephrine (oral nasal decongestant) component, which
// carries the only genuine multi-step epistemic trajectory among the three ingredients:
//
//   OPEN     -> RECORDED  (1994)       OTC Drug Review codifies these actives as GRASE
//                                       under 21 CFR Part 341 (cough/cold monograph).
//   RECORDED -> SETTLED   (2006-09-30) Combat Methamphetamine Epidemic Act pushes
//                                       pseudoephedrine behind the pharmacy counter,
//                                       making oral phenylephrine the default OTC
//                                       decongestant in combination cold products.
//   SETTLED  -> CONTESTED (2007-03-01) Hatton et al. meta-analysis finds oral
//                                       phenylephrine at monograph dose no better than
//                                       placebo — the evidence base that later drove
//                                       FDA's 2023 advisory-committee conclusion that
//                                       oral phenylephrine is not effective.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fast-max.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyjkyb8zx6plo7yqnwyl2k'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-01-01',
    datePrecision: 'YEAR',
    reason:
      "The FDA's OTC Drug Review codified acetaminophen, dextromethorphan, and phenylephrine as active ingredients generally recognized as safe and effective (GRASE) for nonprescription use, with cough/cold combination products governed by 21 CFR Part 341 (Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products). This monograph framework is the regulatory record that lets a fixed-dose combination like Mucinex Fast-Max be marketed without a product-specific NDA. It recorded, rather than settled, each ingredient's efficacy at the labeled dose.",
    source: {
      externalId: 'src:otc-monograph-21cfr341',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (FDA OTC monograph, eCFR current).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-341',
      publishedAt: '1994-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2006-09-30',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005 (Title VII of the USA PATRIOT Improvement and Reauthorization Act, Pub. L. 109-177, H.R. 3199), whose retail provisions took effect September 30, 2006, moved pseudoephedrine products behind the pharmacy counter with purchase limits and logbook requirements. Manufacturers reformulated mainstream OTC cold and sinus lines around oral phenylephrine to keep them on open shelves, making phenylephrine the de facto standard nonprescription oral decongestant in combination products such as this one. The market thereby settled on the phenylephrine-based formulation.',
    source: {
      externalId: 'src:cmea-2005-hr3199',
      name: 'Combat Methamphetamine Epidemic Act of 2005 (Title VII of USA PATRIOT Improvement and Reauthorization Act of 2005), H.R. 3199, 109th Congress, Pub. L. 109-177.',
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
      'Hatton et al. published a systematic review and meta-analysis in Annals of Pharmacotherapy concluding that oral phenylephrine at the standard 10 mg monograph dose was no more effective than placebo as a nasal decongestant, likely due to extensive first-pass metabolism. This directly contested the efficacy of the very phenylephrine component that had just become the default OTC decongestant, and the accumulating evidence ultimately drove the FDA Nonprescription Drugs Advisory Committee to conclude in September 2023 that oral phenylephrine is not effective. The safety of the product is not in dispute; the efficacy of its decongestant ingredient is.',
    source: {
      externalId: 'src:phenylephrine-hatton-meta-2007',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine as a decongestant: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381–390.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
