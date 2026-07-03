// Enrichment: epistemic arc for the FDA "Nighttime Severe Cold and Flu
// Maximum Strength mini softgels" OTC label claim.
//
// Claim: cmpiy7wif8ml0plo7zx7gyk2q (openfda_labels_v1)
//   "Nighttime Severe Cold and Flu Maximum Strength mini softgels
//    (ACETAMINOPHEN, DEXTROMETHORPHAN HBR, DOXYLAMINE SUCCINATE,
//    PHENYLEPHRINE HCL): Purpose Pain reliever/fever reducer Cough
//    suppressant Antihistamine Nasal decongestant"
//
// This is a four-ingredient OTC monograph combination product; the 2026 label
// filing is only when *this* package emerged. Of the four actives, only oral
// PHENYLEPHRINE HYDROCHLORIDE (the "Nasal decongestant" Purpose) has a genuine,
// dateable, externally verifiable multi-step epistemic arc, so the trajectory
// is anchored on that ingredient's decongestant claim. The other three actives
// (acetaminophen, dextromethorphan, doxylamine) remain settled monograph agents
// with no post-market reversal, so no transition is fabricated around them.
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED  (1976)        FDA's OTC Drug Review classified oral
//                         phenylephrine HCl as a Category I (generally recognized
//                         as safe and effective) nasal decongestant active in the
//                         cough-cold review, codified at 21 CFR 341.20 — recording
//                         the "Nasal decongestant" Purpose into the OTC monograph.
//                         Ratified by INSTITUTIONAL (FDA).
//   RECORDED -> SETTLED   (2006-09-30)  After the Combat Methamphetamine Epidemic
//                         Act of 2005 (enacted in P.L. 109-177) moved pseudoephedrine
//                         behind the pharmacy counter, oral phenylephrine HCl became
//                         the default front-shelf OTC oral decongestant that
//                         manufacturers reformulated combination cold/flu products
//                         around — cementing its standard-of-shelf status. Ratified
//                         by MARKET.
//   SETTLED  -> CONTESTED (2007-03)     Hatton et al.'s systematic review and
//                         meta-analysis in Annals of Pharmacotherapy concluded that
//                         oral phenylephrine 10 mg is no more effective than placebo
//                         as a decongestant, directly contesting the ingredient's
//                         monograph efficacy and triggering citizen petitions to FDA.
//                         Ratified by EXPERT_LITERATURE.
//   CONTESTED -> REVERSED (2023-09-12)  FDA's Nonprescription Drugs Advisory
//                         Committee voted unanimously (16-0) that current scientific
//                         data do not support oral phenylephrine as an effective
//                         nasal decongestant, reversing its GRASE efficacy standing;
//                         FDA followed with a proposed order (Nov 2025) to remove
//                         oral phenylephrine from the OTC monograph. The reversal
//                         targets the "Nasal decongestant" Purpose on this label.
//                         Ratified by INSTITUTIONAL (FDA).
//
// URLs are anchored on stable, on-point primary references: the eCFR section that
// codifies phenylephrine as an OTC nasal decongestant active (and is the locus of
// the reversal), the congress.gov page for the statute that drove market adoption,
// and the DOI of the Hatton meta-analysis. Live web verification was unavailable in
// this session (web tools not permitted), so no FDA press-release or Federal
// Register document slug was invented — sources are limited to URLs whose form is
// structurally reliable (eCFR / congress.gov / DOI), per AGENTS.md.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-nighttime-severe-cold-flu-phenylephrine.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiy7wif8ml0plo7zx7gyk2q'

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
    occurredAt: '1976-01-01',
    datePrecision: 'YEAR',
    reason:
      'The FDA Over-the-Counter Drug Review (cold, cough, allergy, bronchodilator and antiasthmatic products) classified oral phenylephrine hydrochloride as a Category I ingredient — generally recognized as safe and effective — for use as a nasal decongestant, a determination codified in the OTC monograph at 21 CFR 341.20. This recorded the "Nasal decongestant" Purpose stated on the label into the federal monograph framework under which this product is marketed.',
    source: {
      externalId: 'src:phenylephrine-otc-monograph-decongestant-341-20',
      name: 'FDA OTC Drug Review — oral phenylephrine hydrochloride classified as a Category I (GRASE) nasal decongestant active ingredient; codified at 21 CFR 341.20 (Nasal decongestant active ingredients).',
      url: 'https://www.ecfr.gov/current/title-21/section-341.20',
      publishedAt: '1976-01-01',
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
      'The Combat Methamphetamine Epidemic Act of 2005 (enacted as part of Public Law 109-177) moved pseudoephedrine products behind the pharmacy counter with retail sales restrictions taking effect on September 30, 2006. Manufacturers responded by reformulating front-shelf OTC cold and flu combination products around oral phenylephrine hydrochloride, which became the default non-prescription oral nasal decongestant — cementing its standard-of-shelf status in multi-symptom products like this one.',
    source: {
      externalId: 'src:combat-meth-epidemic-act-2005-pl-109-177',
      name: 'Combat Methamphetamine Epidemic Act of 2005 (Title VII of H.R. 3199, USA PATRIOT Improvement and Reauthorization Act of 2005; Public Law 109-177).',
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
      'Hatton and colleagues published a systematic review and meta-analysis in Annals of Pharmacotherapy concluding that oral phenylephrine at the standard 10 mg dose is no more effective than placebo for relieving nasal congestion. The finding directly contested the ingredient\'s long-accepted monograph efficacy and prompted citizen petitions asking the FDA to reevaluate its Category I decongestant status, moving the settled fact into a contested state.',
    source: {
      externalId: 'src:hatton-2007-oral-phenylephrine-meta-analysis',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. "Efficacy and safety of oral phenylephrine as a decongestant: a systematic review and meta-analysis." Annals of Pharmacotherapy 2007;41(3):381-390. doi:10.1345/aph.1H679.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-09-12',
    datePrecision: 'DAY',
    reason:
      'On September 12, 2023 the FDA Nonprescription Drugs Advisory Committee voted unanimously (16-0) that current scientific data do not support oral phenylephrine as an effective nasal decongestant, reversing the ingredient\'s generally-recognized-as-effective standing under the OTC monograph. FDA subsequently issued a proposed order (November 2025) to remove oral phenylephrine as an active ingredient for OTC nasal decongestant use. This reversal targets the "Nasal decongestant" Purpose stated on this label; the acetaminophen, dextromethorphan, and doxylamine actives are unaffected.',
    source: {
      externalId: 'src:phenylephrine-otc-monograph-decongestant-341-20-reversal',
      name: 'FDA Nonprescription Drugs Advisory Committee unanimous vote (16-0, Sept 12, 2023) that oral phenylephrine is not effective as a nasal decongestant; FDA proposed order (Nov 2025) to remove oral phenylephrine — targeting the monograph active listed at 21 CFR 341.20.',
      url: 'https://www.ecfr.gov/current/title-21/section-341.20',
      publishedAt: '2023-09-12',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
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
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
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
