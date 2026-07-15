// Enrichment: epistemic trajectory for the IPCC Fourth Assessment Report,
// Working Group I: "Climate Change 2007: The Physical Science Basis"
// (Cambridge University Press, 2007). OpenAlex W2939474406. No DOI.
//
// This is the physical-science volume of IPCC AR4. Its central assessed
// finding was the attribution statement that "most of the observed increase
// in global average temperatures since the mid-20th century is very likely
// [>90%] due to the observed increase in anthropogenic greenhouse gas
// concentrations."
//
// Post-publication trajectory:
//   - No retraction, expression of concern, or erratum exists for the WG1
//     physical-science volume. (The well-publicised 2010 "Himalayan glaciers
//     2035" error was in the WG2 impacts volume, not WG1; the WG1 attribution
//     science was upheld by every subsequent independent review.)
//   - The finding was not overturned but reaffirmed and STRENGTHENED by the
//     IPCC's own successor assessment. AR5 WG1 (2013) raised the attribution
//     confidence from "very likely" (>90%) to "extremely likely" (>95%) that
//     human influence has been the dominant cause of observed warming since
//     the mid-20th century; AR6 WG1 (2021) went further, stating it is
//     "unequivocal" that human influence has warmed the atmosphere, ocean and
//     land. This is institutional field-consensus vindication, not a contest.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 2007 publication). This script adds the single downstream arc:
//   RECORDED -> SETTLED (2013-09-27): the IPCC AR5 WG1 assessment ("Climate
//     Change 2013: The Physical Science Basis"), whose Summary for Policymakers
//     was approved at the IPCC 36th Session in Stockholm on 27 Sep 2013,
//     reaffirms and strengthens the AR4 attribution conclusion by consensus of
//     the same institutional body. Community: INSTITUTIONAL.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ipcc-ar4-wg1-2007-physical-science-basis.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ipcc-ar4-wg1-2007-physical-science-basis.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w43n6002lsa8hjdm9hr5e'

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

// Do NOT duplicate the existing null -> RECORDED (2007 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-09-27',
    datePrecision: 'DAY',
    reason:
      'IPCC AR5 Working Group I, "Climate Change 2013: The Physical Science Basis," is the successor assessment to this AR4 WG1 volume. Its Summary for Policymakers was approved by consensus at the IPCC 36th Session in Stockholm on 27 September 2013. AR5 WG1 reaffirmed and strengthened the AR4 attribution finding, raising the confidence that human influence has been the dominant cause of observed warming since the mid-20th century from "very likely" (>90%) in AR4 to "extremely likely" (>95%). Because the same institutional body re-adjudicated and upheld the finding rather than resolving a genuine dispute, this settles the AR4 claim by field consensus.',
    source: {
      externalId: 'src:ipcc-ar5-wg1-2013-physical-science-basis',
      name:
        'IPCC, 2013: Climate Change 2013: The Physical Science Basis. Contribution of Working Group I to the Fifth Assessment Report of the Intergovernmental Panel on Climate Change. Cambridge University Press. Summary for Policymakers approved 27 September 2013, Stockholm.',
      url: 'https://www.ipcc.ch/report/ar5/wg1/',
      publishedAt: '2013-09-27',
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
