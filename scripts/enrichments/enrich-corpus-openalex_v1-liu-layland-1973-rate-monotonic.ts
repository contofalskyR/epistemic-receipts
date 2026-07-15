// Enrichment: epistemic trajectory for Liu & Layland (1973),
// "Scheduling Algorithms for Multiprogramming in a Hard-Real-Time Environment,"
// Journal of the ACM 20(1). DOI 10.1145/321738.321743. OpenAlex W2109488193.
//
// This paper established two foundational results of real-time scheduling
// theory: (1) an optimal fixed-priority scheduler (rate-monotonic) has a
// least-upper-bound processor utilization of ln 2 (~69%, "as low as 70
// percent") for large task sets, and (2) full (100%) utilization is
// achievable by dynamically assigning priorities on current deadlines
// (earliest-deadline-first). These are mathematical theorems, not empirical
// claims — so there is no retraction, expression of concern, or failed
// replication to record. The correct post-publication arc is vindication:
// the results were never contested and became canonical.
//
// Subsequent expert literature refined the analysis without overturning it —
// e.g., Lehoczky, Sha & Ding's 1989 "exact characterization" showing that
// average schedulable utilization runs ~88% and that exact (necessary-and-
// sufficient) tests admit far higher loads than the sufficient ln 2 bound.
// The 2004 Real-Time Systems retrospective "Real Time Scheduling Theory: A
// Historical Perspective" (Sha, Abdelzaher, Årzén, et al.) adjudicates the
// 1973 results as the historical foundation of the field.
//
// The claim already has its baseline (null -> RECORDED) first entry at the
// 1973 publication date. This script adds the single downstream arc:
//   RECORDED -> SETTLED (2004-11): canonized as foundational by the field's
//   own historical-perspective review; community EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-liu-layland-1973-rate-monotonic.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-liu-layland-1973-rate-monotonic.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w4rlp00h3sa8hnev2m7in'

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

// Do NOT duplicate the existing null -> RECORDED (1973 publication) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-11-01',
    datePrecision: 'MONTH',
    reason:
      "Liu & Layland's rate-monotonic least-upper-bound utilization (ln 2 ~ 69%) and the optimality of earliest-deadline-first were proved as theorems and were never retracted or contested; later work (e.g., Lehoczky, Sha & Ding's 1989 exact characterization) refined the schedulability analysis without overturning them. In November 2004 the field's own retrospective review 'Real Time Scheduling Theory: A Historical Perspective' (Sha, Abdelzaher, Årzén, et al.) in Real-Time Systems adjudicated the 1973 paper as the historical foundation of real-time scheduling theory, marking expert-literature consensus that the finding is SETTLED (vindicated).",
    source: {
      externalId: 'src:sha-2004-real-time-scheduling-historical-perspective',
      name:
        'Lui Sha, Tarek Abdelzaher, Karl-Erik Årzén, et al., "Real Time Scheduling Theory: A Historical Perspective," Real-Time Systems 28(2–3):101–155 (Nov 2004). A retrospective review that canonizes Liu & Layland (1973) rate-monotonic and EDF results as the foundation of the field.',
      url: 'https://doi.org/10.1023/b:time.0000045315.61234.1e',
      publishedAt: '2004-11-01',
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
