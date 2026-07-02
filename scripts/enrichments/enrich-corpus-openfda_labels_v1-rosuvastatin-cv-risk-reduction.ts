// Enrich: epistemic arc for the rosuvastatin cardiovascular-risk-reduction
// (JUPITER primary-prevention) indication claim.
//
// Claim: cmpiyb8sm8q8oplo7y4ltyjaz (openfda_labels_v1)
//   "Rosuvastatin Calcium ... indicated to reduce the risk of major adverse
//    cardiovascular events in adults without established coronary heart disease
//    who are at increased risk based on age, hsCRP >=2 mg/L, and >=1 CV risk factor."
//
// Arc (chronologically monotonic):
//   OPEN     -> RECORDED  2008-11-20  JUPITER trial published (NEJM)
//   RECORDED -> CONTESTED 2012-02-28  FDA statin safety label changes (diabetes/cognitive)
//   CONTESTED-> SETTLED   2013-11-12  ACC/AHA cholesterol guideline reaffirms statins first-line
//
// The pre-existing fromAxis=null status-history row is left untouched.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-rosuvastatin-cv-risk-reduction.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-rosuvastatin-cv-risk-reduction.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyb8sm8q8oplo7y4ltyjaz'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
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
    occurredAt: '2008-11-20',
    datePrecision: 'DAY',
    reason:
      'The JUPITER randomized controlled trial (Ridker et al., N Engl J Med 2008) enrolled 17,802 apparently healthy adults with LDL <130 mg/dL but hsCRP >=2 mg/L and showed rosuvastatin 20 mg cut major cardiovascular events by 44% versus placebo, halting the trial early. This was the first published Phase III evidence that rosuvastatin reduces first CV events in the exact primary-prevention population — elevated hsCRP without established coronary heart disease — later written into the label indication.',
    source: {
      externalId: 'src:rosuvastatin-jupiter-nejm-2008',
      name: 'Ridker PM, Danielson E, Fonseca FAH, et al. Rosuvastatin to Prevent Vascular Events in Men and Women with Elevated C-Reactive Protein (JUPITER). N Engl J Med 2008;359:2195-2207.',
      url: 'https://doi.org/10.1056/NEJMoa0807646',
      publishedAt: '2008-11-20',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-02-28',
    datePrecision: 'DAY',
    reason:
      'On 28 February 2012 the FDA announced important safety label changes to the entire statin class, including rosuvastatin: added warnings of increased blood-sugar levels and new-onset type 2 diabetes, and reports of memory loss and confusion. Coming directly on the heels of JUPITER (in which rosuvastatin showed a modest excess of physician-reported diabetes), the action reopened debate over whether the net benefit of statin primary prevention held once the diabetes signal was weighed, contesting the settled reading of the indication.',
    source: {
      externalId: 'src:fda-statin-safety-label-changes-2012',
      name: 'FDA Drug Safety Communication: Important safety label changes to cholesterol-lowering statin drugs (Feb 28, 2012).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-important-safety-label-changes-cholesterol-lowering-statin-drugs',
      publishedAt: '2012-02-28',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-11-12',
    datePrecision: 'DAY',
    reason:
      'The 2013 ACC/AHA Guideline on the Treatment of Blood Cholesterol (Stone et al., Circulation) established statins as first-line therapy for primary prevention in adults at elevated 10-year atherosclerotic CVD risk — the JUPITER population — and explicitly judged that the small excess risk of incident diabetes is outweighed by the reduction in cardiovascular events. Reaffirming the benefit after the 2012 safety signal settled rosuvastatin primary-prevention use as standard of care.',
    source: {
      externalId: 'src:acc-aha-cholesterol-guideline-2013',
      name: 'Stone NJ, Robinson JG, Lichtenstein AH, et al. 2013 ACC/AHA Guideline on the Treatment of Blood Cholesterol to Reduce Atherosclerotic Cardiovascular Risk in Adults. Circulation 2014;129(25 Suppl 2):S1-S45.',
      url: 'https://doi.org/10.1161/01.cir.0000437738.63853.7a',
      publishedAt: '2013-11-12',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source ${t.source.externalId}`)
      console.log(`[dry-run] history ${historyId}: ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${t.community})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich_openfda_labels_v1',
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

    console.log(`✓ ${historyId}: ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
