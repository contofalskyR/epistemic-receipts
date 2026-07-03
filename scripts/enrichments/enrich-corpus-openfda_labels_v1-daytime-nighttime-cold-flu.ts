// Epistemic-arc enrichment for the FDA drug-label claim:
//   Daytime Nighttime Cold Flu Relief
//   (ACETAMINOPHEN, DEXTROMETHORPHAN HBR, DOXYLAMINE SUCCINATE, PHENYLEPHRINE HCL)
//   Claim id: cmpiykgwg9106plo76o3j304s  (ingestedBy: openfda_labels_v1)
//
// This is a grandfathered OTC-monograph fixed-dose combination, NOT an NDA drug —
// there is no single pivotal Phase II/III registration trial. Rather than fabricate
// one, this arc traces the genuine, well-documented epistemic trajectory of the
// product's "nasal decongestant" component, oral phenylephrine HCl:
//
//   OPEN    -> RECORDED  FDA OTC Drug Review recognizes the four active ingredients
//                        (incl. phenylephrine as a Category I / GRASE nasal
//                        decongestant) under the cough-cold monograph, permitting
//                        the fixed-dose combination. (21 CFR Part 341)
//   RECORDED-> SETTLED   Cochrane systematic review of oral antihistamine-
//                        decongestant-analgesic combinations consolidates these
//                        products as standard, evidence-referenced OTC self-care
//                        for the common cold in adults. (De Sutter 2012)
//   SETTLED -> CONTESTED FDA Nonprescription Drugs Advisory Committee unanimously
//                        concludes oral phenylephrine is NOT effective as a nasal
//                        decongestant at monograph doses, reopening the benefit
//                        basis of the product's decongestant claim. (NDAC, Sep 2023)
//
// Does NOT create a new Claim — it attaches history to the existing claim.
// The existing first entry (fromAxis=null -> RECORDED at label ingest) is left
// untouched; these rows carry the dateable historical arc.
//
// Idempotent: upserts sources and status-history rows.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-daytime-nighttime-cold-flu.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiykgwg9106plo76o3j304s'

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
  // ── OPEN -> RECORDED : OTC monograph recognizes the active ingredients ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-23',
    datePrecision: 'YEAR',
    reason:
      "Through the FDA's OTC Drug Review, each active ingredient in this combination was classified as generally recognized as safe and effective (GRASE) for its stated purpose — acetaminophen as an analgesic/antipyretic, dextromethorphan as an antitussive, doxylamine as an antihistamine, and phenylephrine hydrochloride as a Category I nasal decongestant — and codified under the cough-cold-allergy monograph at 21 CFR Part 341. This regulatory recognition is what records the fixed-dose daytime/nighttime cold-and-flu product as an accepted, marketable OTC therapy rather than an open therapeutic hypothesis.",
    source: {
      externalId: 'src:daytime-cold-flu-otc-monograph-21cfr341',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (FDA OTC monograph; nasal decongestant Category I status for phenylephrine HCl).',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-341',
      publishedAt: '1994-08-23',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED : evidence synthesis / standard OTC self-care ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-02-15',
    datePrecision: 'MONTH',
    reason:
      "A Cochrane systematic review of oral antihistamine-decongestant-analgesic combinations for the common cold pooled randomized controlled trials and concluded that such multi-ingredient products produce a small but measurable benefit on overall symptom recovery in adults and older children. By synthesizing the trial evidence into a formal review, the analysis consolidated fixed-dose cold-and-flu combinations as an established, evidence-referenced element of standard OTC self-care for upper-respiratory symptoms.",
    source: {
      externalId: 'src:daytime-cold-flu-cochrane-desutter-2012',
      name: 'De Sutter AIM, van Driel ML, Kumar AA, Lesslar O, Skrt A. Oral antihistamine-decongestant-analgesic combinations for the common cold. Cochrane Database of Systematic Reviews. 2012;(2):CD004976.',
      url: 'https://doi.org/10.1002/14651858.CD004976.pub3',
      publishedAt: '2012-02-15',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED : FDA advisory committee finds oral PE ineffective ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-09-12',
    datePrecision: 'DAY',
    reason:
      "After reviewing modern pharmacokinetic and placebo-controlled efficacy data, the FDA Nonprescription Drugs Advisory Committee voted unanimously (16-0) that the current scientific evidence does not support oral phenylephrine being effective as a nasal decongestant at monograph doses, citing its extensive first-pass metabolism and negligible systemic bioavailability. Because phenylephrine HCl supplies the 'Nasal decongestant' purpose in this product, the finding directly contested the benefit basis of that labeled claim and set in motion FDA action to remove oral phenylephrine from the OTC monograph.",
    source: {
      externalId: 'src:daytime-cold-flu-fda-ndac-phenylephrine-2023',
      name: 'U.S. FDA Nonprescription Drugs Advisory Committee (NDAC) meeting, September 11–12, 2023 — review of the effectiveness of oral phenylephrine as a nasal decongestant.',
      url: 'https://www.fda.gov/advisory-committees/advisory-committee-calendar/september-11-12-2023-meeting-nonprescription-drugs-advisory-committee-meeting-announcement',
      publishedAt: '2023-09-12',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  // Confirm the target claim exists — never create a new Claim here.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script never creates claims).`)
  }

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions upserted for claim ${CLAIM_ID}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
