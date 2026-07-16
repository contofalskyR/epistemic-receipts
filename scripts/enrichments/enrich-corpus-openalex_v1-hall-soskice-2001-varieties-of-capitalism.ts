// Enrichment: post-publication epistemic trajectory for
// Hall & Soskice, "Varieties of Capitalism: The Institutional Foundations of
// Comparative Advantage" (Oxford University Press, 2001).
//
// Claim ID:    cmplzwtk403qjsa86kp83kadd
// DOI:         https://doi.org/10.2307/30040740 (JSTOR / Academy of Management Review index record)
// OpenAlex:    W3125715642
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 2003-07-01
// publication date recorded in the corpus) already exists; this script does NOT
// duplicate it. It adds the single verified post-publication transition:
//
//   RECORDED -> CONTESTED (2007-05-17): "Beyond Varieties of Capitalism"
//   (Hancke, Rhodes & Thatcher, eds., OUP) formally contested the adequacy of the
//   static LME/CME dichotomy and pushed the field to revise the framework.
//
// No retraction or expression of concern exists (theoretical political-economy
// monograph). The framework remains genuinely contested in the comparative
// political economy literature, so no SETTLED transition is asserted.
//
// Idempotent: upserts on source externalId and claimStatusHistory id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hall-soskice-2001-varieties-of-capitalism.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplzwtk403qjsa86kp83kadd'

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
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-05-17',
    datePrecision: 'DAY',
    reason:
      'The edited volume "Beyond Varieties of Capitalism" (Bob Hancke, Martin Rhodes & Mark Thatcher, eds., Oxford University Press, 2007) subjected the Hall-Soskice framework to a sustained methodological critique, arguing that its static two-type Liberal/Coordinated Market Economy dichotomy could not accommodate mixed market economies, institutional change over time, or the role of the state, and calling for the framework to be revised and extended. It became a central reference for the contest over whether the original typology adequately explains national differences in economic organization.',
    source: {
      externalId: 'src:beyond-varieties-of-capitalism-hancke-2007',
      name: 'Hancke B, Rhodes M, Thatcher M, eds. Beyond Varieties of Capitalism: Conflict, Contradictions, and Complementarities in the European Economy. Oxford: Oxford University Press, 2007.',
      url: 'https://doi.org/10.1093/acprof:oso/9780199206483.001.0001',
      publishedAt: '2007-05-17',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  // Confirm the target claim exists; never create a new Claim.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-hall-soskice-2001',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`Upserted transition ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
