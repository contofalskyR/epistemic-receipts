// Enrichment: post-publication epistemic trajectory for
// Barro RJ. "Are Government Bonds Net Wealth?" Journal of Political Economy,
// 1974;82(6):1095–1117. DOI 10.1086/260266 (OpenAlex W2047560619).
//
// This paper is the founding formal statement of the Ricardian-equivalence
// proposition — that under certain conditions government debt is not net wealth
// because rational agents capitalize the implied future tax liabilities.
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1974-11) already
// exists; do NOT duplicate it. This script adds only the post-publication arc.
//
// Verified adjudicating event:
//   RECORDED -> CONTESTED (1987-07) — Bernheim, "Ricardian Equivalence: An
//   Evaluation of Theory and Evidence" (NBER Macroeconomics Annual 1987;
//   NBER WP 2330). Bernheim surveyed the theoretical assumptions and the
//   empirical literature and concluded the weight of evidence runs against
//   Ricardian equivalence, establishing it as a genuinely contested — not
//   settled — proposition in macroeconomics.
//
// No retraction or expression of concern exists (OpenAlex is_retracted=false).
// The proposition remains debated (no consensus SETTLED/REVERSED event), so a
// single high-confidence CONTESTED transition is added rather than a manufactured
// multi-step arc.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-barro-1974-government-bonds-net-wealth.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-barro-1974-government-bonds-net-wealth.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmpm24xpj0hsdsafwfv8x0bcr'

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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1987-07-01',
    datePrecision: 'MONTH',
    reason:
      'B. Douglas Bernheim\'s "Ricardian Equivalence: An Evaluation of Theory and Evidence" (NBER Macroeconomics Annual 1987; NBER Working Paper 2330, July 1987) systematically reviewed the assumptions behind Barro\'s proposition and the accumulated empirical tests. Bernheim concluded that the theory rests on implausible assumptions and that the weight of empirical evidence runs against full Ricardian equivalence, crystallizing the finding as an actively contested proposition rather than an accepted result.',
    source: {
      externalId: 'src:bernheim-ricardian-equivalence-evaluation-1987',
      name: 'Bernheim BD. Ricardian Equivalence: An Evaluation of Theory and Evidence. NBER Macroeconomics Annual 1987;2:263–304 (NBER Working Paper 2330).',
      url: 'https://doi.org/10.3386/w2330',
      publishedAt: '1987-07-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${claimId} — Barro 1974 "Are Government Bonds Net Wealth?"`
  )
  console.log(`${TRANSITIONS.length} transition(s)${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

  for (const t of TRANSITIONS) {
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(`  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt}`)
    console.log(`    source: ${t.source.externalId}`)
    console.log(`    history id: ${slug}`)

    if (DRY_RUN) continue

    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
