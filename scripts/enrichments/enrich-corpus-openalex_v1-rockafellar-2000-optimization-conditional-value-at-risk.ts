import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Rockafellar, R.T. & Uryasev, S. (2000). "Optimization of Conditional
//   Value-at-Risk." The Journal of Risk 2(3): 21-41.
//   DOI: 10.21314/jor.2000.038 · OpenAlex: W1647779468
//
// Baseline row (fromAxis=null -> RECORDED at 2000-01-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2016-01-14): The paper's central thesis — that
//   Conditional Value-at-Risk (a.k.a. Expected Shortfall / Tail VaR / Mean
//   Shortfall) is a more consistent risk measure than Value-at-Risk and can be
//   optimized directly — was institutionally adopted by the Basel Committee on
//   Banking Supervision. Its Fundamental Review of the Trading Book standard,
//   "Minimum capital requirements for market risk" (BCBS d352, 14 January 2016),
//   replaced the long-standing 99% Value-at-Risk regulatory measure with a 97.5%
//   Expected Shortfall (= CVaR) measure precisely because ES better captures
//   tail risk. This is a global-regulator consensus shift enacting the exact
//   VaR->CVaR argument of the paper. No retraction or expression of concern
//   exists (verified against Crossref metadata; the paper is not retracted).

const CLAIM_ID = 'cmq2w540b00olsa8h46ch6mf6'

async function main() {
  // ── RECORDED -> SETTLED: Basel FRTB adopts Expected Shortfall (CVaR) over VaR ──
  const bcbs = await prisma.source.upsert({
    where: { externalId: 'src:bcbs-d352-frtb-market-risk-2016' },
    create: {
      externalId: 'src:bcbs-d352-frtb-market-risk-2016',
      name: 'Basel Committee on Banking Supervision, "Minimum capital requirements for market risk" (Fundamental Review of the Trading Book), BCBS d352, 14 January 2016 — replaces 99% VaR with 97.5% Expected Shortfall.',
      url: 'https://www.bis.org/bcbs/publ/d352.htm',
      publishedAt: new Date('2016-01-14'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-rockafellar-2000-optimization-conditional-value-at-risk',
    },
    update: {
      name: 'Basel Committee on Banking Supervision, "Minimum capital requirements for market risk" (Fundamental Review of the Trading Book), BCBS d352, 14 January 2016 — replaces 99% VaR with 97.5% Expected Shortfall.',
      url: 'https://www.bis.org/bcbs/publ/d352.htm',
      publishedAt: new Date('2016-01-14'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2016-01-14`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2016-01-14'),
      datePrecision: 'DAY',
      reason: "The paper's core thesis — that Conditional Value-at-Risk (Expected Shortfall / Tail VaR) is a more consistent risk measure than Value-at-Risk — was institutionally adopted by the Basel Committee's Fundamental Review of the Trading Book. The standard 'Minimum capital requirements for market risk' (BCBS d352, 14 January 2016) replaced the 99% VaR regulatory measure with a 97.5% Expected Shortfall (= CVaR) measure because ES better captures tail risk. This global-regulator consensus shift enacts the exact VaR->CVaR argument of the paper. No retraction or expression of concern exists.",
      sourceId: bcbs.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2016-01-14'),
      datePrecision: 'DAY',
      reason: "The paper's core thesis — that Conditional Value-at-Risk (Expected Shortfall / Tail VaR) is a more consistent risk measure than Value-at-Risk — was institutionally adopted by the Basel Committee's Fundamental Review of the Trading Book. The standard 'Minimum capital requirements for market risk' (BCBS d352, 14 January 2016) replaced the 99% VaR regulatory measure with a 97.5% Expected Shortfall (= CVaR) measure because ES better captures tail risk. This global-regulator consensus shift enacts the exact VaR->CVaR argument of the paper. No retraction or expression of concern exists.",
      sourceId: bcbs.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: bcbs.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: bcbs.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via Basel FRTB adoption of Expected Shortfall/CVaR over VaR, BCBS d352, 2016-01-14)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
