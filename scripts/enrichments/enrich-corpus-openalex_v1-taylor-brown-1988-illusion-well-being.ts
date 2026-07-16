// Enrichment: epistemic trajectory for Taylor SE, Brown JD (1988),
// "Illusion and well-being: A social psychological perspective on mental health,"
// Psychological Bulletin 103(2):193–210. DOI 10.1037/0033-2909.103.2.193.
// OpenAlex W2171975196.
//
// Taylor & Brown argued that positive illusions — overly favorable self-
// evaluations, exaggerated perceptions of control, and unrealistic optimism —
// are characteristic of normal thought and PROMOTE mental health. The claim
// already carries its baseline first entry (null -> RECORDED, publication
// 1988). This script adds the single well-documented downstream arc:
//
//   RECORDED -> CONTESTED (1994): C. Randall Colvin and Jack Block published
//     "Do positive illusions foster mental health? An examination of the
//     Taylor and Brown formulation" (Psychological Bulletin 116(1):3–20),
//     a direct, dated methodological and evidentiary critique arguing that
//     Taylor & Brown's conclusion was not adequately supported by the cited
//     evidence and conflating self-enhancement with well-being. It appeared
//     with Taylor & Brown's reply in the same issue, opening a sustained and
//     still-unresolved dispute in the personality/social-psychology literature.
//     Colvin, Block & Funder (1995, JPSP) followed with empirical evidence that
//     overly positive self-evaluations carry negative interpersonal
//     implications. The finding has remained genuinely contested rather than
//     settled or reversed.
//
// Community: EXPERT_LITERATURE.
//
// No retraction or expression of concern exists for the 1988 paper (Crossref
// update-to: None). No adjudicating meta-analysis or consensus statement
// resolves the debate, so no SETTLED/REVERSED transition is added.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-taylor-brown-1988-illusion-well-being.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-taylor-brown-1988-illusion-well-being.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxnnnq01gvsa7fs7hfptiq'

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

// Do NOT duplicate the existing null -> RECORDED (publication 1988) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1994-01-01',
    datePrecision: 'YEAR',
    reason:
      'C. Randall Colvin and Jack Block published "Do positive illusions foster mental health? An examination of the Taylor and Brown formulation" (Psychological Bulletin, 1994, 116(1):3–20), a direct methodological and evidentiary critique of Taylor & Brown (1988). They argued the claim that positive illusions promote mental health rested on selective and misinterpreted evidence and conflated self-enhancement bias with genuine well-being. The critique appeared alongside a reply from Taylor & Brown in the same issue and was reinforced empirically by Colvin, Block & Funder (1995, JPSP), which found overly positive self-evaluations carry negative interpersonal consequences. This opened a sustained and still-unresolved dispute, moving the finding from recorded to contested.',
    source: {
      externalId: 'src:colvin-block-1994-positive-illusions-critique',
      name:
        'Colvin CR, Block J. Do positive illusions foster mental health? An examination of the Taylor and Brown formulation. Psychological Bulletin 1994;116(1):3–20.',
      url: 'https://doi.org/10.1037/0033-2909.116.1.3',
      publishedAt: '1994-01-01',
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
