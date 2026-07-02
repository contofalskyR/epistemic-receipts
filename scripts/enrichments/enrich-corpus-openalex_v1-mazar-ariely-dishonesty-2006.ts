// Enrichment: epistemic trajectory for Mazar & Ariely (2006),
// "Dishonesty in Everyday Life and Its Policy Implications,"
// Journal of Public Policy & Marketing 25(1):117–126. DOI 10.1509/jppm.25.1.117
//
// This review proposes a general model of (dis)honesty in which behavior is
// governed not only by external payoffs but by internal psychological reward
// mechanisms (self-concept maintenance), and draws policy implications such as
// "moral reminders" (e.g., honor codes, signing/attention to ethics) to curb
// cheating.
//
// The claim already has its OPEN/null -> RECORDED first entry. This script adds
// the downstream arc:
//   RECORDED -> CONTESTED (2018): a large multi-lab Registered Replication Report
//     found no effect of the flagship "moral reminder" manipulation (recalling the
//     Ten Commandments) on cheating — the empirical core of the self-concept model.
//   CONTESTED -> REVERSED (2021): the foundational "sign-at-the-top" field
//     experiment supporting the review's headline policy prescription was retracted
//     after evidence of data fabrication; a same-authors self-replication (Kristal
//     et al., PNAS 2020) had already failed to reproduce the effect.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mazar-ariely-dishonesty-2006.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mazar-ariely-dishonesty-2006.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm1escg0sezsa86rek1khg0'

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

// Do NOT duplicate the existing null -> RECORDED first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-09-01',
    datePrecision: 'MONTH',
    reason:
      'A large, preregistered, multi-laboratory Registered Replication Report (Verschuere et al., 2018) directly tested the empirical linchpin of the self-concept-maintenance model that this review advances — the finding that a "moral reminder" (asking people to recall the Ten Commandments) reduces cheating (Mazar, Amir & Ariely, 2008). Across 25 labs and ~5,700 participants the moral-reminder manipulation produced essentially no reduction in dishonesty, contesting the central mechanism and the policy prescription (moral reminders / honor codes) that the review proposes for curbing dishonesty.',
    source: {
      externalId: 'src:verschuere-rrr-mazar-2018',
      name:
        'Verschuere B, et al. Registered Replication Report on Mazar, Amir, and Ariely (2008). Advances in Methods and Practices in Psychological Science, 2018;1(3):299–317.',
      url: 'https://doi.org/10.1177/2515245918781032',
      publishedAt: '2018-09-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2021-09-13',
    datePrecision: 'DAY',
    reason:
      'The headline policy application of this research program — that prompting an honesty signature at the top rather than the bottom of a form makes ethics salient and reduces dishonesty (Shu, Mazar, Gino, Ariely & Bazerman, PNAS 2012) — collapsed. A same-authors replication attempt (Kristal et al., PNAS, March 2020) failed to reproduce the sign-at-the-beginning effect, and in 2021 Data Colada documented that the original field experiment’s data had been fabricated; PNAS retracted the 2012 paper on 13 September 2021. The flagship empirical support for the review’s "moral reminders curb dishonesty" prescription was thereby reversed on grounds of non-replication and data fabrication.',
    source: {
      externalId: 'src:shu-2012-retraction-pnas',
      name:
        'Shu LL, Mazar N, Gino F, Ariely D, Bazerman MH. Signing at the beginning makes ethics salient and decreases dishonest self-reports in comparison to signing at the end. PNAS 2012;109(38):15197–15200 — RETRACTED 13 Sep 2021.',
      url: 'https://doi.org/10.1073/pnas.1209746109',
      publishedAt: '2021-09-13',
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
