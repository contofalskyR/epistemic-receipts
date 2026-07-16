// Enrichment: epistemic trajectory for Westerling, Hidalgo, Cayan & Swetnam
// (2006), "Warming and Earlier Spring Increase Western U.S. Forest Wildfire
// Activity," Science 313(5789):940-943.
// DOI: 10.1126/science.1128834 · OpenAlex: W2165977355
//
// Identity verified via Crossref: title "Warming and Earlier Spring Increase
// Western U.S. Forest Wildfire Activity", container "Science", authors
// Westerling, Hidalgo, Cayan, Swetnam, issued 2006 (Science online 6 July 2006;
// print 18 Aug 2006). NOT retracted: Crossref carries no `update-to`, OpenAlex
// isRetracted=false, and no expression of concern was found. The paper's core
// finding — that a warming climate and earlier spring snowmelt, rather than
// 19th/20th-century land-use history alone, drove the increase in western US
// forest wildfire — was never overturned.
//
// It was instead independently adjudicated and CONFIRMED by a subsequent formal
// attribution study:
//
//   Abatzoglou JT, Williams AP, "Impact of anthropogenic climate change on
//   wildfire across western US forests," PNAS 113(42):11770-11775 (online
//   10 Oct 2016). DOI: 10.1073/pnas.1607171113. Using multiple independent
//   measures of fuel aridity, this study attributed roughly a doubling of
//   cumulative western US forest fire area over 1984-2015 to anthropogenic
//   climate change, directly quantifying and confirming the climate-driven
//   mechanism that Westerling et al. (2006) had documented. This vindication
//   in the expert literature (also reflected in IPCC AR5/AR6 assessments)
//   settled the finding.
//
// The claim already carries its baseline null -> RECORDED first entry
// (publication, 2006-07-06). This script adds the single downstream arc:
//   RECORDED -> SETTLED (2016-10-10): an independent attribution study confirms
//     the climate-driven western-US wildfire finding.
// Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-westerling-2006-warming-spring-western-wildfire.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-westerling-2006-warming-spring-western-wildfire.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w5nat0103sa8harqr9piu'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-10-10',
    datePrecision: 'DAY',
    reason:
      "Westerling et al.'s finding that a warming climate and earlier spring snowmelt — not 19th/20th-century land-use history alone — drove the increase in western US forest wildfire was independently adjudicated and confirmed by Abatzoglou & Williams, 'Impact of anthropogenic climate change on wildfire across western US forests,' PNAS (online 10 Oct 2016). Using multiple independent fuel-aridity metrics, that attribution study concluded anthropogenic climate change roughly doubled cumulative western US forest fire area over 1984-2015, quantifying and vindicating the climate-driven mechanism documented in 2006. The paper was never retracted or subject to an expression of concern.",
    source: {
      externalId: 'src:abatzoglou-williams-2016-anthropogenic-climate-change-western-wildfire',
      name:
        'Abatzoglou JT, Williams AP. "Impact of anthropogenic climate change on wildfire across western US forests." Proceedings of the National Academy of Sciences 113(42):11770-11775 (online 10 October 2016). DOI: 10.1073/pnas.1607171113.',
      url: 'https://doi.org/10.1073/pnas.1607171113',
      publishedAt: '2016-10-10',
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
