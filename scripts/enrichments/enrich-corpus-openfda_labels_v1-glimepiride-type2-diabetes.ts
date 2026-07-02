// Enrich the epistemic arc for the Glimepiride FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiydpur8t7uplo70p7pjx0n — Glimepiride tablets indicated as an adjunct
// to diet and exercise to improve glycemic control in adults with type 2 diabetes
// mellitus (sulfonylurea). Not for type 1 diabetes or diabetic ketoacidosis.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1996-11  first published double-blind placebo-controlled RCT (Rosenstock, Diabetes Care)
//   RECORDED -> SETTLED   2006-08  ADA/EASD consensus algorithm endorses sulfonylureas as core well-validated therapy
//   SETTLED  -> CONTESTED 2015-01  Lancet Diab Endocrinol network meta-analysis — sulfonylurea mortality signal
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-glimepiride-type2-diabetes.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-glimepiride-type2-diabetes.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydpur8t7uplo70p7pjx0n'

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
  // ── OPEN -> RECORDED: first published placebo-controlled efficacy RCT (1996) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1996-11-01',
    datePrecision: 'MONTH',
    reason:
      'Rosenstock and the Glimepiride Study Group published the first large double-blind, placebo-controlled randomized trial of glimepiride in patients with non-insulin-dependent (type 2) diabetes mellitus (Diabetes Care, November 1996), demonstrating that the once-daily sulfonylurea significantly lowered fasting plasma glucose and HbA1c versus placebo. This established the primary clinical evidence for the efficacy claim later captured verbatim in the openFDA label — adjunct to diet and exercise to improve glycemic control in type 2 diabetes.',
    source: {
      externalId: 'src:glimepiride-rosenstock-1996',
      name: 'Rosenstock J, Samols E, Muchmore DB, Schneider J. Glimepiride, a new once-daily sulfonylurea. A double-blind placebo-controlled study of NIDDM patients. Glimepiride Study Group. Diabetes Care. 1996;19(11):1194–1199.',
      url: 'https://doi.org/10.2337/diacare.19.11.1194',
      publishedAt: '1996-11-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: ADA/EASD consensus algorithm endorses sulfonylureas (2006) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2006-08-01',
    datePrecision: 'MONTH',
    reason:
      'The joint American Diabetes Association / European Association for the Study of Diabetes consensus algorithm (Nathan et al., Diabetes Care, August 2006) placed sulfonylureas — including glimepiride — among the well-validated core therapies for lowering glycemia in type 2 diabetes, recommended as a step to add when metformin plus lifestyle fail to reach glycemic targets. This guideline inclusion ratified glimepiride as standard-of-care oral glucose-lowering therapy across major practice.',
    source: {
      externalId: 'src:glimepiride-ada-easd-consensus-2006',
      name: 'Nathan DM, Buse JB, Davidson MB, et al. Management of hyperglycemia in type 2 diabetes: a consensus algorithm for the initiation and adjustment of therapy. A consensus statement from the ADA and the EASD. Diabetes Care. 2006;29(8):1963–1972.',
      url: 'https://doi.org/10.2337/dc06-9912',
      publishedAt: '2006-08-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: sulfonylurea mortality safety signal (2015) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-01-01',
    datePrecision: 'MONTH',
    reason:
      'Simpson and colleagues published a systematic review and network meta-analysis (Lancet Diabetes & Endocrinology, January 2015) finding that sulfonylureas as a class are associated with increased all-cause and cardiovascular mortality relative to other glucose-lowering strategies, while ranking glimepiride and gliclazide as lower-risk than glibenclamide. Coupled with the long-standing UGDP-derived cardiovascular-mortality warning that FDA requires on every sulfonylurea label, this contested unqualified first-line use of glimepiride without reversing its approved indication.',
    source: {
      externalId: 'src:glimepiride-simpson-mortality-2015',
      name: 'Simpson SH, Lee J, Choi S, Vandermeer B, Abdelmoneim AS, Featherstone TR. Mortality risk among sulfonylureas: a systematic review and network meta-analysis. Lancet Diabetes Endocrinol. 2015;3(1):43–51.',
      url: 'https://doi.org/10.1016/S2213-8587(14)70213-X',
      publishedAt: '2015-01-01',
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
