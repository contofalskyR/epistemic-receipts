// Enrichment: epistemic trajectory for Barsalou LW, "Perceptual symbol
// systems." Behavioral and Brain Sciences. 1999;22(4):577-660.
// DOI 10.1017/s0140525x99002149. OpenAlex W2150375089.
//
// The paper advances a perceptual (modal, sensory-motor "simulation") theory
// of knowledge as a rival to amodal/symbolic accounts — the flagship statement
// of what became the "grounded cognition" program. It is a theoretical target
// article, not an empirical finding: there is no retraction, no failed
// replication, and no meta-analysis that adjudicates it. The thesis remains
// actively debated, so the honest downstream arc is a single well-documented
// contest, not a settlement or reversal.
//
// The claim already carries its baseline null -> RECORDED first entry
// (publication, 1999-08-01). This script adds the downstream arc only:
//
//   RECORDED -> CONTESTED (2008-01): Mahon BZ, Caramazza A, "A critical look
//     at the embodied cognition hypothesis and a new proposal for grounding
//     conceptual content." J Physiol Paris. 2008;102(1-3):59-70.
//     DOI 10.1016/j.jphysparis.2008.03.004. This heavily-cited critique
//     directly cites Barsalou 1999 ("Perceptual symbol systems") and argues
//     that the strong embodied/perceptual-grounding hypothesis it exemplifies
//     is untenable — that sensory-motor activation during conceptual
//     processing is equally consistent with amodal "disembodied" content plus
//     grounding-by-interaction. It is a specific, dated, citable challenge to
//     the perceptual theory of knowledge, and it opened sustained debate that
//     leaves the thesis contested (currentAxis CONTESTED), not settled.
//
// Community: EXPERT_LITERATURE (peer-reviewed theoretical critique in the
// cognitive-neuroscience literature).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-barsalou-perceptual-symbol-systems-1999.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-barsalou-perceptual-symbol-systems-1999.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxm9de00rvsa7fnb58c8cz'

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
    occurredAt: '2008-01-01',
    datePrecision: 'MONTH',
    reason:
      'In 2008 Mahon and Caramazza published "A critical look at the embodied cognition hypothesis and a new proposal for grounding conceptual content" (Journal of Physiology-Paris 102(1-3):59-70), a heavily-cited critique that directly cites and engages Barsalou 1999 "Perceptual symbol systems." They argue the strong embodied/perceptual-grounding view it exemplifies is untenable: sensory-motor activation during conceptual processing is equally compatible with amodal conceptual content plus a "grounding by interaction" account, so the neural evidence does not establish that concepts are constituted by perceptual simulations. This is a specific, dated, citable challenge that opened sustained debate and left the perceptual theory of knowledge contested rather than accepted.',
    source: {
      externalId: 'src:mahon-caramazza-2008-embodied-cognition-critique',
      name:
        'Mahon BZ, Caramazza A. "A critical look at the embodied cognition hypothesis and a new proposal for grounding conceptual content." J Physiol Paris. 2008;102(1-3):59-70. DOI 10.1016/j.jphysparis.2008.03.004. PMID 18582569.',
      url: 'https://doi.org/10.1016/j.jphysparis.2008.03.004',
      publishedAt: '2008-01-01',
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
