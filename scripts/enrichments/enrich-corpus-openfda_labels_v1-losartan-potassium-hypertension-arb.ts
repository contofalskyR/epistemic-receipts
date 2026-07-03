// Enrich the epistemic arc for the Losartan Potassium FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiy5olm8keuplo7nji01ryz — Losartan potassium tablets, an angiotensin II
// receptor blocker (ARB) indicated for hypertension and for reduction of stroke risk
// in patients with hypertension and left ventricular hypertrophy (LVH).
//
// Losartan (Cozaar) was the first ARB brought to market (FDA-approved 1995). Its
// defensible epistemic arc is anchored to the very indications the label captures:
// the landmark outcome trial that proved a stroke-reduction benefit in hypertensive
// LVH patients, the guideline codification of ARBs as first-line antihypertensives,
// and the post-market nitrosamine-impurity recalls that contested the safety of
// marketed losartan product.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  2002-03-23  LIFE trial (Lancet) — losartan reduces
//                                     cardiovascular events, principally stroke, vs
//                                     atenolol in hypertensive patients with LVH
//   RECORDED -> SETTLED   2017-11-13  2017 ACC/AHA hypertension guideline lists ARBs
//                                     (incl. losartan) as first-line therapy
//   SETTLED  -> CONTESTED 2019-03-01  FDA nitrosamine (NDMA/NMBA) impurity recalls of
//                                     marketed losartan product (2018–2019)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-losartan-potassium-hypertension-arb.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-losartan-potassium-hypertension-arb.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy5olm8keuplo7nji01ryz'

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
  // ── OPEN -> RECORDED: landmark outcome trial for the stroke/LVH indication (2002) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-03-23',
    datePrecision: 'DAY',
    reason:
      'The LIFE study (Losartan Intervention For Endpoint reduction in hypertension), a prospective randomized double-blind trial of 9,193 hypertensive patients with electrocardiographic left ventricular hypertrophy, was published by Dahlöf and colleagues in The Lancet on 23 March 2002. Losartan reduced the composite of cardiovascular death, stroke, and myocardial infarction versus atenolol at equal blood-pressure control, driven principally by a significant 25% relative reduction in fatal and nonfatal stroke. This Phase III outcome trial is the primary clinical evidence underlying the label indication for stroke-risk reduction in hypertension with LVH captured in the openFDA record.',
    source: {
      externalId: 'src:losartan-life-trial-dahlof-lancet-2002',
      name: 'Dahlöf B, Devereux RB, Kjeldsen SE, et al. Cardiovascular morbidity and mortality in the Losartan Intervention For Endpoint reduction in hypertension study (LIFE): a randomised trial against atenolol. Lancet. 2002;359(9311):995–1003.',
      url: 'https://doi.org/10.1016/S0140-6736(02)08089-3',
      publishedAt: '2002-03-23',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: guideline codification as first-line therapy (2017) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2017-11-13',
    datePrecision: 'DAY',
    reason:
      'The 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA guideline for the prevention, detection, evaluation, and management of high blood pressure in adults (Whelton, Carey, et al.), released 13 November 2017, names angiotensin II receptor blockers — the class of which losartan is the prototype — among the recommended first-line antihypertensive drug classes. This multi-society institutional endorsement settled losartan as an accepted standard-of-care agent for the treatment of hypertension, the primary indication on the label.',
    source: {
      externalId: 'src:losartan-acc-aha-hypertension-guideline-2017',
      name: 'Whelton PK, Carey RM, Aronow WS, et al. 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults. Hypertension. 2018;71(6):e13–e115.',
      url: 'https://doi.org/10.1161/HYP.0000000000000065',
      publishedAt: '2017-11-13',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: post-market nitrosamine impurity recalls (2018–2019) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2019-03-01',
    datePrecision: 'MONTH',
    reason:
      'Beginning in late 2018 and continuing through 2019, the U.S. Food and Drug Administration announced a series of voluntary recalls of marketed losartan potassium product after probable-carcinogen nitrosamine impurities — N-nitrosodimethylamine (NDMA), N-nitrosodiethylamine (NDEA), and N-methylnitrosobutyric acid (NMBA) — were detected in active pharmaceutical ingredient from certain manufacturers. The impurities arose from manufacturing and were not intrinsic to the molecule, so the finding contests the safety of the affected marketed product rather than reversing losartan’s approved therapeutic indications.',
    source: {
      externalId: 'src:losartan-fda-nitrosamine-arb-recalls-2019',
      name: 'U.S. Food and Drug Administration. FDA Updates and Press Announcements on Angiotensin II Receptor Blocker (ARB) Recalls (Valsartan, Losartan, and Irbesartan).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-updates-and-press-announcements-angiotensin-ii-receptor-blocker-arb-recalls-valsartan-losartan',
      publishedAt: '2019-03-01',
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
