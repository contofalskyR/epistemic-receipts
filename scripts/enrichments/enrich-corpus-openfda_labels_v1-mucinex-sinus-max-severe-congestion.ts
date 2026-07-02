// Enrichment: epistemic arc for the FDA drug-label claim on MUCINEX SINUS-MAX
// SEVERE CONGESTION AND PAIN (ACETAMINOPHEN, DEXTROMETHORPHAN HBr, PHENYLEPHRINE HCl).
//
// Claim: cmpiyf8n08uziplo7sypa6hfy (openfda_labels_v1)
//   "... Phenylephrine HCl 5 mg  Nasal decongestant ..."
//
// The claim's contestable ingredient is oral PHENYLEPHRINE HCl, listed on the
// label as a "Nasal decongestant." Acetaminophen (analgesic) and dextromethorphan
// (antitussive) are settled OTC actives; the epistemic arc that moved for this
// product is the efficacy status of oral phenylephrine at the monograph dose.
// This enrichment tracks that ingredient-level trajectory:
//   OPEN     -> RECORDED  (1976) FDA OTC Review panel classifies oral
//                         phenylephrine HCl as a Category I nasal decongestant
//   RECORDED -> SETTLED   (1994) FDA Final Monograph codifies oral phenylephrine
//                         HCl as GRASE (21 CFR 341.20)
//   SETTLED  -> CONTESTED (2007) Hatton et al. meta-analysis finds oral
//                         phenylephrine no better than placebo at 10 mg
//   CONTESTED-> REVERSED  (2024) FDA proposes order removing oral phenylephrine
//                         as a GRASE nasal decongestant after the 2023 NDAC
//                         unanimously found it not effective
//
// The existing fromAxis=null -> toAxis=OPEN row is NOT recreated here.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-sinus-max-severe-congestion.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyf8n08uziplo7sypa6hfy'

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
    occurredAt: '1976-09-09',
    datePrecision: 'DAY',
    reason:
      'Oral phenylephrine hydrochloride entered the U.S. regulatory record as a nasal decongestant through the FDA OTC Drug Review: the Advisory Review Panel on OTC Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Products classified phenylephrine HCl as a Category I (generally recognized as safe and effective) oral nasal decongestant in the Advance Notice of Proposed Rulemaking published 9 September 1976 (41 FR 38312). This is the founding record placing the "nasal decongestant" purpose the Mucinex label states onto the regulatory register.',
    source: {
      externalId: 'src:phenylephrine-otc-panel-1976',
      name: 'FDA Advisory Review Panel on OTC Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Products; Category I oral nasal decongestants, ANPR, 41 FR 38312 (Sept. 9, 1976) — as documented in the Phenylephrine drug monograph.',
      url: 'https://en.wikipedia.org/wiki/Phenylephrine',
      publishedAt: '1976-09-09',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-23',
    datePrecision: 'DAY',
    reason:
      'The FDA Final Monograph for OTC nasal decongestant drug products codified oral phenylephrine hydrochloride as a generally-recognized-as-safe-and-effective (GRASE) active ingredient, now at 21 CFR 341.20. Regulatory codification in the enforceable monograph settled oral phenylephrine\'s status as an approved OTC nasal decongestant, which is the basis on which combination products such as Mucinex Sinus-Max are marketed without a new drug application.',
    source: {
      externalId: 'src:phenylephrine-otc-final-monograph-341-20',
      name: 'FDA Final Monograph, Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for OTC Human Use; oral nasal decongestant active ingredients, 21 CFR 341.20.',
      url: 'https://www.ecfr.gov/current/title-21/section-341.20',
      publishedAt: '1994-08-23',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      'Hatton and colleagues\' systematic review and meta-analysis in the Annals of Pharmacotherapy pooled the controlled trials of oral phenylephrine and concluded that at the standard 10 mg monograph dose it is no more effective than placebo as a nasal decongestant, attributing prior positive results to extensive first-pass metabolism and low oral bioavailability. This peer-reviewed challenge to the efficacy the FDA monograph had settled moved oral phenylephrine\'s decongestant claim into active scientific contest and triggered the citizen petitions that prompted FDA re-review.',
    source: {
      externalId: 'src:phenylephrine-hatton-meta-analysis-2007',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381–390.',
      url: 'https://doi.org/10.1345/aph.1H611',
      publishedAt: '2007-03-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-11-07',
    datePrecision: 'DAY',
    reason:
      'After its Nonprescription Drugs Advisory Committee voted unanimously (16–0) on 12 September 2023 that oral phenylephrine at monograph doses is not effective as a nasal decongestant, the FDA issued a proposed order on 7 November 2024 to remove oral phenylephrine as a GRASE nasal decongestant active ingredient from the OTC monograph. The proposed order formally reverses the long-standing regulatory efficacy determination that underpins the "Nasal decongestant" purpose stated on the Mucinex Sinus-Max label; a final order would require reformulation or withdrawal of oral-phenylephrine decongestant products.',
    source: {
      externalId: 'src:phenylephrine-fda-proposed-order-2024',
      name: 'FDA. FDA Proposes Ending Use of Oral Phenylephrine as OTC Monograph Nasal Decongestant Active Ingredient After Extensive Review (Nov. 7, 2024).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-proposes-ending-use-oral-phenylephrine-otc-monograph-nasal-decongestant-active-ingredient-after',
      publishedAt: '2024-11-07',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-mucinex-sinus-max-severe-congestion',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const id = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
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

    console.log(`upserted ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${id})`)
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
