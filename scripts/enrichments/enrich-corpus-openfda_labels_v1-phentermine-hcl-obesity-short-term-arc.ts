// Enrichment: epistemic trajectory for the openFDA-label-ingested claim asserting
// phentermine hydrochloride's FDA-approved indication as a short-term (a few weeks)
// adjunct in the management of exogenous obesity (BMI >=30, or >=27 with risk
// factors).
//
// Claim: cmpiyjtft906oplo72v8xipsa (openfda_labels_v1). Phentermine, a
// sympathomimetic anorectic, was first approved by the FDA in 1959 and remains the
// most widely prescribed weight-loss drug in the United States.
//
// The claim already carries its OPEN/null -> RECORDED first entry at label ingest.
// This script adds the downstream epistemic arc, mirroring the chronologically
// ordered RECORDED -> CONTESTED -> SETTLED shape used for other drug claims:
//
//   [existing] OPEN -> RECORDED: First-generation controlled clinical evidence.
//     Munro et al. (BMJ 1968) reported a double-blind controlled comparison of
//     continuous vs. intermittent phentermine anorectic therapy in obesity,
//     establishing the drug's short-term weight-reduction efficacy in the primary
//     trial literature. (Not re-added here — first entry already exists.)
//
//   RECORDED -> CONTESTED (1997): Post-market safety signal. Connolly et al.
//     (NEJM, 28 Aug 1997) reported valvular heart disease in patients taking
//     fenfluramine-phentermine ("fen-phen"), triggering the September 1997 FDA
//     withdrawal of fenfluramine/dexfenfluramine and casting the phentermine-
//     containing weight-loss regimen into acute safety contestation.
//
//   CONTESTED -> SETTLED (2015): The Endocrine Society Clinical Practice Guideline
//     on pharmacological management of obesity (Apovian et al., JCEM 2015)
//     reaffirmed phentermine monotherapy as an FDA-approved option for short-term
//     weight management, resolving that it was the withdrawn fenfluramine component
//     — not phentermine — that carried the valvulopathy risk, and settling
//     phentermine's continued place as short-term standard therapy.
//
// Only high-confidence, DOI-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-phentermine-hcl-obesity-short-term-arc.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-phentermine-hcl-obesity-short-term-arc.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyjtft906oplo72v8xipsa'

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

// Do NOT duplicate the existing null -> RECORDED first entry created at ingest.
// This adds the downstream arc: RECORDED -> CONTESTED -> SETTLED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1997-08-28',
    datePrecision: 'DAY',
    reason:
      "Phentermine's safety in weight-management use was thrown into acute contestation by the fen-phen valvulopathy crisis. Connolly and colleagues at the Mayo Clinic reported 24 women who developed unusual valvular heart disease while taking fenfluramine-phentermine, a widely used off-label combination. The report precipitated the FDA's September 1997 request to withdraw fenfluramine and dexfenfluramine from the market and led to warnings for cardiac valvular disease and primary pulmonary hypertension being associated with anorectic drug use, directly challenging the acceptability of phentermine-containing obesity regimens.",
    source: {
      externalId: 'src:connolly-fenfluramine-phentermine-valvulopathy-nejm-1997',
      name:
        'Connolly HM, Crary JL, McGoon MD, Hensrud DD, Edwards BS, Edwards WD, Schaff HV. Valvular heart disease associated with fenfluramine-phentermine. New England Journal of Medicine. 1997;337(9):581-588.',
      url: 'https://doi.org/10.1056/NEJM199708283370901',
      publishedAt: '1997-08-28',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-02-01',
    datePrecision: 'MONTH',
    reason:
      "The contestation was resolved in phentermine's favor as the evidence separated the withdrawn fenfluramine component from phentermine itself. The Endocrine Society Clinical Practice Guideline on the pharmacological management of obesity (Apovian et al.) reaffirmed phentermine as an FDA-approved agent appropriate for short-term weight management, noting that the valvulopathy and pulmonary-hypertension risks were attributable to fenfluramine/dexfenfluramine rather than phentermine monotherapy. This settled phentermine's continued standing as a short-term adjunct in obesity management, the indication asserted in the FDA label claim.",
    source: {
      externalId: 'src:apovian-endocrine-society-obesity-pharmacotherapy-jcem-2015',
      name:
        'Apovian CM, Aronne LJ, Bessesen DH, McDonnell ME, Murad MH, Pagotto U, Ryan DH, Still CD. Pharmacological management of obesity: an Endocrine Society clinical practice guideline. Journal of Clinical Endocrinology & Metabolism. 2015;100(2):342-362.',
      url: 'https://doi.org/10.1210/jc.2014-3415',
      publishedAt: '2015-02-01',
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
