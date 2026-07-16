// Enrichment: epistemic trajectory for Bechara, Damasio, Damasio & Anderson (1994),
// "Insensitivity to future consequences following damage to human prefrontal cortex"
// (Cognition, DOI 10.1016/0010-0277(94)90018-3, OpenAlex W2170256757).
//
// This is the foundational Iowa Gambling Task (IGT) / somatic-marker paper: it
// reported that patients with ventromedial prefrontal damage keep choosing
// disadvantageous decks, and — in the broader somatic-marker reading — that
// normal participants steer toward advantageous decks BEFORE they can consciously
// articulate why. That "acting advantageously before knowing" claim is the
// contestable core.
//
// Post-publication event (verified):
//   RECORDED -> CONTESTED (2004-11-09) — Maia & McClelland, PNAS 101(45):16075–16080,
//   "A reexamination of the evidence for the somatic marker hypothesis: What
//   participants really know in the Iowa gambling task" (DOI 10.1073/pnas.0406666101).
//   Using a more sensitive knowledge questionnaire, they found participants had
//   conscious, reportable knowledge of the deck contingencies by the time their
//   behavior shifted — directly contradicting the "insensitivity / act-before-knowing"
//   interpretation. This is a specific, dated, highly cited methodological critique.
//   The claim remains CONTESTED (Bechara & Damasio's 2005 TICS reply defends the
//   original reading; no meta-analytic adjudication settles it), so no further arc
//   is added.
//
// The claim already has its baseline null -> RECORDED (publication, 1994-04-01)
// first entry — do NOT duplicate it. This script adds one downstream arc.
//
// Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bechara-1994-prefrontal-future-consequences.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bechara-1994-prefrontal-future-consequences.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm1kemq0a5jsadnf2hk6nla'

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
    occurredAt: '2004-11-09',
    datePrecision: 'DAY',
    reason:
      'Maia & McClelland (PNAS, 9 Nov 2004; 101(45):16075–16080, "A reexamination of the evidence for the somatic marker hypothesis: What participants really know in the Iowa gambling task") directly challenged the core interpretation of Bechara et al. 1994. Using a more sensitive questionnaire, they found that participants had conscious, explicitly reportable knowledge of which decks were advantageous by the time their choice behavior changed — contradicting the claim that behavior guided by "future consequences" precedes and is independent of conscious insight. The finding became actively contested in the expert literature: Bechara & Damasio replied defending the somatic-marker reading (Trends in Cognitive Sciences, 2005), leaving the interpretation genuinely disputed rather than overturned or vindicated.',
    source: {
      externalId: 'src:maia-mcclelland-2004-pnas-igt-reexamination',
      name:
        'Maia TV, McClelland JL. A reexamination of the evidence for the somatic marker hypothesis: What participants really know in the Iowa gambling task. Proceedings of the National Academy of Sciences. 2004;101(45):16075–16080.',
      url: 'https://doi.org/10.1073/pnas.0406666101',
      publishedAt: '2004-11-09',
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
