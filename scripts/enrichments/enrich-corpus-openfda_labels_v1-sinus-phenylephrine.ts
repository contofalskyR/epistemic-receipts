// Enrichment: epistemic arc for the OTC sinus/cold combination product
//   "Sinus Pressure and Pain Daytime Nighttime Maximum Strength"
//   (ACETAMINOPHEN, DIPHENHYDRAMINE HCL, GUAIFENESIN, PHENYLEPHRINE HCL)
//   claim id cmpixxubn8bjcplo7gqvf9b0e (openfda_labels_v1)
//
// This product is an OTC-monograph combination, not a new-drug pivotal-trial
// approval. Its most documented epistemic arc is the rise-and-contest of oral
// phenylephrine as a nasal decongestant:
//   OPEN   -> RECORDED : actives classified GRASE under the FDA OTC Drug Review,
//                        codified at 21 CFR part 341.
//   RECORDED -> SETTLED: Combat Methamphetamine Epidemic Act (2006) restricted
//                        pseudoephedrine; oral phenylephrine became the default
//                        OTC oral decongestant — settled by market adoption.
//   SETTLED -> CONTESTED: FDA Nonprescription Drugs Advisory Committee (Sept 2023)
//                        voted unanimously that oral phenylephrine is not
//                        effective; FDA proposed removal (Nov 2024).
//
// Does NOT create a Claim — only Source + ClaimStatusHistory rows for the
// existing claim. Idempotent (upserts). The existing null->first row is left
// untouched.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-sinus-phenylephrine.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixxubn8bjcplo7gqvf9b0e'

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
  // ── OPEN -> RECORDED : OTC monograph classifies the actives as GRASE ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1976-09-09',
    datePrecision: 'MONTH',
    reason:
      'The FDA Over-the-Counter Drug Review advisory panel on cold, cough, allergy, bronchodilator, and antiasthmatic products classified oral phenylephrine hydrochloride (nasal decongestant) and guaifenesin (expectorant), alongside acetaminophen and diphenhydramine, as Category I — generally recognized as safe and effective for their labeled purposes. Those determinations were codified in the OTC monograph at 21 CFR part 341, which lists phenylephrine HCl as an approved oral nasal decongestant and guaifenesin as an approved expectorant. This gave the product\'s active ingredients formal regulatory standing through the monograph pathway, without a single new-drug pivotal trial.',
    source: {
      externalId: 'src:ecfr-21cfr341-otc-cough-cold-monograph',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (OTC monograph; phenylephrine HCl approved nasal decongestant, guaifenesin approved expectorant).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1976-09-09',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED : CMEA restricts pseudoephedrine; phenylephrine becomes default ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2006-03-09',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005 — enacted as Title VII of the USA PATRIOT Improvement and Reauthorization Act (H.R.3199), signed into law March 9, 2006 — moved pseudoephedrine behind the pharmacy counter with purchase limits and sales logging. Manufacturers reformulated most mass-market OTC "sinus" and "cold" products to oral phenylephrine, making it the default nonprescription oral decongestant and settling phenylephrine-based combinations as the standard shelf offering. This settlement was established by market adoption rather than by a clinical guideline.',
    source: {
      externalId: 'src:cmea-2006-hr3199-congress',
      name: 'H.R.3199, USA PATRIOT Improvement and Reauthorization Act of 2005 (Pub. L. 109-177), Title VII — Combat Methamphetamine Epidemic Act of 2005; signed March 9, 2006.',
      url: 'https://www.congress.gov/bill/109th-congress/house-bill/3199',
      publishedAt: '2006-03-09',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED : FDA advisory committee finds oral phenylephrine ineffective ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-09-14',
    datePrecision: 'DAY',
    reason:
      'On September 12, 2023 the FDA Nonprescription Drugs Advisory Committee voted unanimously (16–0) that the available scientific evidence does not support oral phenylephrine at OTC monograph doses being effective as a nasal decongestant, and the FDA publicly clarified that conclusion two days later. In November 2024 the FDA followed with a proposed order to remove oral phenylephrine as an approved OTC monograph nasal decongestant active ingredient. This places the "nasal decongestant" purpose of this phenylephrine-containing product in a contested state pending final regulatory action.',
    source: {
      externalId: 'src:fda-ndac-oral-phenylephrine-2023',
      name: 'FDA. "FDA Clarifies Results of Recent Advisory Committee Meeting on Oral Phenylephrine" (Nonprescription Drugs Advisory Committee, Sept. 11–12, 2023).',
      url: 'https://www.fda.gov/drugs/news-events-human-drugs/fda-clarifies-results-recent-advisory-committee-meeting-oral-phenylephrine',
      publishedAt: '2023-09-14',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-sinus-phenylephrine',
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
    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Enriched claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
