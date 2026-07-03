// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// INDICATIONS AND USAGE of simvastatin — indicated "to reduce the risk of total
// mortality by reducing risk of coronary heart disease death, non-fatal
// myocardial infarction and stroke, and the need for coronary and non-coronary
// revascularization procedures in adults with established coronary heart disease
// ... who are at high risk of coronary heart disease events."
//
// The claim (an FDA structured-product-label snapshot ingested 2026-05-12)
// already carries its null -> RECORDED first entry. This script adds the
// downstream epistemic arc of simvastatin as a cardiovascular-mortality drug fact:
//
//   OPEN -> RECORDED (1994): The Scandinavian Simvastatin Survival Study (4S), the
//     first large randomized outcome trial to demonstrate that cholesterol
//     lowering with simvastatin reduces total mortality in patients with coronary
//     heart disease, published in The Lancet. 4S is the primary clinical evidence
//     that underlies the label's very indication — reduction of total mortality
//     and coronary events — moving it from an open hypothesis to a recorded fact.
//
//   RECORDED -> SETTLED (2001): The NCEP Adult Treatment Panel III (ATP III)
//     guideline, published in JAMA, codified LDL-lowering statin therapy as the
//     standard of care for high-risk patients, establishing simvastatin-class
//     drugs as first-line secondary prevention. This canonical institutional
//     endorsement settled the recorded finding into clinical standard of care.
//
//   SETTLED -> CONTESTED (2011): The FDA Drug Safety Communication restricting
//     high-dose (80 mg) simvastatin due to elevated risk of myopathy and
//     rhabdomyolysis (driven by the SEARCH trial signal) contested the settled
//     assumption that maximal simvastatin dosing was a safe route to its
//     mortality benefit, adding contraindications and dose limitations to the drug.
//
// Only high-confidence, stably-identified sources are encoded (one Lancet DOI,
// one JAMA / NCEP ATP III DOI, one FDA.gov Drug Safety Communication).
//
// NOTE: Live URL verification (WebFetch/WebSearch) was unavailable in the
// authoring session; sources are included on a high-confidence basis — canonical
// DOIs (10.1016/S0140-6736(94)90566-5 , 10.1001/jama.285.19.2486) and an official
// FDA Drug Safety Communication.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-simvastatin-cardiovascular-mortality-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-simvastatin-cardiovascular-mortality-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyht8p8xx6plo7b7tyb4nd'

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

// Do NOT duplicate the existing null -> RECORDED first entry; this arc restates
// the epistemic history explicitly starting from OPEN -> RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1994-11-19',
    datePrecision: 'DAY',
    reason:
      "Simvastatin's mortality-reduction indication entered the peer-reviewed record with the Scandinavian Simvastatin Survival Study (4S), published in The Lancet in 1994. In 4,444 patients with coronary heart disease, 4S was the first large randomized outcome trial to show that cholesterol lowering with simvastatin reduced total mortality, coronary death, and the need for revascularization. This primary trial evidence directly underlies the label's indication and marks the transition from an open hypothesis to a recorded clinical fact.",
    source: {
      externalId: 'src:4s-scandinavian-simvastatin-survival-study-lancet-1994',
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
      "The Third Report of the National Cholesterol Education Program (NCEP) Expert Panel — Adult Treatment Panel III (ATP III), published in JAMA in 2001 — codified aggressive LDL-cholesterol lowering with statin therapy as the standard of care for patients at high risk of coronary events. By establishing simvastatin-class drugs as first-line secondary prevention for the exact high-risk population named in the label, this canonical institutional guideline settled the recorded 4S finding into clinical standard of care.",
    source: {
      externalId: 'src:ncep-atp-iii-executive-summary-jama-2001',
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
      "The FDA Drug Safety Communication of June 8, 2011 contested the settled assumption that maximal-dose simvastatin was a safe route to its mortality benefit. Citing the SEARCH trial signal, the FDA restricted use of the 80 mg dose, added new contraindications and dose limitations, and warned of elevated risk of myopathy and rhabdomyolysis. This regulatory action placed the drug's high-dose regimen — and by extension its risk-benefit profile — into active contest.",
    source: {
      externalId: 'src:fda-dsc-simvastatin-80mg-restrictions-2011',
      name:
        'U.S. Food and Drug Administration. FDA Drug Safety Communication: New restrictions, contraindications, and dose limitations for Zocor (simvastatin) to reduce the risk of muscle injury. June 8, 2011.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-new-restrictions-contraindications-and-dose-limitations-zocor',
      publishedAt: '2011-06-08',
      methodologyType: 'derivative',
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
