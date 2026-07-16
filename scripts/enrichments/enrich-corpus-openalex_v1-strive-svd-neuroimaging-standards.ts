// Enrichment: post-publication epistemic trajectory for the 2013 STRIVE consensus
// statement on neuroimaging standards for cerebral small vessel disease
// (Wardlaw et al., The Lancet Neurology, 2013).
//
// Claim: cmpm1igdr0997sadncxz6rs23
// DOI:   https://doi.org/10.1016/s1474-4422(13)70124-8
// OpenAlex: W2158742097
//
// Baseline row (fromAxis=null -> RECORDED at 2013 publication) already exists;
// this script does NOT duplicate it.
//
// Post-publication arc (verified):
//   RECORDED -> SETTLED  (2023-07)
//   The original STRIVE statement standardised the terminology and reporting of
//   small vessel disease neuroimaging features (lacunes, white matter hyper-
//   intensities, perivascular spaces, microbleeds, recent small subcortical
//   infarcts, atrophy). A decade of near-universal adoption was consolidated by a
//   follow-up expert consensus statement, "Neuroimaging standards for research into
//   small vessel disease—advances since 2013" (STRIVE-2; Duering et al., The Lancet
//   Neurology, 2023), which reaffirmed the original framework and extended it with
//   new features and refined definitions — a field-consensus settling of the 2013
//   standards. Community: EXPERT_LITERATURE.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-strive-svd-neuroimaging-standards.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-strive-svd-neuroimaging-standards.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm1igdr0997sadncxz6rs23'

async function main() {
  // ── RECORDED -> SETTLED (STRIVE-2, 2023) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:strive2-svd-neuroimaging-advances-2023' },
    create: {
      externalId: 'src:strive2-svd-neuroimaging-advances-2023',
      name: 'Duering M, Biessels GJ, Brodtmann A, et al. Neuroimaging standards for research into small vessel disease—advances since 2013 (STRIVE-2). The Lancet Neurology 2023;22(7):602–618.',
      url: 'https://doi.org/10.1016/S1474-4422(23)00131-X',
      publishedAt: new Date('2023-07-01'),
      methodologyType: 'derivative',
      ingestedBy: 'openalex_v1',
    },
    update: {
      name: 'Duering M, Biessels GJ, Brodtmann A, et al. Neuroimaging standards for research into small vessel disease—advances since 2013 (STRIVE-2). The Lancet Neurology 2023;22(7):602–618.',
      url: 'https://doi.org/10.1016/S1474-4422(23)00131-X',
      publishedAt: new Date('2023-07-01'),
      methodologyType: 'derivative',
    },
  })

  const slug = `${CLAIM_ID}-SETTLED-2023-07-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2023-07-01'),
      datePrecision: 'MONTH',
      reason:
        'After a decade of near-universal adoption as the field standard for reporting cerebral small vessel disease neuroimaging features, the 2013 STRIVE framework was reaffirmed and extended by a follow-up expert consensus statement, STRIVE-2 (Duering et al., The Lancet Neurology, July 2023). STRIVE-2 retained the original terminology and definitions, updated them in light of ten years of use, and added new imaging features — consolidating the 2013 standards as settled field consensus.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2023-07-01'),
      datePrecision: 'MONTH',
      reason:
        'After a decade of near-universal adoption as the field standard for reporting cerebral small vessel disease neuroimaging features, the 2013 STRIVE framework was reaffirmed and extended by a follow-up expert consensus statement, STRIVE-2 (Duering et al., The Lancet Neurology, July 2023). STRIVE-2 retained the original terminology and definitions, updated them in light of ten years of use, and added new imaging features — consolidating the 2013 standards as settled field consensus.',
      sourceId: source.id,
    },
  })

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Enriched ${CLAIM_ID}: RECORDED -> SETTLED (2023-07, STRIVE-2)`)

  if (DRY_RUN) {
    console.log('[dry-run] rolling back — no writes committed')
    throw new Error('DRY_RUN')
  }
}

main()
  .catch((e) => {
    if (e.message !== 'DRY_RUN') {
      console.error(e)
      process.exit(1)
    }
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
