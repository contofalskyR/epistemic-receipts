// Enrich the epistemic arc for the Hydrochlorothiazide FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiydvha8tf6plo7pxhfowgk — Hydrochlorothiazide tablets indicated as
// adjunctive therapy in edema (CHF, hepatic cirrhosis, corticosteroid/estrogen
// therapy, renal dysfunction) and in the management of hypertension (thiazide
// diuretic).
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1967-12  VA Cooperative Study Group — first RCT proving
//                                  a thiazide-based regimen reduces hypertensive morbidity
//   RECORDED -> SETTLED   2003-05  JNC 7 recommends thiazide-type diuretics as
//                                  first-line therapy for most patients with hypertension
//   SETTLED  -> CONTESTED 2018-04  Pedersen et al. nationwide case-control study —
//                                  hydrochlorothiazide/non-melanoma skin cancer signal
//                                  (later driving FDA/EMA label changes)
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-hydrochlorothiazide-hypertension.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-hydrochlorothiazide-hypertension.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydvha8tf6plo7pxhfowgk'

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
  // ── OPEN -> RECORDED: first RCT proving thiazide-based BP treatment reduces morbidity (1967) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1967-12-01',
    datePrecision: 'MONTH',
    reason:
      'The Veterans Administration Cooperative Study Group on Antihypertensive Agents (Freis et al., JAMA, December 1967) published the first randomized, placebo-controlled trial demonstrating that pharmacologic treatment of hypertension — using a regimen built on hydrochlorothiazide — sharply reduced morbid cardiovascular events in men with diastolic pressures of 115–129 mm Hg. This established the primary clinical evidence for treating hypertension with a thiazide diuretic, the indication later captured verbatim in the openFDA hydrochlorothiazide label.',
    source: {
      externalId: 'src:hctz-va-cooperative-1967',
      name: 'Veterans Administration Cooperative Study Group on Antihypertensive Agents. Effects of treatment on morbidity in hypertension. Results in patients with diastolic blood pressures averaging 115 through 129 mm Hg. JAMA. 1967;202(11):1028–1034.',
      url: 'https://doi.org/10.1001/jama.1967.03130240070013',
      publishedAt: '1967-12-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: JNC 7 endorses thiazide diuretics as first-line (2003) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2003-05-21',
    datePrecision: 'DAY',
    reason:
      'The Seventh Report of the Joint National Committee on Prevention, Detection, Evaluation, and Treatment of High Blood Pressure (JNC 7; Chobanian et al., JAMA, May 2003) recommended thiazide-type diuretics — hydrochlorothiazide foremost among them — as initial drug therapy for most patients with uncomplicated hypertension, either alone or combined with other classes. This national guideline ratified hydrochlorothiazide as standard-of-care first-line antihypertensive treatment.',
    source: {
      externalId: 'src:hctz-jnc7-2003',
      name: 'Chobanian AV, Bakris GL, Black HR, et al. The Seventh Report of the Joint National Committee on Prevention, Detection, Evaluation, and Treatment of High Blood Pressure: the JNC 7 report. JAMA. 2003;289(19):2560–2572.',
      url: 'https://doi.org/10.1001/jama.289.19.2560',
      publishedAt: '2003-05-21',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: hydrochlorothiazide / non-melanoma skin cancer safety signal (2018) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-04-01',
    datePrecision: 'MONTH',
    reason:
      'Pedersen and colleagues published a nationwide Danish case-control study (Journal of the American Academy of Dermatology, April 2018) reporting a strong, dose-dependent association between cumulative hydrochlorothiazide exposure and non-melanoma skin cancer, particularly squamous cell carcinoma. The signal prompted regulatory action — the EMA/PRAC and subsequently the FDA required hydrochlorothiazide labels to carry a non-melanoma skin cancer warning — contesting the drug’s unqualified first-line use without reversing its approved indications for hypertension and edema.',
    source: {
      externalId: 'src:hctz-pedersen-skin-cancer-2018',
      name: 'Pedersen SA, Gaist D, Schmidt SAJ, Hölmich LR, Friis S, Pottegård A. Hydrochlorothiazide use and risk of nonmelanoma skin cancer: A nationwide case-control study from Denmark. J Am Acad Dermatol. 2018;78(4):673–681.e9.',
      url: 'https://doi.org/10.1016/j.jaad.2017.11.042',
      publishedAt: '2018-04-01',
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
