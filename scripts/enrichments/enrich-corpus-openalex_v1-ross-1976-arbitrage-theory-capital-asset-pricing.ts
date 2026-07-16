import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Ross, S.A. (1976), "The Arbitrage Theory of Capital Asset Pricing",
//   Journal of Economic Theory 13(3):341–360.
//   DOI: 10.1016/0022-0531(76)90046-6 · OpenAlex W2010681793
//
// This is the paper that introduced the Arbitrage Pricing Theory (APT), a
// multi-factor alternative to the CAPM in which expected returns are a linear
// function of exposures to a small set of systematic risk factors, enforced by
// the absence of arbitrage. The baseline ClaimStatusHistory row
// (null -> RECORDED at 1976-12) already exists; this script adds only the
// post-publication arc.
//
// Verified adjudicating events (two transitions):
//   1. RECORDED -> CONTESTED (1982-12) — Shanken, "The Arbitrage Pricing
//      Theory: Is it Testable?", Journal of Finance 37(5):1129–1140. A pointed,
//      widely cited methodological critique arguing that the APT, in its
//      general (approximate-factor) form, may be empirically untestable because
//      the factor structure and the identity of the market proxy are not pinned
//      down — placing the theory's empirical content genuinely in dispute.
//      Community: EXPERT_LITERATURE.
//   2. CONTESTED -> SETTLED (1986-01) — Chen, Roll & Ross, "Economic Forces and
//      the Stock Market", Journal of Business 59(3):383–403. The landmark
//      empirical vindication: it identified a specific, economically
//      interpretable set of priced macroeconomic factors (industrial
//      production, unanticipated inflation, the risk premium/term-structure
//      spreads) that are systematically priced in equity returns, converting
//      APT from an abstract no-arbitrage argument into an operational, tested
//      multi-factor model. This adjudicated the testability contest and
//      established APT as a canonical framework in the asset-pricing
//      literature. Community: EXPERT_LITERATURE.
//
// No retraction, expression of concern, or failed replication exists for the
// original paper.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ross-1976-arbitrage-theory-capital-asset-pricing.ts

const claimId = 'cmplypocw0155saqkppecvv4q'

interface Arc {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const ARCS: Arc[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1982-12-01',
    datePrecision: 'MONTH',
    reason:
      'Shanken, "The Arbitrage Pricing Theory: Is it Testable?" (Journal of Finance 37(5):1129–1140, Dec 1982) mounted an influential methodological challenge to Ross\'s APT, arguing that in its general approximate-factor form the theory imposes little testable restriction on observed returns: the factor structure is not uniquely identified and the required benchmark portfolio is unobservable, so empirical "tests" could be rendered vacuous. The critique put APT\'s empirical content genuinely in dispute and provoked a defense (Dybvig & Ross, "Yes, The APT is Testable", 1985).',
    source: {
      externalId: 'src:shanken-1982-apt-testable',
      name: 'Shanken J. The Arbitrage Pricing Theory: Is it Testable? The Journal of Finance 1982;37(5):1129–1140.',
      url: 'https://doi.org/10.1111/j.1540-6261.1982.tb03607.x',
      publishedAt: '1982-12-01',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1986-01-01',
    datePrecision: 'MONTH',
    reason:
      'Chen, Roll & Ross, "Economic Forces and the Stock Market" (Journal of Business 59(3):383–403, 1986) provided the landmark empirical vindication of APT. It showed that a small set of economically interpretable macroeconomic factors — industrial production growth, unanticipated inflation, and term-structure/default risk-premium spreads — are systematically priced in U.S. equity returns, turning APT from an abstract no-arbitrage argument into an operational, testable multi-factor asset-pricing model. This resolved the testability contest and cemented APT as a canonical framework alongside and beyond the single-factor CAPM.',
    source: {
      externalId: 'src:chen-roll-ross-1986-economic-forces',
      name: 'Chen N-F, Roll R, Ross SA. Economic Forces and the Stock Market. The Journal of Business 1986;59(3):383–403.',
      url: 'https://doi.org/10.1086/296344',
      publishedAt: '1986-01-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } })
  if (!claim) throw new Error(`Claim ${claimId} not found — aborting.`)

  for (const arc of ARCS) {
    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
      },
    })

    const histId = `${claimId}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: claim.id,
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`Upserted ${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
