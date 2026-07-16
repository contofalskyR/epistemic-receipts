// Enrichment: post-publication epistemic trajectory for Tversky & Kahneman,
// "Judgment Under Uncertainty: Heuristics and Biases" (claim cmq2w5d3400u3sa8h3n4b3nc2).
//
// DOI 10.2307/2288362 (JSTOR index of the foundational heuristics-and-biases work,
// corpus-dated 1984-03-01; OpenAlex W2328418989). Baseline row
// (fromAxis=null -> RECORDED at 1984-03-01) already exists; this script adds only
// the post-publication transitions.
//
// Arc added (two steps):
//   RECORDED -> CONTESTED (EXPERT_LITERATURE, 1991):
//     Gerd Gigerenzer, "How to Make Cognitive Illusions Disappear: Beyond
//     'Heuristics and Biases'" (European Review of Social Psychology, 1991), the
//     opening salvo of the "rationality wars." Gigerenzer argued that many
//     documented biases (overconfidence, conjunction fallacy, base-rate neglect)
//     are artifacts of a narrow normative frame and single-case vs. frequency
//     confusion, and can be made to shrink, disappear, or invert with frequency
//     formats — a direct, dated methodological challenge to the program's
//     interpretation.
//   CONTESTED -> SETTLED (INSTITUTIONAL, 2002-10-09):
//     The 2002 Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred
//     Nobel was awarded to Daniel Kahneman "for having integrated insights from
//     psychological research into economic science, especially concerning human
//     judgment and decision-making under uncertainty" — the field's highest
//     institutional body validating the heuristics-and-biases program as a
//     foundational contribution, even amid the ongoing methodological debate.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-tversky-kahneman-judgment-under-uncertainty.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-tversky-kahneman-judgment-under-uncertainty.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w5d3400u3sa8h3n4b3nc2'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1991-01-01',
    datePrecision: 'YEAR',
    reason:
      'Gerd Gigerenzer, "How to Make Cognitive Illusions Disappear: Beyond \'Heuristics and Biases\'" (European Review of Social Psychology, 1991, 2:83–115), launched the "rationality wars" by arguing that many biases documented by Tversky & Kahneman (overconfidence, conjunction fallacy, base-rate neglect) rest on a narrow normative standard and a conflation of single-case vs. relative-frequency probability. He showed that reframing the tasks in frequency formats makes the "stable errors" shrink, vanish, or invert — a specific, dated methodological challenge to the heuristics-and-biases interpretation.',
    source: {
      externalId: 'src:gigerenzer-1991-cognitive-illusions-disappear',
      name: 'Gigerenzer G. How to Make Cognitive Illusions Disappear: Beyond "Heuristics and Biases". European Review of Social Psychology 1991;2(1):83–115. DOI:10.1080/14792779143000033.',
      url: 'https://doi.org/10.1080/14792779143000033',
      publishedAt: '1991-01-01',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2002-10-09',
    datePrecision: 'DAY',
    reason:
      'On 9 October 2002 the Royal Swedish Academy of Sciences awarded the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel to Daniel Kahneman "for having integrated insights from psychological research into economic science, especially concerning human judgment and decision-making under uncertainty." The award — the field\'s highest institutional recognition — validated the heuristics-and-biases program as foundational to behavioral economics and cognitive science, settling its standing despite the continuing methodological debate opened by Gigerenzer.',
    source: {
      externalId: 'src:nobel-economic-sciences-2002-kahneman',
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2002 — Daniel Kahneman (and Vernon L. Smith). NobelPrize.org, announced 9 October 2002.',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2002/summary/',
      publishedAt: '2002-10-09',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
