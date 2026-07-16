// Enrichment: post-publication epistemic trajectory for the ACSM Position Stand
// "Exercise and Physical Activity for Older Adults" (Chodzko-Zajko et al., 2009,
// Medicine & Science in Sports & Exercise 41[7]; DOI 10.1249/mss.0b013e3181a0c95c;
// OpenAlex W2084254617).
//
// Baseline row (fromAxis=null -> RECORDED at 2009-06-16) already exists; do NOT
// duplicate it. This script adds the one verified follow-up transition.
//
// Arc added:
//   RECORDED -> SETTLED (2018-11-20, INSTITUTIONAL)
//     The position stand's central conclusion — that structured exercise and
//     physical activity confer substantial benefit to older adults and can
//     favorably influence the aging process — was codified into evidence-graded
//     US federal clinical guidance by the 2nd edition of the Physical Activity
//     Guidelines for Americans (Piercy et al., JAMA 2018), which carries a
//     dedicated older-adult recommendation set (aerobic, muscle-strengthening,
//     and multicomponent/balance activity). This marks field-consensus settling
//     of the finding in an institutional guideline. (Reaffirmed globally by the
//     WHO 2020 guidelines on physical activity and sedentary behaviour.)
//
// Idempotent: upserts on stable externalId / id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-exercise-physical-activity-older-adults-2009.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm3nxae19fvsadneehgm2kg'

async function main() {
  // ── RECORDED -> SETTLED : 2018 Physical Activity Guidelines for Americans (2nd ed.) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:pag-americans-2018' },
    update: {},
    create: {
      externalId: 'src:pag-americans-2018',
      name: 'Piercy KL, Troiano RP, Ballard RM, et al. The Physical Activity Guidelines for Americans. JAMA. 2018;320(19):2020-2028.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/30418471/',
      publishedAt: new Date('2018-11-20'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-corpus-openalex_v1',
    },
  })

  const occurredAt = new Date('2018-11-20')
  const toAxis = 'SETTLED'
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    update: {},
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'DAY',
      sourceId: source.id,
      reason:
        "The 2nd edition of the Physical Activity Guidelines for Americans (Piercy et al., JAMA 2018) codified the position stand's central conclusion into evidence-graded US federal clinical guidance, issuing a dedicated older-adult recommendation set (aerobic, muscle-strengthening, and multicomponent/balance activity to reduce fall risk and preserve function). Inclusion in this institutional guideline settles the finding that structured exercise benefits older adults and can favorably influence the aging process. It was reaffirmed globally by the WHO 2020 guidelines on physical activity and sedentary behaviour.",
    },
  })

  console.log(`Upserted transition ${slug} (source ${source.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
