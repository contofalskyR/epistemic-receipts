// Enrichment: epistemic arc for the Maximum Strength Mucinex Fast-Max Cold & Flu
// OTC drug-label claim (claim id cmpiybyvg8r5iplo7q1fu3li9 — the 5 mg phenylephrine
// caplet variant; a separate 10 mg variant, claim cmpiy9hu38o8oplo74ysjmwza, is
// enriched in enrich-corpus-openfda_labels_v1-mucinex-fastmax-phenylephrine.ts).
//
// Three of the four actives in this combination (acetaminophen, dextromethorphan,
// guaifenesin) are stable, uncontested OTC-monograph ingredients. The one active with
// a genuine, dateable, multi-step epistemic trajectory is PHENYLEPHRINE HCl 5 mg, the
// "Nasal decongestant" in this product:
//   OPEN -> RECORDED   : recognized GRASE in the FDA OTC nasal-decongestant monograph (1994)
//   RECORDED -> SETTLED : deemed a final administrative order by CARES Act OTC monograph reform (2020)
//   SETTLED -> CONTESTED : FDA advisory committee votes 16-0 that oral phenylephrine is ineffective (2023)
//   CONTESTED -> REVERSED : FDA proposes ending oral phenylephrine as a monograph decongestant (2024)
//
// Idempotent: upserts Source on externalId (shared with the sibling enrichment where
// the source is the same) and ClaimStatusHistory on a deterministic id. Does NOT create
// a new Claim and does NOT duplicate the existing fromAxis=null status row.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fastmax-coldflu-phenylephrine.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiybyvg8r5iplo7q1fu3li9'

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
  // 1) OPEN -> RECORDED : phenylephrine HCl recognized in the OTC monograph
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-23',
    datePrecision: 'DAY',
    reason:
      'FDA published the final over-the-counter monograph for nasal decongestant drug products, codified at 21 CFR Part 341, recognizing phenylephrine hydrochloride — alongside acetaminophen, dextromethorphan, and guaifenesin under their respective OTC monographs — as generally recognized as safe and effective (GRASE) for its labeled purpose. This regulatory recognition is what let combination products such as this Mucinex Fast-Max caplet market phenylephrine HCl 5 mg as a "Nasal decongestant" without a product-specific new drug application.',
    source: {
      externalId: 'src:fda-otc-monograph-341-nasal-decongestant',
      name: 'FDA OTC Monograph — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (21 CFR Part 341; phenylephrine HCl at 21 CFR 341.20)',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1994-08-23',
      methodologyType: 'primary',
    },
  },

  // 2) RECORDED -> SETTLED : CARES Act OTC monograph reform makes it a final order
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

  // 3) SETTLED -> CONTESTED : FDA advisory committee votes oral phenylephrine ineffective
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2023-09-12',
    datePrecision: 'DAY',
    reason:
      'On September 11–12, 2023 the FDA Nonprescription Drugs Advisory Committee voted 16–0 that current scientific evidence does not support that orally administered phenylephrine is effective as a nasal decongestant at monograph doses, formally echoing the seminal peer-reviewed meta-analysis of Hatton et al. (2007), which found oral phenylephrine no better than placebo. This directly contested one of the four labeled active-ingredient purposes ("Phenylephrine HCl 5 mg — Nasal decongestant") in this product, while leaving the ingredient\'s safety unquestioned.',
    source: {
      externalId: 'src:hatton-2007-oral-phenylephrine-meta-analysis',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381-390.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'primary',
    },
  },

  // 4) CONTESTED -> REVERSED : FDA proposes removing oral phenylephrine from the monograph
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-11-07',
    datePrecision: 'DAY',
    reason:
      'FDA issued a proposed order to end the use of oral phenylephrine as an OTC monograph nasal decongestant active ingredient, concluding on the accumulated evidence that it is not effective at any studied dose. The action followed the September 2023 advisory-committee vote and reverses the efficacy basis of the 1994 monograph recognition for the "Nasal decongestant" active in this product; the safety of the ingredient was not called into question.',
    source: {
      externalId: 'src:fda-phenylephrine-proposed-order-2024',
      name: 'U.S. Food and Drug Administration. FDA Proposes Ending Use of Oral Phenylephrine as OTC Monograph Nasal Decongestant Active Ingredient. November 7, 2024.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-proposes-ending-use-oral-phenylephrine-otc-monograph-nasal-decongestant-active-ingredient',
      publishedAt: '2024-11-07',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} phenylephrine-arc transitions...`)

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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
