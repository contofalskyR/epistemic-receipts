// Epistemic-receipt enrichment for corpus claim cmplxlp7000idsa7fk0zaezis
// Oliver, R. L. (1980). "A Cognitive Model of the Antecedents and Consequences
// of Satisfaction Decisions." Journal of Marketing Research 17(4):460–469.
// DOI: 10.1177/002224378001700405 · OpenAlex: W4251859756
//
// Baseline row (fromAxis=null -> RECORDED at 1980-11-01) already exists; do NOT
// duplicate it. This script adds the post-publication adjudicating event.
//
// Arc added:
//   RECORDED -> SETTLED (2001-12) — Szymanski & Henard's meta-analysis of the
//   empirical customer-satisfaction literature consolidated the expectancy-
//   disconfirmation paradigm proposed here as a robust, replicated antecedent
//   structure for satisfaction (EXPERT_LITERATURE).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-oliver-1980-satisfaction-disconfirmation.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmplxlp7000idsa7fk0zaezis'

async function main() {
  // ── RECORDED -> SETTLED : Szymanski & Henard (2001) meta-analysis ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:szymanski-henard-2001-satisfaction-metaanalysis' },
    create: {
      externalId: 'src:szymanski-henard-2001-satisfaction-metaanalysis',
      name: 'Szymanski DM, Henard DH. Customer Satisfaction: A Meta-Analysis of the Empirical Evidence. Journal of the Academy of Marketing Science 2001;29(1):16–35.',
      url: 'https://doi.org/10.1177/0092070301291002',
      publishedAt: new Date('2001-12-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-oliver-1980-satisfaction-disconfirmation',
    },
    update: {
      name: 'Szymanski DM, Henard DH. Customer Satisfaction: A Meta-Analysis of the Empirical Evidence. Journal of the Academy of Marketing Science 2001;29(1):16–35.',
      url: 'https://doi.org/10.1177/0092070301291002',
      publishedAt: new Date('2001-12-01'),
    },
  })

  const slug = `${claimId}-SETTLED-2001-12-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2001-12-01'),
      datePrecision: 'MONTH',
      reason:
        'Szymanski & Henard meta-analyzed the accumulated empirical customer-satisfaction literature and found expectations and, especially, expectancy disconfirmation to be robust, consistently significant antecedents of satisfaction across studies — vindicating the expectancy-disconfirmation model Oliver (1980) proposed. The meta-analysis marks the paradigm\'s consolidation as the field\'s dominant, empirically settled account of satisfaction formation rather than a single-study proposal.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2001-12-01'),
      datePrecision: 'MONTH',
      reason:
        'Szymanski & Henard meta-analyzed the accumulated empirical customer-satisfaction literature and found expectations and, especially, expectancy disconfirmation to be robust, consistently significant antecedents of satisfaction across studies — vindicating the expectancy-disconfirmation model Oliver (1980) proposed. The meta-analysis marks the paradigm\'s consolidation as the field\'s dominant, empirically settled account of satisfaction formation rather than a single-study proposal.',
      sourceId: source.id,
    },
  })

  console.log(`✓ enriched ${claimId}: RECORDED -> SETTLED (2001-12)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
