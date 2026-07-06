// Enrich: Herschel (1801) "Observations tending to investigate the Nature of
// the Sun..." — William Herschel's argument that the Sun is a "most magnificent
// habitable globe" whose sunspot-tracked variability influences Earth (evidenced
// by his claimed anti-correlation between few sunspots and high wheat prices).
//
// Post-publication arc: the empirical core of the paper — the sunspot / wheat-
// price correlation Herschel offered as proof of the Sun's influence on Earth —
// was directly re-analysed with modern statistics by Jeffrey J. Love (USGS) in
// "On the insignificance of Herschel's sunspot correlation," Geophysical
// Research Letters 40(16):4171–4176 (Aug 2013). Love found the correlations
// between sunspot number and wheat price/yield to be statistically
// insignificant — very likely realizations of random data — overturning
// Herschel's central inference. The paper's other premise, that the Sun is a
// cool, solid, inhabited globe beneath luminous clouds, is likewise rejected by
// modern astrophysics. This is a dated, citable overturning → RECORDED -> REVERSED.
//
// The baseline (fromAxis=null -> RECORDED, 1801-12-31) already exists; do NOT
// duplicate it. Idempotent: upserts on stable ids.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-herschel-nature-of-sun-1801.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq3r28q18711savc2yczodwl'

async function main() {
  // ── RECORDED -> REVERSED: Love (2013) finds Herschel's correlation insignificant ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:love-herschel-sunspot-insignificance-2013' },
    create: {
      externalId: 'src:love-herschel-sunspot-insignificance-2013',
      name: "Love J.J. On the insignificance of Herschel's sunspot correlation. Geophysical Research Letters 2013;40(16):4171–4176.",
      url: 'https://doi.org/10.1002/grl.50846',
      publishedAt: new Date('2013-08-01'),
      methodologyType: 'reanalysis',
      ingestedBy: 'enrich:openalex_v1',
    },
    update: {
      name: "Love J.J. On the insignificance of Herschel's sunspot correlation. Geophysical Research Letters 2013;40(16):4171–4176.",
      url: 'https://doi.org/10.1002/grl.50846',
      publishedAt: new Date('2013-08-01'),
      methodologyType: 'reanalysis',
    },
  })

  const slug = `${CLAIM_ID}-REVERSED-2013-08-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'REVERSED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-08-01'),
      datePrecision: 'MONTH',
      reason:
        "Herschel offered an anti-correlation between scarce sunspots and high English wheat prices as empirical proof of the Sun's controlling influence on Earth. Jeffrey J. Love (USGS) re-analysed the same relationship with modern statistical methods and found the correlations between sunspot number and wheat price/yield to be statistically insignificant — very likely realizations of random data — concluding the hypothesis must be regarded with skepticism. This overturns the paper's central empirical inference; its companion premise that the Sun is a cool, solid, inhabited globe is independently rejected by modern astrophysics.",
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'REVERSED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-08-01'),
      datePrecision: 'MONTH',
      reason:
        "Herschel offered an anti-correlation between scarce sunspots and high English wheat prices as empirical proof of the Sun's controlling influence on Earth. Jeffrey J. Love (USGS) re-analysed the same relationship with modern statistical methods and found the correlations between sunspot number and wheat price/yield to be statistically insignificant — very likely realizations of random data — concluding the hypothesis must be regarded with skepticism. This overturns the paper's central empirical inference; its companion premise that the Sun is a cool, solid, inhabited globe is independently rejected by modern astrophysics.",
      sourceId: source.id,
    },
  })

  console.log('Enriched claim', CLAIM_ID, '-> REVERSED (Love 2013)')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
