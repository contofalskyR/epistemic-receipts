// Enrichment: epistemic trajectory for Kahneman & Tversky, "Choices, Values,
// and Frames" (2013 reprint in the World Scientific "Handbook of the
// Fundamentals of Financial Decision Making"; DOI 10.1142/9789814417358_0016;
// OpenAlex W2061592058). The paper articulates prospect theory's central
// claims: the psychophysics of value induce risk aversion for gains and risk
// seeking for losses; the psychophysics of chance overweight certainty and rare
// events; and preferences reverse under alternative framings, violating the
// invariance criterion of rational choice.
//
// The claim already carries its baseline (null -> RECORDED) first entry at the
// 2013-07 reprint publication date. This script adds the single downstream arc:
//
//   RECORDED -> SETTLED (2020-05-18): Ruggeri et al., "Replicating patterns of
//     prospect theory for decision under risk" (Nature Human Behaviour), a
//     pre-registered replication across 19 countries and 13 languages
//     (~4,000 participants), reproduced the core prospect-theory patterns —
//     risk aversion in the domain of gains, risk seeking in the domain of
//     losses, and nonlinear probability weighting — confirming the finding
//     across diverse populations amid the wider replication-crisis scrutiny of
//     behavioral results. This large multinational adjudication settles the
//     claim's empirical core. No retraction or expression of concern exists.
//
// Community: EXPERT_LITERATURE (peer-reviewed multinational replication).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kahneman-tversky-choices-values-frames-prospect-theory.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kahneman-tversky-choices-values-frames-prospect-theory.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm1urwe0ezvsadnrsuwic8e'

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

// Do NOT duplicate the existing null -> RECORDED (baseline) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-05-18',
    datePrecision: 'DAY',
    reason:
      'Ruggeri et al., "Replicating patterns of prospect theory for decision under risk" (Nature Human Behaviour, 18 May 2020), reported a pre-registered replication across 19 countries and 13 languages (~4,000 participants) that reproduced the paper\'s central prospect-theory patterns: risk aversion in the domain of gains, risk seeking in the domain of losses, and the nonlinear weighting of probabilities. Conducted during the wider replication-crisis re-examination of behavioral findings, this large multinational confirmation vindicates the claim\'s empirical core across diverse populations, settling it in the expert literature. No retraction or expression of concern exists for the original paper.',
    source: {
      externalId: 'src:ruggeri-2020-prospect-theory-replication-nhb',
      name:
        'Ruggeri K, Alí S, Berge ML, et al. Replicating patterns of prospect theory for decision under risk. Nature Human Behaviour 2020;4:622–633.',
      url: 'https://doi.org/10.1038/s41562-020-0886-x',
      publishedAt: '2020-05-18',
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
        ingestedBy: 'enrich:openalex_v1',
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
