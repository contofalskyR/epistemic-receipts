// Enrichment: epistemic trajectory for Folkman, S. & Lazarus, R. S. (1980),
// "An Analysis of Coping in a Middle-Aged Community Sample,"
// Journal of Health and Social Behavior, 21(3), 219-239.
// DOI 10.2307/2136617 · OpenAlex W2313987504.
//
// This study of 100 community-residing men and women (aged 45-64), grounded in
// Lazarus's cognitive-phenomenological theory of psychological stress, introduced
// the 68-item Ways of Coping Checklist and its problem-focused/emotion-focused
// coping distinction. It became one of the foundational papers of the coping
// literature (6,349 citations) and the archetype of checklist-based coping
// assessment.
//
// The claim already carries its baseline (null -> RECORDED) first entry at
// publication (1980-09). This script adds the post-publication arc:
//
//   RECORDED -> CONTESTED (1996-12): Coyne, J. C. & Gottlieb, B. H.,
//     "The Mismeasure of Coping by Checklist," Journal of Personality, 64(4),
//     959-991 (doi:10.1111/j.1467-6494.1996.tb00950.x), delivered the landmark
//     methodological critique of the checklist approach to measuring coping that
//     this 1980 study pioneered. It argued that retrospective checklist
//     instruments like the Ways of Coping are afflicted by unstable factor
//     structure, ambiguous item interpretation, and poor correspondence to actual
//     coping processes — challenging the construct validity of the paradigm the
//     paper established. The critique is widely cited and reframed the coping
//     measurement debate; it moves the finding from recorded to contested. No
//     retraction or failed-replication event exists, and the checklist-vs-process
//     debate over coping assessment remains genuinely unresolved, so the arc stops
//     at CONTESTED (no clean subsequent settling).
//
// Community: EXPERT_LITERATURE (peer-reviewed methodological critique).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-folkman-lazarus-1980-ways-of-coping-community-sample.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-folkman-lazarus-1980-ways-of-coping-community-sample.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm3nb8t195dsadnynkm3wzh'

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

// Do NOT duplicate the existing null -> RECORDED (publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1996-12-01',
    datePrecision: 'MONTH',
    reason:
      'Coyne, J. C. & Gottlieb, B. H., "The Mismeasure of Coping by Checklist," Journal of Personality 1996;64(4):959-991 (doi:10.1111/j.1467-6494.1996.tb00950.x), delivered the landmark methodological critique of the checklist approach to measuring coping that this 1980 study pioneered with the Ways of Coping Checklist. It argued that retrospective checklist instruments suffer from unstable factor structure, ambiguous item interpretation, and weak correspondence to real coping processes, challenging the construct validity of the paradigm the paper established. The widely-cited critique reframed the coping-measurement debate and moves the finding from recorded to contested; with no retraction or failed-replication event and the checklist-vs-process debate still unresolved, the arc stops at CONTESTED.',
    source: {
      externalId: 'src:coyne-gottlieb-1996-mismeasure-coping-checklist',
      name:
        'Coyne JC, Gottlieb BH. The Mismeasure of Coping by Checklist. Journal of Personality. 1996;64(4):959-991. doi:10.1111/j.1467-6494.1996.tb00950.x',
      url: 'https://doi.org/10.1111/j.1467-6494.1996.tb00950.x',
      publishedAt: '1996-12-01',
      methodologyType: 'opinion',
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
