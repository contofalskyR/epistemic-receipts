// Epistemic-receipt enrichment: post-publication trajectory for
// Friedman, Hastie & Tibshirani (2008), "Sparse inverse covariance estimation
// with the graphical lasso", Biostatistics 9(3):432–441.
// DOI: 10.1093/biostatistics/kxm045. OpenAlex: W2132555912.
// Claim id: cmq2w52wc00nxsa8h2v7hxo3y.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2007-12-12) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2012, EXPERT_LITERATURE)
//     Mazumder & Hastie, "The graphical lasso: New insights and alternatives"
//     (Electronic Journal of Statistics 6:2125–2149). This peer-reviewed paper —
//     co-authored by one of the original authors — documented that the graphical
//     lasso algorithm as originally published can FAIL TO CONVERGE and can be
//     numerically unstable, and clarified confusion about which optimization
//     problem it actually solves (primal vs. dual). It introduced corrected
//     alternatives (P-GLASSO, DP-GLASSO), directly contesting the "remarkably
//     fast / solves the problem" computational-correctness claim of this paper.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-graphical-lasso-friedman-2008.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w52wc00nxsa8h2v7hxo3y'

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
    occurredAt: '2012-01-01',
    datePrecision: 'YEAR',
    reason:
      'Mazumder & Hastie, "The graphical lasso: New insights and alternatives" (Electronic Journal of Statistics 2012;6:2125–2149), co-authored by one of the original authors, documented that the graphical lasso algorithm as originally published can fail to converge and behave in numerically unstable ways, and clarified persistent confusion about which optimization problem the procedure actually solves (primal vs. dual block-coordinate updates). It introduced corrected alternatives (P-GLASSO and DP-GLASSO) with guaranteed convergence. By showing the originally published algorithm could diverge, this peer-reviewed critique directly contests the paper\'s core computational-correctness claim that the algorithm reliably and rapidly "solves" the sparse inverse-covariance problem.',
    source: {
      externalId: 'src:mazumder-hastie-glasso-insights-2012',
      name: 'Mazumder R, Hastie T. The graphical lasso: New insights and alternatives. Electronic Journal of Statistics 2012;6:2125–2149.',
      url: 'https://doi.org/10.1214/12-EJS740',
      publishedAt: '2012-01-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
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

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
