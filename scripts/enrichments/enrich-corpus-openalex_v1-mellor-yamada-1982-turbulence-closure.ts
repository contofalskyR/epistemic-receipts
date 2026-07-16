// Epistemic-receipt enrichment for claim cmq2w4z9c00lrsa8hz0dtuk6r
// "Development of a turbulence closure model for geophysical fluid problems"
//   — George L. Mellor & Tetsuji Yamada,
//     Reviews of Geophysics 20(4):851–875 (Nov 1982)
//     DOI: 10.1029/RG020i004p00851 · OpenAlex W2038742869
//   (The "Mellor–Yamada Level 2.5" second-moment turbulence closure model.)
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1982-11-01) already
// exists — do NOT duplicate it. This script adds the post-publication arc.
//
// Post-publication findings (no retraction or expression of concern exists;
// this is a foundational methods paper). Two verifiable, dated adjudications:
//
//   1) RECORDED -> CONTESTED (Jan 1988). Galperin, Kantha, Hassid & Rosati,
//      "A Quasi-equilibrium Turbulent Energy Model for Geophysical Flows"
//      (J. Atmos. Sci. 45(1):55–62), documented that the Mellor–Yamada Level 2.5
//      closure behaves unrealistically under strong stable stratification: the
//      master turbulent length scale grows without physical bound and the
//      stability functions become singular/ill-behaved — a direct challenge to
//      the paper's central claim of "genuine predictive skill in coping with the
//      effects of stratification." They introduced the quasi-equilibrium
//      correction (clipped length scale, revised stability functions) that the
//      community adopted in place of the original 1982 formulation.
//
//   2) CONTESTED -> SETTLED (May 2005). Umlauf & Burchard, "Second-order
//      turbulence closure models for geophysical boundary layers. A review of
//      recent work" (Continental Shelf Research 25(7–8):795–827), is an
//      independent peer-reviewed review that adjudicates the second-moment
//      closure family for geophysical flows and establishes the Mellor–Yamada
//      model — with its Galperin/Kantha–Clayson refinements — as the standard,
//      canonical framework for stratified geophysical boundary-layer turbulence.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mellor-yamada-1982-turbulence-closure.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mellor-yamada-1982-turbulence-closure.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

const CLAIM_ID = 'cmq2w4z9c00lrsa8hz0dtuk6r'

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
    occurredAt: '1988-01-01',
    datePrecision: 'MONTH',
    reason:
      'Galperin, Kantha, Hassid & Rosati, "A Quasi-equilibrium Turbulent Energy Model for Geophysical Flows" (J. Atmos. Sci. 45(1):55–62, Jan 1988), documented that the Mellor–Yamada Level 2.5 closure behaves unrealistically under strong stable stratification — the master turbulent length scale grows without physical bound and the stability functions become singular. This directly challenges the paper\'s central claim of "genuine predictive skill in coping with the effects of stratification," and the authors proposed the quasi-equilibrium correction (clipped length scale, revised stability functions) that superseded the original 1982 formulation in practice.',
    source: {
      externalId: 'src:galperin-1988-quasi-equilibrium-closure',
      name: 'Galperin B, Kantha LH, Hassid S, Rosati A. A Quasi-equilibrium Turbulent Energy Model for Geophysical Flows. Journal of the Atmospheric Sciences 1988;45(1):55–62.',
      url: 'https://doi.org/10.1175/1520-0469(1988)045%3C0055:AQETEM%3E2.0.CO;2',
      publishedAt: '1988-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2005-05-01',
    datePrecision: 'MONTH',
    reason:
      'Umlauf & Burchard, "Second-order turbulence closure models for geophysical boundary layers. A review of recent work" (Continental Shelf Research 25(7–8):795–827, May 2005), is an independent peer-reviewed review that adjudicates the second-moment closure family for geophysical flows. It establishes the Mellor–Yamada model — with the Galperin (1988) and Kantha–Clayson (1994) refinements — as the standard, canonical framework for stratified geophysical boundary-layer turbulence, settling the original finding (as corrected) in the expert literature.',
    source: {
      externalId: 'src:umlauf-burchard-2005-closure-review',
      name: 'Umlauf L, Burchard H. Second-order turbulence closure models for geophysical boundary layers. A review of recent work. Continental Shelf Research 2005;25(7–8):795–827.',
      url: 'https://doi.org/10.1016/j.csr.2004.08.004',
      publishedAt: '2005-05-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source upsert: ${tr.source.externalId}`)
      console.log(`[dry-run] history upsert: ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:openalex_v1-mellor-yamada-1982-turbulence-closure',
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
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
