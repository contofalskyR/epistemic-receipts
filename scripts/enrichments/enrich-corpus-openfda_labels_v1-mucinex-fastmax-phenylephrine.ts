// Enrichment: epistemic arc for the Maximum Strength Mucinex Fast-Max Cold & Flu
// OTC drug-label claim (claim id cmpiy9hu38o8oplo74ysjmwza).
//
// The interesting epistemic thread in this four-ingredient combination product is
// the oral phenylephrine efficacy story: recognized GRASE by FDA monograph (1994),
// settled as a federal OTC standard by CARES Act monograph reform (2020), then
// contested when the FDA advisory committee found oral phenylephrine ineffective
// as a nasal decongestant (2023) and proposed removing it (2024).
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on deterministic id.
// The claim's first (fromAxis=null) status row already exists — this script does NOT
// duplicate it and does NOT create a new Claim.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fastmax-phenylephrine.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiy9hu38o8oplo74ysjmwza'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
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
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-23',
    datePrecision: 'MONTH',
    reason:
      'FDA published the final over-the-counter monograph for nasal decongestant drug products, recognizing phenylephrine hydrochloride 10 mg — alongside acetaminophen, dextromethorphan, and guaifenesin under their respective OTC monographs — as generally recognized as safe and effective (GRASE) for its labeled purpose. This entered the four active-ingredient claims in combination cold/flu products into the federal regulatory record, codified at 21 CFR Part 341.',
    source: {
      externalId: 'src:fda-otc-monograph-341-nasal-decongestant',
      name: 'FDA OTC Monograph, Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for OTC Human Use (21 CFR Part 341)',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1994-08-23',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-03-27',
    datePrecision: 'DAY',
    reason:
      'The CARES Act (Pub. L. 116-136, §3851) enacted OTC Monograph Reform, deeming the cold/cough/allergy final monograph a final administrative order under the Federal Food, Drug, and Cosmetic Act. This cemented the GRASE status of acetaminophen, dextromethorphan, guaifenesin, and phenylephrine as the settled federal standard for OTC self-care, carried forward into every marketed combination product including this Mucinex Fast-Max label.',
    source: {
      externalId: 'src:cares-act-hr748-otc-monograph-reform',
      name: 'Coronavirus Aid, Relief, and Economic Security (CARES) Act, H.R.748, 116th Congress (Pub. L. 116-136), Title III §3851 OTC monograph reform',
      url: 'https://www.congress.gov/bill/116th-congress/house-bill/748',
      publishedAt: '2020-03-27',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2023-09-12',
    datePrecision: 'DAY',
    reason:
      'On September 11–12, 2023 the FDA Nonprescription Drugs Advisory Committee voted 16–0 that current scientific evidence does not support that orally administered phenylephrine is effective as a nasal decongestant at the monograph 10 mg dose, echoing the seminal peer-reviewed meta-analysis of Hatton et al. (2007), which found oral phenylephrine no better than placebo. In November 2024 FDA issued a proposed order to remove oral phenylephrine as a GRASE decongestant, directly contesting one of the four labeled active-ingredient purposes ("Phenylephrine HCl 10 mg — Nasal decongestant") in this product.',
    source: {
      externalId: 'src:hatton-2007-oral-phenylephrine-meta-analysis',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, et al. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381-390.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        externalId: t.source.externalId,
        ingestedBy: 'enrich-openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

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

    console.log(`upserted ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
