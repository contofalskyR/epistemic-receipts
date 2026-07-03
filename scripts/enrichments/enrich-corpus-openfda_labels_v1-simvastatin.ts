// Enrichment: epistemic arc for the simvastatin FDA drug-label claim
// (claim id cmpiy9zj88oqiplo7073qizxq).
//
// The epistemic thread for this HMG-CoA reductase inhibitor (Merck's Zocor,
// MK-733), whose label indication centers on reducing total mortality and major
// coronary events in high-risk patients:
//   RECORDED  — The Scandinavian Simvastatin Survival Study (4S), the first large
//               randomized secondary-prevention trial to show that simvastatin
//               reduces all-cause mortality and coronary events, published in
//               The Lancet on 19 Nov 1994. This is the primary clinical evidence
//               underpinning the label's mortality/CHD-event indication.
//   SETTLED   — Statin therapy (with simvastatin as an anchor agent) became
//               standard of care when the NCEP Adult Treatment Panel III (ATP III)
//               guideline institutionalized LDL-lowering targets and statin
//               first-line therapy for CHD risk reduction (JAMA, 16 May 2001).
//   CONTESTED — FDA Drug Safety Communication (8 Jun 2011) imposed new dose
//               limitations, contraindications, and restrictions on simvastatin
//               (especially the 80 mg dose) after the SEARCH trial and post-market
//               data showed elevated risk of myopathy and rhabdomyolysis. This
//               contests the long-settled safety profile at high doses while the
//               efficacy of the indication remains accepted.
//
// NOTE ON VERIFICATION: web tools were unavailable in the authoring session, so the
// URLs below could not be live-fetched. They are limited to canonical, stable
// identifiers on preferred domains — a Lancet DOI (4S), a JAMA DOI (ATP III), and
// an official FDA.gov drug-safety-communication permalink — rather than guessed
// deep links. Spot-check against the canonical pages before treating any source as
// human-reviewed.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on deterministic id.
// The claim's first (fromAxis=null) status row already exists — this script does NOT
// duplicate it and does NOT create a new Claim.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-simvastatin.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiy9zj88oqiplo7073qizxq'

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
    community: 'EXPERT_LITERATURE',
    occurredAt: '1994-11-19',
    datePrecision: 'DAY',
    reason:
      'The Scandinavian Simvastatin Survival Study (4S) — a randomized, double-blind, placebo-controlled trial of 4,444 patients with coronary heart disease and elevated cholesterol — reported that simvastatin reduced all-cause mortality by 30% and coronary deaths, non-fatal myocardial infarction, and revascularization need. Published in The Lancet on 19 November 1994, it was the first large outcome trial to prove a statin lowers total mortality, and it is the primary clinical evidence behind the label\'s mortality- and CHD-event-reduction indication.',
    source: {
      externalId: 'src:lancet-4s-simvastatin-1994',
      name: 'Randomised trial of cholesterol lowering in 4444 patients with coronary heart disease: the Scandinavian Simvastatin Survival Study (4S). Lancet 1994;344(8934):1383-1389',
      url: 'https://doi.org/10.1016/S0140-6736(94)90566-5',
      publishedAt: '1994-11-19',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2001-05-16',
    datePrecision: 'DAY',
    reason:
      'The National Cholesterol Education Program\'s Adult Treatment Panel III (ATP III) executive summary, published in JAMA on 16 May 2001, established LDL-cholesterol treatment goals and positioned statins as first-line therapy for reducing coronary heart disease risk. This guideline institutionalized simvastatin-class therapy as the standard of care for the high-risk secondary-prevention population described in the label, settling its clinical role.',
    source: {
      externalId: 'src:ncep-atp3-jama-2001',
      name: 'Executive Summary of the Third Report of the National Cholesterol Education Program (NCEP) Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults (Adult Treatment Panel III). JAMA 2001;285(19):2486-2497',
      url: 'https://doi.org/10.1001/jama.285.19.2486',
      publishedAt: '2001-05-16',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-06-08',
    datePrecision: 'DAY',
    reason:
      'On 8 June 2011 the FDA issued a Drug Safety Communication announcing new restrictions, contraindications, and dose limitations for simvastatin (Zocor) to reduce the risk of muscle injury. Prompted by the SEARCH trial and post-market surveillance showing elevated myopathy and rhabdomyolysis risk — especially at the 80 mg dose and in combination with certain drugs — the action contested simvastatin\'s long-settled safety profile at high doses even as its efficacy for the labeled indication remained accepted.',
    source: {
      externalId: 'src:fda-dsc-simvastatin-muscle-injury-2011',
      name: 'FDA Drug Safety Communication: New restrictions, contraindications, and dose limitations for Zocor (simvastatin) to reduce the risk of muscle injury (U.S. Food and Drug Administration)',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-new-restrictions-contraindications-and-dose-limitations-zocor',
      publishedAt: '2011-06-08',
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
