// Enrich the epistemic arc for the "Cold and Flu Severe" combination FDA-label
// claim (openfda_labels_v1).
//
// Claim: cmpiydwdf8tgcplo73zkzwyhu — a fixed-dose OTC combination
// (ACETAMINOPHEN, CHLORPHENIRAMINE MALEATE, DEXTROMETHORPHAN HBr, GUAIFENESIN,
// PHENYLEPHRINE HCl) whose label "Purpose" statement asserts pain reliever/fever
// reducer, cough suppressant, expectorant, and nasal decongestant activity.
//
// There is no single Phase II/III trial for a five-way OTC combination — the
// component actives are governed by the FDA OTC monograph system. The empirically
// live and decidable spine of this product's claim is the ORAL PHENYLEPHRINE
// "nasal decongestant" purpose, whose efficacy has a genuine recorded->settled->
// contested arc. That is the arc enriched here.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1994-08-23  Final OTC cough-cold monograph (21 CFR 341) codifies
//                                     the actives — incl. oral phenylephrine HCl — as GRASE Category I
//   RECORDED -> SETTLED   2006-03-09  Combat Methamphetamine Epidemic Act (Pub. L. 109-177) moves
//                                     pseudoephedrine behind the counter, making oral phenylephrine
//                                     the default OTC oral decongestant / standard self-care
//   SETTLED  -> CONTESTED 2007-03-01  Hatton et al. meta-analysis: oral phenylephrine 10 mg no better
//                                     than placebo — post-market efficacy signal (later FDA NDAC 16-0
//                                     vote, Sept 2023; proposed monograph removal, Nov 2024)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-cold-flu-severe-combination.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-cold-flu-severe-combination.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydwdf8tgcplo73zkzwyhu'

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
  // ── OPEN -> RECORDED: OTC cough-cold final monograph codifies the actives as GRASE (1994) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-23',
    datePrecision: 'DAY',
    reason:
      'The FDA Final Monograph for OTC nasal decongestant drug products (published in the Federal Register at 59 FR 43386 on August 23, 1994, and codified within 21 CFR Part 341, "Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use") recognized oral phenylephrine hydrochloride, together with the companion antitussive (dextromethorphan), antihistamine (chlorpheniramine), and expectorant (guaifenesin) actives, as Category I — generally recognized as safe and effective at labeled doses. This is the first federal recording of the efficacy claims that the product later restates verbatim in its label "Purpose" statement: pain reliever/fever reducer, cough suppressant, expectorant, and nasal decongestant.',
    source: {
      externalId: 'src:cold-flu-otc-monograph-341-1994',
      name: 'Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use — 21 CFR Part 341 (Final Monograph for OTC Nasal Decongestant Drug Products, 59 FR 43386, Aug. 23, 1994).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1994-08-23',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED: CMEA makes oral phenylephrine the default OTC decongestant (2006) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2006-03-09',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005, enacted as Title VII of the USA PATRIOT Improvement and Reauthorization Act (Pub. L. 109-177, signed March 9, 2006), placed pseudoephedrine behind the pharmacy counter with sales logging and quantity limits. Manufacturers reformulated cough-cold combinations to oral phenylephrine, which became the default nonprescription oral nasal decongestant, cementing multi-ingredient products like this one as the standard OTC self-care regimen for cold and flu symptoms. The monographed "nasal decongestant" purpose thereby became settled, broadly adopted practice across the retail pharmaceutical market.',
    source: {
      externalId: 'src:cmea-2006-pl-109-177',
      name: 'Combat Methamphetamine Epidemic Act of 2005 (Title VII of the USA PATRIOT Improvement and Reauthorization Act, Pub. L. 109-177; H.R. 3199, 109th Congress).',
      url: 'https://www.congress.gov/bill/109th-congress/house-bill/3199',
      publishedAt: '2006-03-09',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: meta-analysis finds oral phenylephrine no better than placebo (2007) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      'Hatton and colleagues published a systematic review and meta-analysis (Annals of Pharmacotherapy, March 2007) concluding that oral phenylephrine at the monograph dose of 10 mg is no more effective than placebo as a nasal decongestant, formally contesting one of the label\'s four stated purposes. The efficacy signal was escalated by the FDA Nonprescription Drugs Advisory Committee, which in September 2023 voted 16-0 that oral phenylephrine is not effective at labeled doses, and in November 2024 the FDA issued a proposed order to remove oral phenylephrine as a GRASE OTC nasal decongestant active ingredient. The product\'s "nasal decongestant" claim is therefore actively contested and under proposed federal reversal, while its analgesic, antitussive, and expectorant purposes remain intact.',
    source: {
      externalId: 'src:phenylephrine-hatton-meta-2007',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381-390.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'derivative',
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
