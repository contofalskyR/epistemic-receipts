// Enrich the epistemic arc for the Olmesartan medoxomil / Hydrochlorothiazide
// FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiy8y4f8nm0plo787rsnd40 — Olmesartan medoxomil + HCTZ tablets
// indicated for the treatment of hypertension (not for initial therapy).
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  2004-03  first published RCT of the olmesartan/HCTZ
//                                   fixed-dose combination (Chrysant factorial trial)
//   RECORDED -> SETTLED   2007-06  ARB + thiazide fixed-dose combinations ratified as
//                                   standard combination therapy (2007 ESH/ESC guidelines)
//   SETTLED  -> CONTESTED 2013-07  FDA safety communication: olmesartan can cause
//                                   sprue-like enteropathy (post-market safety signal)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-olmesartan-hctz-hypertension.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-olmesartan-hctz-hypertension.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy8y4f8nm0plo787rsnd40'

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
  // ── OPEN -> RECORDED: first published RCT of the olmesartan/HCTZ FDC (2004) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-03-01',
    datePrecision: 'MONTH',
    reason:
      'Chrysant and colleagues published a randomized, double-blind, placebo-controlled factorial trial (American Journal of Hypertension, March 2004) demonstrating that combining olmesartan medoxomil with hydrochlorothiazide produced significantly greater reductions in diastolic and systolic blood pressure than either component alone. This provided the first primary clinical evidence in the literature that the fixed-dose combination is additively effective in hypertension, the basis for the indication captured verbatim in the current openFDA label.',
    source: {
      externalId: 'src:olmesartan-hctz-chrysant-2004',
      name: 'Chrysant SG, Weber MA, Wang AC, Hinman DJ. Evaluation of antihypertensive therapy with the combination of olmesartan medoxomil and hydrochlorothiazide. Am J Hypertens. 2004;17(3):252–259.',
      url: 'https://doi.org/10.1016/j.amjhyper.2003.11.003',
      publishedAt: '2004-03-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: ARB + thiazide FDC ratified as standard therapy (2007) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2007-06-01',
    datePrecision: 'MONTH',
    reason:
      'The 2007 ESH/ESC Guidelines for the Management of Arterial Hypertension (Journal of Hypertension, June 2007) endorsed fixed-dose combinations of an angiotensin-receptor blocker with a thiazide diuretic as a preferred, standard-of-care two-drug antihypertensive regimen. This professional-society ratification of the ARB + thiazide combination class settled the therapeutic standing of the olmesartan/HCTZ combination well beyond its initial trial evidence.',
    source: {
      externalId: 'src:esh-esc-hypertension-guidelines-2007',
      name: 'Mancia G, De Backer G, Dominiczak A, et al. 2007 Guidelines for the Management of Arterial Hypertension (ESH/ESC). J Hypertens. 2007;25(6):1105–1187.',
      url: 'https://doi.org/10.1097/HJH.0b013e3281fc975a',
      publishedAt: '2007-06-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA sprue-like enteropathy safety signal (2013) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-07-03',
    datePrecision: 'DAY',
    reason:
      'On 3 July 2013 the FDA issued a Drug Safety Communication approving label changes to warn that olmesartan-containing products can cause sprue-like enteropathy — severe, chronic diarrhea with substantial weight loss that can develop months to years after starting treatment and resolves on discontinuation. This post-market safety signal contested the drug\'s unqualified use and added a serious adverse-reaction warning, but did not reverse the approved hypertension indication.',
    source: {
      externalId: 'src:olmesartan-fda-enteropathy-2013',
      name: 'FDA Drug Safety Communication: FDA approves label changes to include intestinal problems (sprue-like enteropathy) linked to blood pressure medicine olmesartan medoxomil (3 July 2013).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-approves-label-changes-blood-pressure-medicine-olmesartan-medoxomil',
      publishedAt: '2013-07-03',
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
