// Enrichment: epistemic trajectory for Amin MB, Greene FL, Edge SB, et al. (2017),
// "The Eighth Edition AJCC Cancer Staging Manual: Continuing to build a bridge from
// a population-based to a more 'personalized' approach to cancer staging,"
// CA: A Cancer Journal for Clinicians 67(2):93–99.
// DOI: 10.3322/caac.21388 · PubMed: 28094848 · OpenAlex: W2573152477
//
// This is the overview/introductory article announcing the AJCC 8th edition of the
// TNM cancer staging system. The claim asserts that the AJCC staging manual /
// TNM system is the benchmark standardized classification system for cancer at
// the population level. The paper is not an empirical hypothesis test and has no
// retraction, expression of concern, or failed replication.
//
// The claim already carries its publication (null -> RECORDED, 2017-01-17) first
// entry. This script adds the single downstream adjudicating arc:
//   RECORDED -> SETTLED (2018-01-01): The AJCC Cancer Staging Manual, 8th Edition
//     became the effective, mandatory cancer staging standard in the United States
//     for all cancers diagnosed on or after January 1, 2018 — adopted by the AJCC's
//     partner/registry infrastructure (cancer registries, NCCN, ASCO, CoC-accredited
//     programs, and software vendors), after a one-year implementation delay to let
//     protocols, guidelines, and data-collection systems be updated. This formal,
//     dated institutional adoption ratifies the AJCC/TNM system as THE benchmark
//     staging standard the claim describes. There was no prior contest, so this is
//     a direct RECORDED -> SETTLED.
//
// Community: INSTITUTIONAL (formal adoption as the mandatory US staging standard).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ajcc-8th-edition-tnm-cancer-staging-2017.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ajcc-8th-edition-tnm-cancer-staging-2017.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplycwd30499saihnzkkuzgq'

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

// Do NOT duplicate the existing null -> RECORDED (publication, 2017-01-17) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-01-01',
    datePrecision: 'DAY',
    reason:
      "The AJCC Cancer Staging Manual, 8th Edition — the system this paper introduces — became the effective, mandatory cancer staging standard in the United States for all cancers diagnosed on or after January 1, 2018. Original 2017 implementation was deliberately delayed one year so that AJCC partner organizations, cancer registries, clinical guidelines (NCCN), and software vendors could develop, test, and deploy the updated protocols and data-collection systems. This formal, dated adoption across the US cancer-staging infrastructure ratifies the AJCC/TNM manual as the benchmark standardized classification system the claim describes, settling its central assertion.",
    source: {
      externalId: 'src:asco-post-2019-ajcc8-effective-2018',
      name:
        'Cavallo J. Eighth Edition of the AJCC Staging Manual Offers a More Personalized Approach to Patient Classification (A Conversation With Frederick L. Greene, MD, FACS). The ASCO Post, August 10, 2019 — confirms the 8th edition became effective January 1, 2018.',
      url: 'https://ascopost.com/issues/august-10-2019/eighth-edition-of-the-ajcc-staging-manual/',
      publishedAt: '2019-08-10',
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
