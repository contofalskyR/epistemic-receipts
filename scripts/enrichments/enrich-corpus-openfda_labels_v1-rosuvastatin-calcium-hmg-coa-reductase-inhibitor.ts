// Enrich the epistemic arc for the Rosuvastatin calcium FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiygzlb8wycplo7816t6vlz — Rosuvastatin calcium tablets, an HMG-CoA
// reductase inhibitor, indicated for hypertriglyceridemia and dyslipidemia
// (generic of AstraZeneca's CRESTOR; pediatric labeling carved out for exclusivity).
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  2003-07  STELLAR Phase III efficacy trial (Am J Cardiol)
//   RECORDED -> SETTLED   2003-08  FDA approval of CRESTOR (NDA 021366); standard-of-care LDL-lowering
//   SETTLED  -> CONTESTED 2012-02  FDA Drug Safety Communication — class-wide statin label changes (diabetes, cognitive)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-rosuvastatin-calcium-hmg-coa-reductase-inhibitor.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-rosuvastatin-calcium-hmg-coa-reductase-inhibitor.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiygzlb8wycplo7816t6vlz'

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
  // ── OPEN -> RECORDED: first pivotal Phase III efficacy evidence (STELLAR, 2003) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2003-07-15',
    datePrecision: 'DAY',
    reason:
      'Jones, Davidson, Stein and colleagues published the STELLAR trial (Am J Cardiol, 15 July 2003), a randomized Phase III comparison of rosuvastatin against atorvastatin, simvastatin, and pravastatin across doses, establishing that rosuvastatin produced greater LDL-cholesterol and triglyceride reductions than the other statins at comparable doses. This provided the primary controlled clinical evidence that rosuvastatin is an effective HMG-CoA reductase inhibitor for dyslipidemia, the mechanism and indication captured in the current openFDA label.',
    source: {
      externalId: 'src:rosuvastatin-stellar-jones-2003',
      name: 'Jones PH, Davidson MH, Stein EA, et al. Comparison of the efficacy and safety of rosuvastatin versus atorvastatin, simvastatin, and pravastatin across doses (STELLAR Trial). Am J Cardiol. 2003;92(2):152–160.',
      url: 'https://doi.org/10.1016/S0002-9149(03)00530-7',
      publishedAt: '2003-07-15',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: FDA approval of CRESTOR / standard-of-care LDL therapy (2003) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2003-08-12',
    datePrecision: 'DAY',
    reason:
      'The FDA approved CRESTOR (rosuvastatin calcium, NDA 021366) on 12 August 2003 for the treatment of hyperlipidemia and dyslipidemia, ratifying rosuvastatin as standard LDL-lowering therapy. Rapid clinical adoption followed, and the 2013 ACC/AHA blood-cholesterol guideline later classed rosuvastatin among the high-intensity statins, settling the indication reproduced verbatim in the current generic openFDA label.',
    source: {
      externalId: 'src:rosuvastatin-fda-approval-2003',
      name: 'Drugs@FDA — CRESTOR (rosuvastatin calcium), NDA 021366 (approved 12 August 2003).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=021366',
      publishedAt: '2003-08-12',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: FDA class-wide statin safety label changes (2012) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-02-28',
    datePrecision: 'DAY',
    reason:
      'On 28 February 2012 the FDA issued a Drug Safety Communication requiring class-wide labeling changes to statins, including rosuvastatin, to warn of an increased risk of new-onset diabetes (higher HbA1c and fasting glucose) and reports of reversible cognitive impairment. The signal did not reverse the approved lipid-lowering indication but contested unqualified use and added post-market safety warnings to the label, prompting continued benefit–risk debate about statin therapy.',
    source: {
      externalId: 'src:rosuvastatin-fda-statin-safety-2012',
      name: 'FDA Drug Safety Communication: Important safety label changes to cholesterol-lowering statin drugs (28 February 2012).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-important-safety-label-changes-cholesterol-lowering-statin-drugs',
      publishedAt: '2012-02-28',
      methodologyType: 'primary',
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
