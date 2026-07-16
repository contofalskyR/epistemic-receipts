// Epistemic-receipt enrichment for "Conflict monitoring and cognitive control"
// (Botvinick MM, Braver TS, Barch DM, Carter CS, Cohen JD. Psychological Review
// 2001;108(3):624–652. DOI 10.1037/0033-295x.108.3.624, OpenAlex W2000998192).
//
// The claim already has its baseline ClaimStatusHistory row
// (fromAxis=null -> RECORDED at the 2001-01-01 publication date). This script
// adds the post-publication arc.
//
// Post-publication event (verified 2026-07-15):
//   RECORDED -> CONTESTED (2011-07): Grinband, Savitskaya, Wager, Teichert,
//   Ferrera & Hirsch, "The dorsal medial frontal cortex is sensitive to time on
//   task, not response conflict or error likelihood" (NeuroImage 2011;57(2):
//   303–311, DOI 10.1016/j.neuroimage.2010.12.027), directly challenged the
//   central neuroimaging evidence cited for the conflict-monitoring hypothesis.
//   Reanalyzing Stroop-like data, they argued that dorsal medial frontal / dACC
//   activity scales with time-on-task rather than with response conflict or
//   error likelihood, undercutting the claim that ACC "responds to the occurrence
//   of conflict." The debate was recognized in the field: the original authors
//   published a reply (Yeung, Cohen & Botvinick, "Errors of interpretation and
//   modeling: a reply to Grinband et al.," NeuroImage 2011;57:316–319), and dACC
//   function has remained actively contested since — the conflict-monitoring
//   account was neither retracted nor consensus-settled, so the terminal axis is
//   CONTESTED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-botvinick-2001-conflict-monitoring-cognitive-control.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-botvinick-2001-conflict-monitoring-cognitive-control.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplxks9s0037sa7flepn7rvg'

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
    occurredAt: '2011-07-01',
    datePrecision: 'MONTH',
    reason:
      'Grinband, Savitskaya, Wager, Teichert, Ferrera & Hirsch (NeuroImage 2011;57(2):303–311) ' +
      'directly challenged the neuroimaging evidence underpinning the conflict-monitoring hypothesis, ' +
      'arguing that dorsal medial frontal / anterior cingulate activity in Stroop-like tasks scales with ' +
      'time-on-task rather than with response conflict or error likelihood — undercutting the paper\'s ' +
      'claim that the ACC "responds to the occurrence of conflict." The contest was recognized: the ' +
      'original authors published a formal reply (Yeung, Cohen & Botvinick, NeuroImage 2011;57:316–319), ' +
      'and the interpretation of dACC function has remained actively debated since. The hypothesis was ' +
      'neither retracted nor consensus-settled, so the terminal axis is CONTESTED.',
    source: {
      externalId: 'src:grinband-2011-dmfc-time-on-task',
      name:
        'Grinband J, Savitskaya J, Wager TD, Teichert T, Ferrera VP, Hirsch J. The dorsal medial frontal ' +
        'cortex is sensitive to time on task, not response conflict or error likelihood. NeuroImage. ' +
        '2011;57(2):303–311.',
      url: 'https://doi.org/10.1016/j.neuroimage.2010.12.027',
      publishedAt: '2011-07-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${claimId} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
