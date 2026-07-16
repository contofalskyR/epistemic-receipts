// Enrichment: epistemic trajectory for Trope, Y., & Liberman, N. (2010),
// "Construal-Level Theory of Psychological Distance," Psychological Review,
// 117(2), 440–463. DOI 10.1037/a0018963 · OpenAlex W2089457241.
//
// The claim proposes that thinking about the future, the past, remote locations,
// other people's perspectives, and counterfactuals are unified as different forms
// of traversing an egocentric psychological distance (temporal, spatial, social,
// hypothetical) whose reference point is the self in the here and now — and, per
// construal-level theory (CLT), that greater psychological distance is associated
// with more abstract mental construal.
//
// The claim already carries its baseline (null -> RECORDED) first entry at
// publication (2010). This script adds the post-publication arc:
//
//   RECORDED -> CONTESTED (2020-06-29): Maglio's critique "An agenda for
//     psychological distance apart from construal level" (Social and Personality
//     Psychology Compass) argues the distance–construal link is over-extended and
//     under-specified, reviews accumulating replication failures (incl. the
//     "distance-from-a-distance" failures), and calls for studying psychological
//     distance decoupled from construal level — the first prominent, dated
//     scholarly challenge to the framework's core empirical prediction.
//
//   CONTESTED -> REVERSED (2026-04-16): the CLIMR international multilab
//     Registered Report (Calderon, Mac Giolla, Ask, Adler, et al., "Effects of
//     Psychological Distance on Mental Abstraction: A Registered Report of Four
//     Tests of Construal-Level Theory," Advances in Methods and Practices in
//     Psychological Science) preregistered direct and paradigmatic replications
//     across N = 11,775 participants in 27 countries. The core distance ->
//     abstraction effects collapsed to near zero: temporal d = 0.08 (original
//     0.92), spatial d = 0.04 (original 0.55), likelihood d = 0.03, and the
//     social-distance effect vanished (d = 0.006) once a valence confound was
//     controlled. The authors conclude the results "provide limited evidence for
//     the predictions of the theory and present a critical challenge for CLT,"
//     overturning the theory's central causal claim in the expert literature.
//
// Community: EXPERT_LITERATURE (peer-reviewed critique and registered report).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-construal-level-theory-psychological-distance.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-construal-level-theory-psychological-distance.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm1pn6e0clvsadnapto6mca'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-06-29',
    datePrecision: 'DAY',
    reason:
      'Maglio (2020), "An agenda for psychological distance apart from construal level" (Social and Personality Psychology Compass, 14(8), e12552), argued that construal-level theory\'s central prediction — that greater psychological distance yields more abstract construal — is over-extended and too weakly specified, and reviewed accumulating replication failures (including the "distance-from-a-distance" non-replications) to call for studying psychological distance decoupled from construal level. This is the first prominent, dated scholarly challenge to the framework\'s core empirical claim, moving it from recorded to contested in the expert literature.',
    source: {
      externalId: 'src:maglio-2020-psychological-distance-apart-from-construal-level',
      name:
        'Maglio SJ. An agenda for psychological distance apart from construal level. Social and Personality Psychology Compass. 2020;14(8):e12552. doi:10.1111/spc3.12552',
      url: 'https://compass.onlinelibrary.wiley.com/doi/10.1111/spc3.12552',
      publishedAt: '2020-06-29',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2026-04-16',
    datePrecision: 'DAY',
    reason:
      'The CLIMR international multilab Registered Report (Calderon, Mac Giolla, Ask, Adler, et al., "Effects of Psychological Distance on Mental Abstraction: A Registered Report of Four Tests of Construal-Level Theory," Advances in Methods and Practices in Psychological Science) preregistered direct and paradigmatic replications across N = 11,775 participants in 27 countries. The core distance-to-abstraction effects collapsed to near zero — temporal d = 0.08 (original 0.92), spatial d = 0.04 (original 0.55), likelihood d = 0.03, and the social-distance effect eliminated (d = 0.006) after controlling a valence confound. The authors conclude the findings "provide limited evidence for the predictions of the theory and present a critical challenge for CLT," overturning the theory\'s central causal prediction under a definitive preregistered test.',
    source: {
      externalId: 'src:calderon-2026-climr-registered-report-clt-four-tests',
      name:
        'Calderon S, Mac Giolla E, Ask K, Adler SJ, et al. Effects of Psychological Distance on Mental Abstraction: A Registered Report of Four Tests of Construal-Level Theory. Advances in Methods and Practices in Psychological Science. 2026;9(2). doi:10.1177/25152459251401177 (OpenAlex W4415630324).',
      url: 'https://openalex.org/W4415630324',
      publishedAt: '2026-04-16',
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
