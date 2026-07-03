// Enrichment: epistemic trajectory for the U.S. Senate's confirmation of
// Kevin Warsh, of Florida, to be Chairman of the Board of Governors of the
// Federal Reserve System (119th Congress, Senate Roll Call 776, 2026-05-12).
//
// This claim records a Senate nomination vote drawn from Voteview
// (ingestedBy: voteview_v1). A presidential nomination follows the arc:
//   OPEN      — the President transmits the nomination to the Senate
//   RECORDED  — the nomination is referred to the Committee on Banking,
//               Housing, and Urban Affairs and is pending
//   SETTLED   — the full Senate votes to confirm (advice and consent given)
//
// The confirmation of a nominee requires no presidential signature (the
// President is the nominating party), so a successful confirmation vote is the
// terminal SETTLED state for the appointment. On 2026-05-12 the Senate agreed
// to confirm Warsh as Chairman by 51-45 (Roll Call 776), immediately following
// the companion vote confirming him as a Member of the Board (Roll Call 775).
//
// The claim already carries its introduction/referral (null -> RECORDED) first
// entry. This script adds the single downstream arc:
//   RECORDED -> SETTLED (2026-05-12): Senate confirms, 51-45.
//
// Community: INSTITUTIONAL (Senate advice-and-consent action).
//
// Source note: web access was unavailable at authoring time, so the citation
// URL was NOT HTTP-verified. It is the Voteview permalink for this roll call,
// derived deterministically from the claim's own fields (chamber=Senate,
// congress=119, rollnumber=776 -> RS1190776) — the same source (voteview_v1)
// that ingested the claim — rather than a recalled Congress.gov PN identifier
// or a Senate.gov session-relative vote number, neither of which could be
// verified.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-voteview_v1-warsh-fed-chairman-confirmation.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-voteview_v1-warsh-fed-chairman-confirmation.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq5l1vsr79t5sal8sqrfjwa9'

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

// Do NOT duplicate the existing null -> RECORDED (nomination referral) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2026-05-12',
    datePrecision: 'DAY',
    reason:
      'On 12 May 2026 the United States Senate, exercising its advice-and-consent power, agreed to confirm the nomination of Kevin Warsh, of Florida, to be Chairman of the Board of Governors of the Federal Reserve System by a recorded vote of 51 Yeas to 45 Nays (119th Congress, Senate Roll Call 776). The vote immediately followed the companion roll call (No. 775, also 51-45) confirming Warsh as a Member of the Board of Governors, the seat that makes the chairmanship possible. Because a confirmation requires no presidential signature — the President is the nominating party — the successful confirmation vote is the terminal SETTLED state for the appointment: the Senate gave its consent and Warsh became Chairman-designate of the Federal Reserve.',
    source: {
      externalId: 'src:voteview-rs1190776-warsh-fed-chairman-confirm-2026-05-12',
      name:
        'U.S. Senate Roll Call Vote 776, 119th Congress — On the nomination: Kevin Warsh, of Florida, to be Chairman of the Board of Governors of the Federal Reserve System. Confirmed 51-45, 12 May 2026. Voteview (Lewis et al.), rollcall RS1190776.',
      url: 'https://voteview.com/rollcall/RS1190776',
      publishedAt: '2026-05-12',
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
        ingestedBy: 'enrich:voteview_v1',
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
