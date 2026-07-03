// Enrichment: epistemic trajectory for the openFDA label claim covering
// PHENTERMINE HYDROCHLORIDE — indicated as a short-term adjunct in a regimen of
// weight reduction for the management of exogenous obesity.
//
// The subject fact is phentermine as a short-term anorectic (appetite-suppressant)
// adjunct for weight reduction in obesity. The claim already carries its
// null -> RECORDED first entry (the drug's entry into the clinical/regulatory
// record — FDA approval of phentermine as an anorectic, 1959). This script adds
// the downstream arc:
//
//   RECORDED -> SETTLED (1992): Phentermine, a modestly used short-term appetite
//     suppressant since its 1959 FDA approval, became the dominant prescription
//     weight-loss drug in the United States after Michael Weintraub's multi-year
//     trial reported sustained weight loss from combining phentermine with
//     fenfluramine. The resulting "fen-phen" boom drove prescriptions into the
//     millions per year by the mid-1990s, settling phentermine as the standard
//     pharmacologic adjunct for weight reduction.
//
//   SETTLED -> CONTESTED (1997): On 28 August 1997 the New England Journal of
//     Medicine published Connolly et al.'s report of valvular heart disease in
//     patients treated with fenfluramine-phentermine; weeks later (15 September
//     1997) the FDA requested withdrawal of fenfluramine and dexfenfluramine.
//     Phentermine itself was NOT withdrawn and its weight-reduction indication
//     remained FDA-approved (the valvulopathy signal was attributed to the
//     fenfluramine component), but the episode threw phentermine-based combination
//     weight-loss therapy into active contestation and permanently reshaped how the
//     drug is prescribed and labeled — reinforcing its short-term-monotherapy scope.
//
// Only high-confidence, canonical URLs (NEJM DOI + Wikipedia verification surface,
// the same surface used by scripts/seed-human-history-trajectories.ts and the
// benzonatate enrichment) are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-phentermine-hydrochloride-weight-loss.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-phentermine-hydrochloride-weight-loss.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyl6oc91w0plo7qykn7wjh'

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

// Do NOT duplicate the existing null -> RECORDED first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '1992-01-01',
    datePrecision: 'YEAR',
    reason:
      "Phentermine, FDA-approved as an anorectic in 1959, was for decades only a modestly used short-term appetite suppressant. That changed after Michael Weintraub's multi-year National Heart, Lung, and Blood Institute-funded trial, reported in 1992, showed sustained weight loss from combining phentermine with fenfluramine. The resulting 'fen-phen' phenomenon drove prescriptions into the millions per year by the mid-1990s, settling phentermine as the standard, broadly adopted pharmacologic adjunct for weight reduction in the management of obesity.",
    source: {
      externalId: 'src:phentermine-fenphen-adoption',
      name:
        'Fen-phen (fenfluramine/phentermine) — combination weight-loss therapy popularized by Weintraub\'s 1992 trial; phentermine became the most widely prescribed anti-obesity drug in the United States (drug reference summary).',
      url: 'https://en.wikipedia.org/wiki/Fen-phen',
      publishedAt: '1992-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1997-08-28',
    datePrecision: 'DAY',
    reason:
      "On 28 August 1997 the New England Journal of Medicine published Connolly and colleagues' report of valvular heart disease in 24 women treated with fenfluramine-phentermine, and on 15 September 1997 the FDA requested withdrawal of fenfluramine and dexfenfluramine from the market. Phentermine itself was not withdrawn and its short-term weight-reduction indication remained FDA-approved, with the valvulopathy signal attributed to the fenfluramine component. Nonetheless the episode moved phentermine-based combination weight-loss therapy from settled practice into active contestation, permanently reshaping how the drug is prescribed and labeled and reinforcing its restriction to short-term monotherapy.",
    source: {
      externalId: 'src:phentermine-connolly-valvulopathy-1997',
      name:
        'Connolly HM, Crary JL, McGoon MD, et al. Valvular Heart Disease Associated with Fenfluramine-Phentermine. N Engl J Med. 1997;337(9):581-588.',
      url: 'https://doi.org/10.1056/NEJM199708283370901',
      publishedAt: '1997-08-28',
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
