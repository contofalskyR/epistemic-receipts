// Enrichment: epistemic trajectory for Alberti KGMM, Zimmet P, Shaw J (2006),
// "Metabolic syndrome—a new world-wide definition. A Consensus Statement from
// the International Diabetes Federation," Diabetic Medicine 23(5):469–480.
// DOI: 10.1111/j.1464-5491.2006.01858.x · OpenAlex: W2130717716
//
// The IDF consensus set out to establish a single unified, clinically convenient
// diagnostic tool for the metabolic syndrome usable world-wide so data from
// different countries could be compared. Its distinguishing feature was making
// central obesity (ethnic-specific waist-circumference cutoffs) a MANDATORY
// criterion — which diverged from the AHA/NHLBI (updated ATP III) definition,
// where central obesity is one of five equal criteria. This left the field with
// competing "metabolic syndrome" definitions, undermining the comparability aim.
//
// The claim already carries its publication (null -> RECORDED, 2006-04-20) first
// entry. This script adds the single downstream adjudicating arc:
//   RECORDED -> SETTLED (2009-10-20): The Joint Interim Statement "Harmonizing
//     the Metabolic Syndrome" (Circulation 120:1640–1645), co-authored by the
//     IDF Task Force on Epidemiology and Prevention together with the NHLBI, the
//     American Heart Association, the World Heart Federation, the International
//     Atherosclerosis Society, and the International Association for the Study of
//     Obesity, produced ONE agreed definition. It preserved the IDF's
//     ethnic-/population-specific waist thresholds but revised the mandatory
//     central-obesity rule to "any 3 of 5" equal criteria, reconciling the IDF
//     and AHA/NHLBI definitions. This multi-institution consensus fulfilled the
//     2006 paper's stated aim of a single, comparable world-wide diagnostic tool.
//     There was no clean, dated intervening contest document post-2006, so this
//     is recorded as a direct RECORDED -> SETTLED.
//
// Community: INSTITUTIONAL (joint interim statement of six diabetes/cardiology
// organizations — a guideline-tier consensus, not a single research group).
//
// No retraction, expression of concern, or failed replication exists.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-metabolic-syndrome-idf-worldwide-definition-2006.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-metabolic-syndrome-idf-worldwide-definition-2006.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplygckh05w9saihp6nbtr49'

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

// Do NOT duplicate the existing null -> RECORDED (publication, 2006-04-20) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2009-10-20',
    datePrecision: 'DAY',
    reason:
      "The 2009 Joint Interim Statement 'Harmonizing the Metabolic Syndrome' (Circulation 120:1640–1645) — issued jointly by the IDF Task Force on Epidemiology and Prevention, the NHLBI, the American Heart Association, the World Heart Federation, the International Atherosclerosis Society, and the International Association for the Study of Obesity — reconciled the competing IDF and AHA/NHLBI definitions into a single agreed diagnostic standard. It preserved the IDF's ethnic-/population-specific waist-circumference thresholds while revising the mandatory central-obesity rule to 'any 3 of 5' equal criteria. This six-organization consensus fulfilled the 2006 IDF paper's stated aim of a unified, world-wide, comparable diagnostic tool for the metabolic syndrome.",
    source: {
      externalId: 'src:harmonizing-metabolic-syndrome-2009',
      name:
        'Alberti KGMM, Eckel RH, Grundy SM, Zimmet PZ, Cleeman JI, Donato KA, et al. Harmonizing the Metabolic Syndrome: A Joint Interim Statement of the IDF Task Force on Epidemiology and Prevention; NHLBI; AHA; World Heart Federation; International Atherosclerosis Society; and International Association for the Study of Obesity. Circulation 2009;120(16):1640–1645.',
      url: 'https://doi.org/10.1161/CIRCULATIONAHA.109.192644',
      publishedAt: '2009-10-20',
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
