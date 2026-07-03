// Enrichment: epistemic trajectory for an openFDA-label-ingested claim describing
// simvastatin's labeled indication — reducing the risk of total mortality (coronary
// heart disease death, non-fatal myocardial infarction, stroke, revascularization)
// in high-risk adults, and as an adjunct to diet to lower cholesterol.
//
// Simvastatin (a semi-synthetic HMG-CoA reductase inhibitor derived from lovastatin)
// was developed by Merck and first approved by the FDA in 1991 (Zocor). The claim's
// core assertion — that the drug REDUCES TOTAL MORTALITY in established
// cardiovascular disease — was not an approval-era certainty; it was won by a single
// landmark outcomes trial, then generalized into standard-of-care guidelines, then
// qualified by a post-market muscle-injury safety signal.
//
// The claim already has its OPEN/null -> first-status entry (the label record
// itself, dated to the openFDA ingest). This script adds the downstream arc:
//
//   OPEN -> RECORDED (1994-11-19): First pivotal clinical evidence. The Scandinavian
//     Simvastatin Survival Study (4S), a randomised placebo-controlled Phase III
//     outcomes trial in 4,444 patients with coronary heart disease, published in The
//     Lancet, was the first statin trial to demonstrate a reduction in TOTAL
//     MORTALITY — the exact proposition this label asserts.
//
//   RECORDED -> SETTLED (2001-05-16): Guideline inclusion / standard-of-care. The
//     NCEP Adult Treatment Panel III (ATP III) report in JAMA established
//     statin therapy (including simvastatin) as first-line standard of care for
//     LDL-cholesterol lowering and cardiovascular risk reduction; simvastatin is
//     also on the WHO Model List of Essential Medicines.
//
//   SETTLED -> CONTESTED (2011-06-08): Post-market safety signal. The FDA issued a
//     Drug Safety Communication imposing new restrictions, contraindications and
//     dose limitations on high-dose (80 mg) simvastatin to reduce the risk of muscle
//     injury (myopathy/rhabdomyolysis). The drug remains approved and widely used at
//     standard doses, so its labeled benefit is qualified rather than withdrawn —
//     CONTESTED, not REVERSED.
//
// Only high-confidence, verifiable URLs are encoded (two canonical DOIs and an
// FDA.gov Drug Safety Communication).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-simvastatin-chd-mortality-statin-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-simvastatin-chd-mortality-statin-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyeyfi8uo0plo77lote07n'

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

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> first-status entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1994-11-19',
    datePrecision: 'DAY',
    reason:
      "The central proposition of this label — that simvastatin reduces total mortality in patients with established coronary heart disease — was first recorded by the Scandinavian Simvastatin Survival Study (4S), a randomised, double-blind, placebo-controlled Phase III outcomes trial in 4,444 patients with angina or prior myocardial infarction, published in The Lancet on 19 November 1994. 4S was the first statin trial to show a statistically significant reduction in all-cause mortality (relative risk 0.70) alongside reductions in coronary death, major coronary events and revascularization. It moved simvastatin's mortality benefit from plausible pharmacology to an empirically recorded fact.",
    source: {
      externalId: 'src:simvastatin-4s-lancet-1994',
      name:
        'Scandinavian Simvastatin Survival Study Group. Randomised trial of cholesterol lowering in 4444 patients with coronary heart disease: the Scandinavian Simvastatin Survival Study (4S). Lancet. 1994;344(8934):1383-1389.',
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
      "Simvastatin's role as standard-of-care therapy for cardiovascular risk reduction was settled by guideline adoption. The Third Report of the National Cholesterol Education Program (NCEP) Adult Treatment Panel (ATP III), published in JAMA on 16 May 2001, established statin therapy as the first-line pharmacologic treatment for elevated LDL cholesterol and for reducing coronary heart disease events, codifying the drug class into national clinical practice. Simvastatin is also listed on the WHO Model List of Essential Medicines, confirming its standard-of-care status for exactly the indications this label asserts.",
    source: {
      externalId: 'src:ncep-atp-iii-jama-2001',
      name:
        'Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults. Executive Summary of the Third Report of the National Cholesterol Education Program (NCEP) Expert Panel (Adult Treatment Panel III). JAMA. 2001;285(19):2486-2497.',
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
      "A post-market safety signal qualified simvastatin's benefit-risk balance. On 8 June 2011 the FDA issued a Drug Safety Communication announcing new restrictions, contraindications and dose limitations for the highest approved dose (80 mg) of simvastatin (Zocor) to reduce the risk of myopathy and rhabdomyolysis (muscle injury), based on the SEARCH trial and adverse-event data. The FDA advised that 80 mg should be used only in patients already tolerating it long-term and required labeling changes and new drug-interaction contraindications. Simvastatin remains approved and standard-of-care at lower doses, so its labeled benefit is contested and qualified rather than reversed.",
    source: {
      externalId: 'src:fda-simvastatin-zocor-dose-restriction-2011',
      name:
        'FDA Drug Safety Communication: New restrictions, contraindications, and dose limitations for Zocor (simvastatin) to reduce the risk of muscle injury (8 June 2011).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-new-restrictions-contraindications-and-dose-limitations-zocor',
      publishedAt: '2011-06-08',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
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

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
