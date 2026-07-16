// Enrichment: epistemic trajectory for Deb, Agrawal, Pratap & Meyarivan (2000),
// "A Fast Elitist Non-dominated Sorting Genetic Algorithm for Multi-objective
// Optimization: NSGA-II," in Parallel Problem Solving from Nature — PPSN VI,
// LNCS 1917, pp. 849-858.
// DOI: 10.1007/3-540-45356-3_83 · OpenAlex: W2167159964
//
// Identity verified via Crossref: title "A Fast Elitist Non-dominated Sorting
// Genetic Algorithm for Multi-objective Optimization: NSGA-II", Springer
// (PPSN VI, LNCS), pp. 849-858, authors Deb, Agrawal, Pratap, Meyarivan, issued
// 2000. NOT retracted: Crossref carries no `update-to`, OpenAlex isRetracted=
// false, and no expression of concern was found. NSGA-II's core contribution —
// a fast (O(MN^2)) elitist non-dominated-sorting GA with crowding-distance
// diversity preservation for multi-objective optimization — was never
// overturned, contested, or failed to replicate.
//
// It was instead vindicated and cemented as a canonical, state-of-the-art
// method by the expert literature. The definitive statement of the algorithm
// is the authors' own peer-reviewed journal version — Deb, Pratap, Agarwal,
// Meyarivan, "A fast and elitist multiobjective genetic algorithm: NSGA-II,"
// IEEE Transactions on Evolutionary Computation 6(2):182-197 (April 2002),
// DOI 10.1109/4235.996017 (42,000+ citations) — but as a same-author expansion
// that is elaboration, not independent adjudication.
//
// The independent field-consensus anchor used here for SETTLED is a
// third-party survey of the state of the art:
//
//   Zhou A, Qu B-Y, Li H, Zhao S-Z, Suganthan PN, Zhang Q, "Multiobjective
//   evolutionary algorithms: A survey of the state of the art," Swarm and
//   Evolutionary Computation 1(1):32-49 (March 2011), DOI
//   10.1016/j.swevo.2011.03.001. This independent review (310 references,
//   1,900+ citations) treats NSGA-II as one of the small set of canonical,
//   standard MOEAs against which the field benchmarks, ratifying it as
//   settled state-of-the-art practice in the expert literature.
//
// The claim already carries its baseline null -> RECORDED first entry
// (publication, 2000-01-01). This script adds the single downstream arc:
//   RECORDED -> SETTLED (2011-03): an independent state-of-the-art survey
//     ratifies NSGA-II as a canonical MOEA. Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-deb-2000-nsga-ii-multiobjective.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-deb-2000-nsga-ii-multiobjective.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w5n0z00zxsa8hytcgsvj3'

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
    occurredAt: '2011-03-01',
    datePrecision: 'MONTH',
    reason:
      "NSGA-II's fast elitist non-dominated-sorting GA with crowding-distance diversity preservation was never retracted, contested, or failed to replicate; it was ratified as canonical state-of-the-art practice. Its definitive peer-reviewed statement is the authors' own journal version (IEEE Trans. Evol. Comput. 6(2):182-197, April 2002, DOI 10.1109/4235.996017, 42,000+ citations), but that is a same-author elaboration. The independent adjudication anchor is Zhou, Qu, Li, Zhao, Suganthan & Zhang, 'Multiobjective evolutionary algorithms: A survey of the state of the art,' Swarm and Evolutionary Computation 1(1):32-49 (March 2011), which treats NSGA-II as one of the standard, benchmark MOEAs, settling it in the expert literature.",
    source: {
      externalId: 'src:zhou-2011-moea-survey-state-of-the-art',
      name:
        'Zhou A, Qu B-Y, Li H, Zhao S-Z, Suganthan PN, Zhang Q. "Multiobjective evolutionary algorithms: A survey of the state of the art." Swarm and Evolutionary Computation 1(1):32-49 (March 2011). DOI: 10.1016/j.swevo.2011.03.001.',
      url: 'https://doi.org/10.1016/j.swevo.2011.03.001',
      publishedAt: '2011-03-01',
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
