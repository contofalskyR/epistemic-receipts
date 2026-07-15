// Enrichment: post-publication epistemic trajectory for the cognitive-therapy-of-depression
// overview claim (OpenAlex W213417050 / DOI 10.1037/e675542012-001, "Cognitive Therapy for
// Depression", 2012). The claim asserts CT is "a well-established treatment with acute effects
// on par with those of medication" and with "effects that endure after treatment ends."
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication) already exists
// and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2015-05-11): Johnsen & Friborg, "The effects of cognitive behavioral
//   therapy as an anti-depressive treatment is falling: A meta-analysis" (Psychological Bulletin
//   141(4):747-768, epub 2015-05-11). A 70-study meta-analysis reporting that CBT's antidepressant
//   effect sizes have declined substantially across cohorts since the 1970s, directly contesting
//   the "acute effects on par with medication" effectiveness pillar of the overview claim.
//
// Only this single high-confidence transition is included. No retraction/expression of concern
// exists (isRetracted=null), and no subsequent meta-analysis or guideline cleanly settles or
// reverses the falling-effects dispute, so no CONTESTED->SETTLED/REVERSED arc is asserted.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cognitive-therapy-depression-enduring-effects.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmplxkovh001dsa7fxxyld6tq'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const transitions: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-05-11',
    datePrecision: 'DAY',
    reason:
      'Johnsen & Friborg, "The effects of cognitive behavioral therapy as an anti-depressive treatment is falling: A meta-analysis" (Psychological Bulletin 141(4):747-768, epub 2015-05-11), synthesized 70 studies and found that CBT\'s effect sizes as a treatment for depression have declined substantially since the 1970s. The finding directly contests the overview claim\'s pillar that cognitive therapy has acute effects "on par with those of medication," reframing the magnitude of CT\'s antidepressant efficacy as an open empirical question rather than a settled one.',
    source: {
      externalId: 'src:johnsen-friborg-cbt-falling-2015',
      name: 'Johnsen TJ & Friborg O (2015). The effects of cognitive behavioral therapy as an anti-depressive treatment is falling: A meta-analysis. Psychological Bulletin, 141(4), 747-768.',
      url: 'https://doi.org/10.1037/bul0000015',
      publishedAt: '2015-05-11',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of transitions) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-cognitive-therapy-depression',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'AGAINST' } })
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
