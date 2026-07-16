// Enrichment: epistemic trajectory for Libby P, Ridker PM, Maseri A (2002),
// "Inflammation and Atherosclerosis," Circulation 105(9):1135–1143.
// DOI 10.1161/hc0902.104353. OpenAlex W2159087408.
//
// Libby, Ridker & Maseri reframed atherosclerosis from a "bland lipid storage
// disease" into an ongoing inflammatory process, positing that inflammation
// mediates every stage from initiation to thrombotic complication. The claim
// already carries its baseline first entry (null -> RECORDED, publication
// 2002-03-05). This script adds the single, well-documented downstream arc:
//
//   RECORDED -> SETTLED (2017-08-27): The CANTOS trial (Ridker PM et al.,
//     "Antiinflammatory Therapy with Canakinumab for Atherosclerotic Disease,"
//     N Engl J Med 2017;377:1119–1131, epub 2017-08-27) randomized 10,061
//     post-MI patients with elevated hsCRP to canakinumab (an anti-IL-1β
//     monoclonal antibody) or placebo. Canakinumab reduced recurrent
//     cardiovascular events WITHOUT lowering lipid levels — the first
//     prospective randomized proof that targeting inflammation alone reduces
//     atherothrombotic risk, converting the previously "unproved" inflammatory
//     hypothesis into an established, therapeutically actionable one. The
//     accompanying expert literature explicitly recognized this (e.g. Weber &
//     von Hundelshausen, "CANTOS Trial Validates the Inflammatory Pathogenesis
//     of Atherosclerosis," Circ Res 2017;121:1119–1121).
//
// Community: EXPERT_LITERATURE.
//
// No retraction or expression of concern exists for the 2002 paper. No specific
// dated pre-CANTOS methodological critique moved the finding to CONTESTED; the
// hypothesis was "unproved" (open/unsettled) rather than formally contested,
// so no CONTESTED transition is added — a single verified arc is preferred.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-libby-ridker-maseri-2002-inflammation-atherosclerosis.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-libby-ridker-maseri-2002-inflammation-atherosclerosis.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply6srx01c9saihv3ezunab'

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

// Do NOT duplicate the existing null -> RECORDED (publication 2002-03-05) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2017-08-27',
    datePrecision: 'DAY',
    reason:
      'The CANTOS trial (Ridker PM et al., "Antiinflammatory Therapy with Canakinumab for Atherosclerotic Disease," N Engl J Med 2017;377:1119–1131, published online 2017-08-27) randomized 10,061 post-myocardial-infarction patients with hsCRP >=2 mg/L to canakinumab (anti-IL-1beta antibody) or placebo. Canakinumab significantly reduced recurrent major cardiovascular events without lowering lipid levels — the first randomized proof that reducing inflammation per se cuts atherothrombotic risk, adjudicating the inflammatory hypothesis of atherosclerosis advanced by Libby, Ridker & Maseri (2002) from unproved to established. Contemporary expert commentary described the result as validating the inflammatory pathogenesis of atherosclerosis.',
    source: {
      externalId: 'src:cantos-canakinumab-2017',
      name:
        'Ridker PM, Everett BM, Thuren T, et al. Antiinflammatory Therapy with Canakinumab for Atherosclerotic Disease (CANTOS). New England Journal of Medicine 2017;377(12):1119–1131.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28845751/',
      publishedAt: '2017-08-27',
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
