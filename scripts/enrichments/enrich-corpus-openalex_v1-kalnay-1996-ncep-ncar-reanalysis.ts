// Enrichment: post-publication epistemic arc for the NCEP/NCAR 40-Year
// Reanalysis Project announcement paper.
//
// Claim: cmq2w41uh001lsa8htoxg7dzw (openalex_v1, W2173251738)
//   "The NCEP and NCAR are cooperating in a project (denoted 'reanalysis') to produce
//   a 40-year record of global analyses of atmospheric fields ... quality controlling
//   and assimilating these data with a data assimilation system that is kept unchanged
//   over the reanalysis period 1957-96. This eliminates perceived climate [jumps] ..."
//   — Kalnay E, et al. "The NCEP/NCAR 40-Year Reanalysis Project." Bulletin of the
//   American Meteorological Society 1996;77(3):437-471.
//   DOI 10.1175/1520-0477(1996)077<0437:tnyrp>2.0.co;2. Published 1996-03.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1996-03-01) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref + DOI resolution):
//   - No retraction and no expression of concern on the paper (Crossref is-retracted:
//     none; update-to / updated-by / relation: empty). Paper identity confirmed against
//     the supplied DOI and OpenAlex ID (BAMS 77(3):437-471, Kalnay first author).
//   - RECORDED -> CONTESTED: Sturaro (Climate Dynamics 2003;21:309-316,
//     DOI 10.1007/s00382-003-0334-4) — a single-author study independent of the NCEP/NCAR
//     team — documented distinct climatological discontinuities in the reanalysis
//     temperature field coincident with the 1979 introduction of satellite (TOVS) data.
//     This directly disputes the paper's central methodological promise: while the data
//     assimilation *system* was deliberately held unchanged to "eliminate perceived climate
//     jumps," the *observing system* changed over the period, and that change reintroduced
//     exactly the kind of spurious, non-climatic jumps the fixed-model design was meant to
//     remove. This specific, dated, on-point empirical critique placed the claim's core
//     assertion in active expert dispute.
//
// No CONTESTED -> SETTLED transition is added: the satellite-era discontinuity is an
// accepted, unresolved known limitation of NCEP/NCAR Reanalysis-1 (addressed only by
// successor products such as R-2, ERA-40, and ERA5), not something a later adjudicating
// document settled in favor of the original claim. One verified transition is recorded
// rather than a speculative multi-step arc.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kalnay-1996-ncep-ncar-reanalysis.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w41uh001lsa8htoxg7dzw'

async function main() {
  // ── RECORDED -> CONTESTED: Sturaro satellite-era discontinuity critique (2003) ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:sturaro-2003-ncep-ncar-satellite-discontinuity' },
    create: {
      externalId: 'src:sturaro-2003-ncep-ncar-satellite-discontinuity',
      name: 'Sturaro G. A closer look at the climatological discontinuities present in the NCEP/NCAR reanalysis temperature due to the introduction of satellite data. Climate Dynamics 2003;21:309-316. DOI 10.1007/s00382-003-0334-4.',
      url: 'https://doi.org/10.1007/s00382-003-0334-4',
      publishedAt: new Date('2003-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Sturaro G. A closer look at the climatological discontinuities present in the NCEP/NCAR reanalysis temperature due to the introduction of satellite data. Climate Dynamics 2003;21:309-316. DOI 10.1007/s00382-003-0334-4.',
      url: 'https://doi.org/10.1007/s00382-003-0334-4',
      publishedAt: new Date('2003-09-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-2003-09-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2003-09-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
      reason:
        'Sturaro (Climate Dynamics 2003;21:309-316), independent of the NCEP/NCAR team, documented distinct discontinuities in the reanalysis temperature field coincident with the 1979 introduction of satellite (TOVS) data. This directly disputes the paper\'s central promise that holding the data assimilation system unchanged over 1957-96 "eliminates perceived climate jumps": because the observing system itself changed, spurious non-climatic jumps reappeared in the record. This specific, dated, on-point critique placed the core methodological claim in active expert dispute: RECORDED -> CONTESTED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2003-09-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED @ 2003-09)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
