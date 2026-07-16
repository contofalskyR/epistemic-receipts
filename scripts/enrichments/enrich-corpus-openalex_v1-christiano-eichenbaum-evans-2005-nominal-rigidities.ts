// Enrichment: post-publication epistemic trajectory for
// Christiano LJ, Eichenbaum M, Evans CL. "Nominal Rigidities and the Dynamic
// Effects of a Shock to Monetary Policy." Journal of Political Economy,
// 2005;113(1):1–45. DOI 10.1086/426038 (OpenAlex W3121293400).
//
// This is a foundational New Keynesian DSGE paper: it argues that a medium-scale
// model with moderate nominal rigidities — chiefly staggered wage contracts of
// ~3 quarters' average duration and variable capital utilization — reproduces the
// observed inertia in inflation and persistence in output after a monetary shock.
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2005-02) already
// exists; do NOT duplicate it. This script adds only the post-publication arc.
//
// Verified adjudicating event:
//   RECORDED -> CONTESTED (2009-01) — Chari, Kehoe & McGrattan, "New Keynesian
//   Models: Not Yet Useful for Policy Analysis" (American Economic Journal:
//   Macroeconomics 2009;1(1):242–266; DOI 10.1257/mac.1.1.242). This is a
//   specific, dated methodological critique of exactly this class of estimated
//   New Keynesian DSGE model. It argues that the frictions and structural shocks
//   the CEE framework relies on — including the wage-stickiness identification
//   central to this claim — are not convincingly structural (they are "dubiously
//   structural"), so the models are not yet reliable for the policy analysis they
//   are used for, moving the finding into an actively contested state.
//
// No retraction or expression of concern exists (OpenAlex is_retracted=false;
// Crossref update-to/updated-by both null). The New Keynesian DSGE framework
// remains simultaneously dominant and genuinely contested, with no consensus
// SETTLED/REVERSED event specific to this claim, so a single high-confidence
// CONTESTED transition is added rather than a manufactured multi-step arc.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-christiano-eichenbaum-evans-2005-nominal-rigidities.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-christiano-eichenbaum-evans-2005-nominal-rigidities.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplynkal003tsaqkjfrj7xt0'

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
    occurredAt: '2009-01-01',
    datePrecision: 'MONTH',
    reason:
      'V. V. Chari, Patrick J. Kehoe and Ellen R. McGrattan\'s "New Keynesian Models: Not Yet Useful for Policy Analysis" (American Economic Journal: Macroeconomics 2009;1(1):242–266) is a specific, dated methodological critique of exactly this class of estimated New Keynesian DSGE model. It argues that the wage-markup, price-markup and other frictions/shocks the CEE framework relies on — including the staggered-wage identification central to this claim — are not convincingly structural and instead absorb misspecification, so the models are not yet reliable for the policy analysis they are used for. This crystallized the finding as an actively contested proposition within macroeconomics rather than an accepted result.',
    source: {
      externalId: 'src:chari-kehoe-mcgrattan-new-keynesian-not-yet-useful-2009',
      name: 'Chari VV, Kehoe PJ, McGrattan ER. New Keynesian Models: Not Yet Useful for Policy Analysis. American Economic Journal: Macroeconomics 2009;1(1):242–266.',
      url: 'https://doi.org/10.1257/mac.1.1.242',
      publishedAt: '2009-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${claimId} — Christiano, Eichenbaum & Evans 2005 "Nominal Rigidities and the Dynamic Effects of a Shock to Monetary Policy"`
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
