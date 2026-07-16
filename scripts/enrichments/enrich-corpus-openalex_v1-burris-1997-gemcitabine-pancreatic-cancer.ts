// Enrichment: post-publication epistemic trajectory for
// Burris HA 3rd, Moore MJ, Andersen J, et al. "Improvements in survival and
// clinical benefit with gemcitabine as first-line therapy for patients with
// advanced pancreas cancer: a randomized trial." J Clin Oncol
// 1997;15(6):2403–2413. DOI 10.1200/jco.1997.15.6.2403 (OpenAlex W1931508686).
//
// This landmark randomized trial showed gemcitabine produced a higher clinical
// benefit response (23.8% vs 4.8%) and improved survival versus fluorouracil in
// advanced pancreas cancer, and it established single-agent gemcitabine as the
// first-line standard of care.
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1997-06) already
// exists; do NOT duplicate it. This script adds only the post-publication arc.
//
// Verified adjudicating event:
//   RECORDED -> SETTLED (2008-03-28) — Heinemann V, Boeck S, Hinke A, Labianca R,
//   Louvet C. "Meta-analysis of randomized trials: evaluation of benefit from
//   gemcitabine-based combination chemotherapy applied in advanced pancreatic
//   cancer." BMC Cancer 2008;8:82 (PMID 18373843). This meta-analysis of
//   randomized trials adjudicated the field by treating single-agent gemcitabine
//   as the established reference standard against which all combination regimens
//   were measured — confirming that Burris's finding had settled into the
//   accepted first-line standard of care for advanced pancreatic cancer.
//
// No retraction or expression of concern exists (OpenAlex is_retracted=false).
// The finding was never seriously contested (gemcitabine was adopted rapidly as
// standard), so a single high-confidence SETTLED transition is added rather than
// a manufactured multi-step arc. Later regimens (FOLFIRINOX 2011, gemcitabine +
// nab-paclitaxel 2013) were benchmarked AGAINST gemcitabine and do not reverse
// this claim.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-burris-1997-gemcitabine-pancreatic-cancer.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-burris-1997-gemcitabine-pancreatic-cancer.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmply4i9u007lsaih78iv773o'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-03-28',
    datePrecision: 'DAY',
    reason:
      'Heinemann and colleagues\' "Meta-analysis of randomized trials: evaluation of benefit from gemcitabine-based combination chemotherapy applied in advanced pancreatic cancer" (BMC Cancer 2008;8:82, PMID 18373843) pooled the randomized evidence with single-agent gemcitabine as the established reference standard arm. By the time of this adjudication the field uniformly treated gemcitabine — the regimen Burris\'s trial validated — as the accepted first-line standard of care against which all new combinations had to be tested, settling the finding as vindicated.',
    source: {
      externalId: 'src:heinemann-gemcitabine-meta-analysis-2008',
      name: 'Heinemann V, Boeck S, Hinke A, Labianca R, Louvet C. Meta-analysis of randomized trials: evaluation of benefit from gemcitabine-based combination chemotherapy applied in advanced pancreatic cancer. BMC Cancer 2008;8:82.',
      url: 'https://doi.org/10.1186/1471-2407-8-82',
      publishedAt: '2008-03-28',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${claimId} — Burris 1997 gemcitabine advanced pancreas cancer trial`
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
