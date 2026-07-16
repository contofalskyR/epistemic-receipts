// Enrichment: post-publication epistemic arc for the 1974 Beck Hopelessness Scale paper.
//
// Claim: cmpm1ba7205w7sadnjsd1pl0t (openalex_v1, W2152462550)
//   "The measurement of pessimism: The Hopelessness Scale."
//   — Beck AT, Weissman A, Lester D, Trexler L.
//   J Consult Clin Psychol 1974;42(6):861-865 (published 1974). DOI 10.1037/h0037562.
//   Introduced the 20-item Beck Hopelessness Scale (BHS), reporting high internal
//   consistency, concurrent validity against clinical ratings, sensitivity to change,
//   AND a three-component (affective / motivational / cognitive) factor structure
//   extracted by exploratory factor analysis.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1974 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-16):
//   - No retraction and no expression of concern (Crossref carries no crossmark/update
//     markers; is-referenced-by-count 4087). The DOI resolves (doi.apa.org). The scale's
//     core reliability/concurrent-validity claim was broadly upheld (Cronbach's alpha
//     typically 0.82-0.93 across clinical and non-clinical samples).
//   - RECORDED -> CONTESTED: The paper's explicit three-factor structure claim was
//     directly disputed by a specific, dated methodological critique. Aish A-M, Wasserman D,
//     "Does Beck's Hopelessness Scale really measure several components?" (Psychological
//     Medicine 2001;31(2):367-372, DOI 10.1017/s0033291701003300) ran confirmatory factor
//     analyses (LISREL) on 324 Swedish suicide attempters and found that NEITHER the
//     three-factor NOR two-factor model fitted the data; a one-factor (unidimensional)
//     model best explained the item correlations. This launched a sustained dimensionality
//     debate (subsequent CFA work favouring unidimensional/bifactor-with-method-effects
//     solutions over the original three correlated factors), placing the factor-structure
//     component of the 1974 claim into contest. Community EXPERT_LITERATURE.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-beck-1974-hopelessness-scale.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm1ba7205w7sadnjsd1pl0t'

async function main() {
  // ── RECORDED -> CONTESTED: Aish & Wasserman 2001 CFA disputes the three-factor structure ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:aish-wasserman-2001-bhs-factor-structure' },
    create: {
      externalId: 'src:aish-wasserman-2001-bhs-factor-structure',
      name: "Aish A-M, Wasserman D. Does Beck's Hopelessness Scale really measure several components? Psychological Medicine 2001;31(2):367-372. DOI 10.1017/s0033291701003300.",
      url: 'https://doi.org/10.1017/s0033291701003300',
      publishedAt: new Date('2001-02-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: "Aish A-M, Wasserman D. Does Beck's Hopelessness Scale really measure several components? Psychological Medicine 2001;31(2):367-372. DOI 10.1017/s0033291701003300.",
      url: 'https://doi.org/10.1017/s0033291701003300',
      publishedAt: new Date('2001-02-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-2001-02-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2001-02-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
      reason:
        "The 1974 paper reported that exploratory factor analysis extracted three components (affective, motivational, cognitive) from the Beck Hopelessness Scale. Aish & Wasserman (Psychol Med 2001;31(2):367-372) ran confirmatory factor analyses on 324 suicide attempters and found that neither the three-factor nor the two-factor model fitted the data, concluding a one-factor (unidimensional) model best accounts for the items. This specific, dated methodological critique — and the sustained dimensionality debate it anchored — places the factor-structure component of the claim into contest: RECORDED -> CONTESTED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2001-02-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED @ 2001-02, Aish & Wasserman 2001 factor-structure critique)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
