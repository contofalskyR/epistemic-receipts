// Enrichment: post-publication epistemic arc for Michael Porter's Competitive Strategy.
//
// Claim: cmplypr5h016hsaqk3csf7usq (openalex_v1, W1855283887)
//   "Competitive Strategy: Techniques for Analyzing Industries and Competitors" —
//   Michael E. Porter, Free Press, 1980. No DOI. ~16,842 OpenAlex citations.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1980-01-01) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref):
//   - No retraction and no expression of concern (the book is a foundational strategy text).
//   - RECORDED -> CONTESTED: Rumelt (Strategic Management Journal 1991;12(3):167-185,
//     DOI 10.1002/smj.4250120302) published the canonical empirical challenge to the
//     industry-structure-primacy thesis at the core of Porter's positioning framework.
//     Decomposing the variance in business-unit profitability, Rumelt found that stable
//     industry effects account for only a modest share (~8%) while business-unit-specific
//     effects dominate (~46%) and corporate-parent effects are "vanishingly small."
//     This directly contests the premise that analyzing industry structure is the primary
//     lever for firm profitability, opening a sustained expert-literature dispute
//     (McGahan & Porter 1997 "How much does industry matter, really?" and successors)
//     that remains unresolved. RECORDED -> CONTESTED.
//
// No SETTLED/REVERSED step is asserted: the industry-effects-vs-firm-effects debate that
// Rumelt opened is genuinely still open in the strategy literature.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-porter-1980-competitive-strategy.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplypr5h016hsaqk3csf7usq'

async function main() {
  // ── RECORDED -> CONTESTED: Rumelt's "How much does industry matter?" (1991) ──
  const critiqueSource = await prisma.source.upsert({
    where: { externalId: 'src:rumelt-1991-how-much-does-industry-matter' },
    create: {
      externalId: 'src:rumelt-1991-how-much-does-industry-matter',
      name: 'Rumelt RP. How much does industry matter? Strategic Management Journal 1991;12(3):167-185. DOI 10.1002/smj.4250120302.',
      url: 'https://doi.org/10.1002/smj.4250120302',
      publishedAt: new Date('1991-03-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Rumelt RP. How much does industry matter? Strategic Management Journal 1991;12(3):167-185. DOI 10.1002/smj.4250120302.',
      url: 'https://doi.org/10.1002/smj.4250120302',
      publishedAt: new Date('1991-03-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-1991-03-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1991-03-01'),
      datePrecision: 'MONTH',
      sourceId: critiqueSource.id,
      reason:
        'Rumelt (Strategic Management Journal 1991;12:167-185) published the canonical empirical challenge to the industry-structure-primacy thesis underlying Porter\'s positioning framework. Decomposing variance in business-unit profitability, he found stable industry effects explain only a modest share (~8%) while business-unit-specific effects dominate (~46%) and corporate effects are negligible. This directly contests the premise that industry-structure analysis is the primary determinant of firm profitability and opened a sustained, still-unresolved debate (McGahan & Porter 1997 and successors): RECORDED -> CONTESTED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1991-03-01'),
      datePrecision: 'MONTH',
      sourceId: critiqueSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED @ 1991-03)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
