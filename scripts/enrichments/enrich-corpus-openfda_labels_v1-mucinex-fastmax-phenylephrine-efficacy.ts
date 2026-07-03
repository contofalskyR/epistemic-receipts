// Enrichment: epistemic arc for the Mucinex Fast-Max Severe Congestion & Cough
// OTC combination label claim (dextromethorphan HBr / guaifenesin / phenylephrine HCl).
//
// The multi-step, verifiable arc tracked here is the efficacy career of the
// product's *oral phenylephrine* decongestant component:
//   RECORDED  — FDA OTC monograph recognizes oral phenylephrine (plus guaifenesin
//               and dextromethorphan) as GRASE nasal-decongestant / expectorant /
//               antitussive actives (21 CFR 341).
//   SETTLED   — the Combat Methamphetamine Epidemic Act of 2005 moved pseudoephedrine
//               behind the counter, making oral phenylephrine the default OTC oral
//               decongestant in combination cold products such as this one.
//   CONTESTED — Sept 2023 FDA Nonprescription Drug Advisory Committee unanimously
//               concluded oral phenylephrine is not effective as a nasal decongestant.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic `${claimId}-${toAxis}-${occurredAt}` slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-fastmax-phenylephrine-efficacy.ts
// Dry-run: append --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpixy97t8c2oplo7bh3mnw4z'

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

interface Enrichment {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string // YYYY-MM-DD
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const ENRICHMENTS: Enrichment[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-23',
    datePrecision: 'YEAR',
    reason:
      'Through the FDA over-the-counter drug monograph review, oral phenylephrine hydrochloride, guaifenesin, and dextromethorphan hydrobromide were codified as generally recognized as safe and effective (GRASE) active ingredients — nasal decongestant, expectorant, and antitussive respectively — in the cold/cough OTC final monographs (codified at 21 CFR part 341). Recognition in the monograph is what makes a fixed-dose combination such as this Mucinex Fast-Max caplet marketable without a new drug application. This established the label claim as a recorded regulatory fact.',
    source: {
      externalId: 'src:cfr-21-341-otc-cold-cough-monograph',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (FDA OTC monograph)',
      url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-D/part-341',
      publishedAt: '1994-08-23',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2006-03-09',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005 — enacted as Title VII of the USA PATRIOT Improvement and Reauthorization Act (Pub. L. 109-177), signed March 9, 2006 — placed pseudoephedrine behind the pharmacy counter with purchase limits and logging requirements. Manufacturers reformulated mainstream OTC cold products around oral phenylephrine, making it the default oral decongestant in over-the-counter combination caplets like this one. That reformulation cemented the phenylephrine decongestant claim as the settled industry standard for shelf-available cold relief.',
    source: {
      externalId: 'src:cmea-2005-hr3199-pl109-177',
      name: 'H.R.3199 — USA PATRIOT Improvement and Reauthorization Act of 2005 (Title VII, Combat Methamphetamine Epidemic Act of 2005), Pub. L. 109-177',
      url: 'https://www.congress.gov/bill/109th-congress/house-bill/3199',
      publishedAt: '2006-03-09',
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
      "At its September 11–12, 2023 meeting, the FDA Nonprescription Drug Advisory Committee reviewed the modern pharmacokinetic and efficacy evidence and voted unanimously (16–0) that orally administered phenylephrine is not effective as a nasal decongestant at the monograph dose, because it is extensively metabolized and reaches negligible systemic concentrations. The conclusion directly contests the 'Nasal decongestant' purpose asserted for the phenylephrine HCl 5 mg component of this label. In November 2024 FDA followed with a proposed order to remove oral phenylephrine from the OTC monograph, leaving the decongestant claim actively disputed.",
    source: {
      externalId: 'src:fda-2023-phenylephrine-advisory-committee',
      name: 'FDA — Clarifies Results of Recent Advisory Committee Meeting on Oral Phenylephrine',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-clarifies-results-recent-advisory-committee-meeting-oral-phenylephrine',
      publishedAt: '2023-09-14',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${ENRICHMENTS.length} transitions${DRY_RUN ? ' (DRY RUN)' : ''}`)

  for (const e of ENRICHMENTS) {
    const historyId = `${CLAIM_ID}-${e.toAxis}-${e.occurredAt}`
    console.log(`  ${e.fromAxis ?? 'null'} -> ${e.toAxis} @ ${e.occurredAt}  [${historyId}]`)

    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: e.source.externalId },
      create: {
        name: e.source.name,
        url: e.source.url,
        publishedAt: new Date(e.source.publishedAt),
        methodologyType: e.source.methodologyType,
        externalId: e.source.externalId,
        ingestedBy: 'enrich_openfda_labels_v1',
        humanReviewed: false,
        autoApproved: true,
      },
      update: {
        name: e.source.name,
        url: e.source.url,
        publishedAt: new Date(e.source.publishedAt),
        methodologyType: e.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: e.fromAxis,
        toAxis: e.toAxis,
        community: e.community,
        reason: e.reason,
        occurredAt: new Date(e.occurredAt),
        datePrecision: e.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: e.fromAxis,
        toAxis: e.toAxis,
        community: e.community,
        reason: e.reason,
        occurredAt: new Date(e.occurredAt),
        datePrecision: e.datePrecision,
        sourceId: source.id,
      },
    })
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
