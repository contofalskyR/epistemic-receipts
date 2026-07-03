// Enrichment: epistemic trajectory for H.Res. 1275 (119th Congress),
// a special rule reported by the House Committee on Rules "Providing for
// consideration" of H.R. 5625 (cashless-bail list), H.R. 6260 (bail-posting
// fraud), H.R. 8365 (conditions on court-appointed monitors), H. Con. Res. 96
// (support for law enforcement officers), and H.R. 8469 (FY2027 Military
// Construction–VA appropriations). Sponsored by Rep. H. Morgan Griffith [R-VA-9].
//
// A special rule is a simple House resolution (H.Res.): it requires only
// agreement by the House itself — no Senate concurrence and no presidential
// signature. Its terminal successful state is therefore reached the moment the
// House adopts it, at which point the rule governs floor consideration of the
// listed measures.
//
// The claim already has its introduction/report (null -> RECORDED) first entry.
// This script adds the single downstream arc:
//   RECORDED -> SETTLED (2026-05-13): the House adopted H.Res. 1275. The final
//     recorded action — "Motion to reconsider laid on the table Agreed to
//     without objection" — is the standard House journal language logged
//     immediately after a resolution is agreed to, foreclosing reconsideration
//     and confirming final House action on the rule.
//
// Community: INSTITUTIONAL (congressional action).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hres-1275-cashless-bail-milcon-va-rule.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hres-1275-cashless-bail-milcon-va-rule.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpzp363e07c1sav27ii79sps'

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

// Do NOT duplicate the existing null -> RECORDED (introduction/report) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2026-05-13',
    datePrecision: 'DAY',
    reason:
      'The House of Representatives adopted H.Res. 1275, agreeing to the special rule reported by the Committee on Rules that structured floor consideration of H.R. 5625, H.R. 6260, H.R. 8365, H. Con. Res. 96, and the FY2027 Military Construction–VA appropriations bill (H.R. 8469). The final recorded action — "Motion to reconsider laid on the table Agreed to without objection" — is the standard House journal entry logged immediately after a resolution is agreed to, foreclosing reconsideration. Because a special rule is a simple House resolution requiring neither Senate concurrence nor presidential signature, House adoption is its terminal successful state: the rule took effect as an act of the House and governed consideration of the listed measures, settling the resolution.',
    source: {
      externalId: 'src:congress-hres-1275-119-agreed-2026-05-13',
      name:
        'H.Res. 1275 — 119th Congress (2025–2026), All Actions. U.S. Congress via Congress.gov. Rule agreed to in House; motion to reconsider laid on the table, 13 May 2026.',
      url: 'https://www.congress.gov/bill/119th-congress/house-resolution/1275/all-actions',
      publishedAt: '2026-05-13',
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
        ingestedBy: 'enrich:congress_bills_tracker_v1',
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
