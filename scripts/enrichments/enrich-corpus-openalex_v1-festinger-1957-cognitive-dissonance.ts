// Enrichment: epistemic trajectory for Leon Festinger, "A Theory of Cognitive
// Dissonance," Stanford University Press (1 June 1957).
// DOI 10.1515/9781503620766. OpenAlex W4300107936.
//
// Identity confirmed via Crossref: title "A Theory of Cognitive Dissonance,"
// author Leon Festinger, publisher Stanford University Press, issued 1957-06-01.
// No retraction, expression of concern, or erratum (Crossref `update-to` and
// `updated-by` both empty; the DOI resolves to the De Gruyter/Stanford landing
// page). The claim is the foundational statement of cognitive dissonance theory
// — including its application to why partial reward, delay of reward, and effort
// during training raise resistance to extinction.
//
// Post-publication research state — a genuine, dated, multi-step adjudication
// arc that is standard in the social-psychology record:
//
//   RECORDED -> CONTESTED (1967): Daryl J. Bem, "Self-perception: An alternative
//     interpretation of cognitive dissonance phenomena" (Psychological Review
//     74(3): 183–200) directly challenged Festinger's theory. Bem argued the
//     same forced-compliance / insufficient-reward data could be explained
//     without any internal dissonance state — subjects simply infer their
//     attitudes from their own behavior — making the dissonance mechanism
//     unnecessary. This launched the dissonance-vs-self-perception debate and
//     put the core explanatory mechanism in dispute. Community EXPERT_LITERATURE.
//
//   CONTESTED -> SETTLED (1974): Mark P. Zanna & Joel Cooper, "Dissonance and
//     the pill: An attribution approach to studying the arousal properties of
//     dissonance" (Journal of Personality and Social Psychology 29(5): 703–709)
//     adjudicated the debate in Festinger's favor. Using a misattribution
//     (placebo-pill) paradigm, they showed that induced compliance produces a
//     genuine, drive-like arousal state — something Bem's purely inferential
//     self-perception account could not predict — re-establishing dissonance as
//     a real motivational process. This arousal evidence is the canonical
//     vindication of the theory. Community EXPERT_LITERATURE.
//
// Both adjudicating papers are dated by Crossref to the publication YEAR only
// (no confirmed month/issue date), so datePrecision is YEAR — not sharpened.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 1957 publication). Do NOT duplicate it; this script adds the two downstream
// transitions.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-festinger-1957-cognitive-dissonance.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-festinger-1957-cognitive-dissonance.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxk8k70007sa6hy1fqfv5z'

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

// Do NOT duplicate the existing null -> RECORDED (1957 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1967-01-01',
    datePrecision: 'YEAR',
    reason:
      'Daryl J. Bem, "Self-perception: An alternative interpretation of cognitive dissonance phenomena" (Psychological Review 74(3): 183–200, 1967), offered a rival account of the very data Festinger\'s theory was built on. Bem argued that forced-compliance and insufficient-reward effects follow from people inferring their attitudes from their own overt behavior, requiring no internal dissonance state at all. The paper made the core explanatory mechanism of the theory a matter of active dispute in the expert literature.',
    source: {
      externalId: 'src:bem-1967-self-perception-cognitive-dissonance',
      name:
        'D.J. Bem, "Self-perception: An alternative interpretation of cognitive dissonance phenomena," Psychological Review 74(3): 183–200 (1967). DOI 10.1037/h0024835.',
      url: 'https://doi.org/10.1037/h0024835',
      publishedAt: '1967-01-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1974-01-01',
    datePrecision: 'YEAR',
    reason:
      'Mark P. Zanna & Joel Cooper, "Dissonance and the pill: An attribution approach to studying the arousal properties of dissonance" (Journal of Personality and Social Psychology 29(5): 703–709, 1974), adjudicated the dissonance-vs-self-perception debate in Festinger\'s favor. Using a misattribution (placebo-pill) paradigm, they demonstrated that induced compliance generates a genuine drive-like arousal state — a prediction unique to dissonance theory and beyond the reach of Bem\'s purely inferential account. This arousal evidence became the canonical vindication that re-established cognitive dissonance as a real motivational process.',
    source: {
      externalId: 'src:zanna-cooper-1974-dissonance-and-the-pill',
      name:
        'M.P. Zanna & J. Cooper, "Dissonance and the pill: An attribution approach to studying the arousal properties of dissonance," Journal of Personality and Social Psychology 29(5): 703–709 (1974). DOI 10.1037/h0036651.',
      url: 'https://doi.org/10.1037/h0036651',
      publishedAt: '1974-01-01',
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
