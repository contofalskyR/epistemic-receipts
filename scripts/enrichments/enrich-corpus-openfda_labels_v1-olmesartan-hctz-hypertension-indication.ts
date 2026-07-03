// Enrichment: epistemic trajectory for an openFDA-label-ingested claim asserting the
// indication of the fixed-dose combination OLMESARTAN MEDOXOMIL + HYDROCHLOROTHIAZIDE
// (marketed as Benicar HCT and generics) for the treatment of hypertension.
//
// Olmesartan medoxomil is an angiotensin II receptor blocker (ARB); hydrochlorothiazide
// (HCTZ) is a thiazide diuretic. The single-agent olmesartan (Benicar) was FDA-approved
// 2002-04-25; the olmesartan/HCTZ combination (Benicar HCT) was FDA-approved 2003-06-05.
//
// The claim already has its OPEN/null -> first-status entry (the ingested label itself).
// This script adds the downstream historical arc:
//
//   OPEN -> RECORDED (2004): First published randomized controlled trial evidence for the
//     olmesartan + HCTZ combination — Chrysant et al., Am J Hypertens 2004 — establishing
//     the incremental blood-pressure lowering of the combination over monotherapy.
//
//   RECORDED -> SETTLED (2007): Combination ARB + thiazide diuretic therapy is endorsed as
//     standard antihypertensive practice by a major clinical guideline (2007 ESH/ESC
//     Guidelines for the Management of Arterial Hypertension), placing the combination in
//     the recommended armamentarium for blood-pressure control.
//
//   SETTLED -> CONTESTED (2013): Post-market safety signal — the FDA Drug Safety
//     Communication of 2013-07-03 required olmesartan label changes to add sprue-like
//     enteropathy (severe, chronic diarrhea with substantial weight loss), following the
//     Mayo Clinic case series (Rubio-Tapia et al., Mayo Clin Proc 2012). This did not
//     revoke the hypertension indication but introduced a class-atypical, drug-specific
//     serious adverse effect into the risk/benefit assessment.
//
// Only high-confidence, DOI-/.gov-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-olmesartan-hctz-hypertension-indication.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-olmesartan-hctz-hypertension-indication.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyadck8p7iplo7xednctqx'

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

// Do NOT duplicate the existing null -> first-status entry; start from OPEN -> RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-03-01',
    datePrecision: 'MONTH',
    reason:
      'The efficacy of combining olmesartan medoxomil with hydrochlorothiazide was first recorded in the peer-reviewed literature by Chrysant and colleagues, who reported a randomized controlled trial in patients whose hypertension was not adequately controlled by olmesartan monotherapy. Adding hydrochlorothiazide produced significantly greater reductions in seated diastolic and systolic blood pressure than continued monotherapy, establishing the incremental antihypertensive benefit that underlies the fixed-dose combination indication. This primary trial evidence moved the combination claim from an open proposition to a recorded empirical finding.',
    source: {
      externalId: 'src:chrysant-olmesartan-hctz-ajh-2004',
      name:
        'Chrysant SG, Weber MA, Wang AC, Hinman DJ. Evaluation of antihypertensive therapy with the combination of olmesartan medoxomil and hydrochlorothiazide. Am J Hypertens. 2004;17(3):252-259.',
      url: 'https://doi.org/10.1016/j.amjhyper.2003.11.003',
      publishedAt: '2004-03-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2007-06-01',
    datePrecision: 'MONTH',
    reason:
      'Combination therapy pairing a renin-angiotensin system blocker (such as an ARB) with a thiazide diuretic was endorsed as standard antihypertensive practice by the 2007 ESH/ESC Guidelines for the Management of Arterial Hypertension, which explicitly recommended angiotensin-receptor-antagonist-plus-diuretic among the preferred two-drug combinations for patients requiring more than one agent to reach blood-pressure goals. Guideline endorsement of the ARB + thiazide class settled the olmesartan/HCTZ combination as an accepted, guideline-supported treatment rather than a novel finding.',
    source: {
      externalId: 'src:esh-esc-hypertension-guidelines-2007',
      name:
        'Mancia G, De Backer G, Dominiczak A, et al. 2007 Guidelines for the Management of Arterial Hypertension: The Task Force for the Management of Arterial Hypertension of the European Society of Hypertension (ESH) and of the European Society of Cardiology (ESC). J Hypertens. 2007;25(6):1105-1187.',
      url: 'https://doi.org/10.1097/HJH.0b013e3281fc975a',
      publishedAt: '2007-06-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-07-03',
    datePrecision: 'DAY',
    reason:
      'A post-market safety signal contested the settled risk/benefit profile of olmesartan-containing products. Following a Mayo Clinic case series (Rubio-Tapia et al., Mayo Clin Proc 2012) describing severe sprue-like enteropathy — chronic diarrhea with substantial weight loss, mimicking celiac disease and resolving on drug discontinuation — the FDA issued a Drug Safety Communication on 2013-07-03 approving label changes to add this intestinal adverse effect for olmesartan medoxomil (Benicar, Benicar HCT, Azor, Tribenzor, and generics). The hypertension indication was not withdrawn, but a drug-specific, class-atypical serious harm was added to the label, reopening contestation over the agent\'s tolerability.',
    source: {
      externalId: 'src:fda-dsc-olmesartan-sprue-enteropathy-2013',
      name:
        'FDA Drug Safety Communication: FDA approves label changes to include intestinal problems (sprue-like enteropathy) linked to blood pressure medicine olmesartan medoxomil (marketed as Benicar, Benicar HCT, Azor, Tribenzor, and generics). U.S. Food and Drug Administration, July 3, 2013.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-approves-label-changes-include-intestinal-problems-sprue-blood',
      publishedAt: '2013-07-03',
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
