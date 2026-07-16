// Enrichment: post-publication epistemic trajectory for
// "A dipole mode in the tropical Indian Ocean"
// Saji NH, Goswami BN, Vinayachandran PN, Yamagata T. Nature 1999;401:360–363.
// DOI 10.1038/43854 · OpenAlex W2082001988
//
// This is the foundational paper introducing the Indian Ocean Dipole (IOD) as a
// coupled ocean–atmosphere mode of the tropical Indian Ocean, independent of ENSO.
//
// Baseline RECORDED transition (fromAxis=null -> RECORDED at 1999-09-01) already
// exists and is NOT duplicated here.
//
// Post-publication events added:
//   RECORDED -> CONTESTED (2002-01, EXPERT_LITERATURE)
//     Dommenget & Latif argued that dipole-like patterns extracted by EOF /
//     rotated-EOF analysis of tropical ocean SST — explicitly including the
//     tropical Indian Ocean dipole — can arise as statistical artifacts of the
//     eigenvector decomposition rather than reflecting a distinct physical mode.
//     This directly challenged whether the IOD was an independent coupled mode as
//     Saji et al. claimed, or a statistical construct partly slaved to ENSO.
//     Dommenget D, Latif M. "A Cautionary Note on the Interpretation of EOFs."
//     Journal of Climate 2002;15(2):216–225.
//
//   CONTESTED -> SETTLED (2009-01-27, EXPERT_LITERATURE)
//     Schott, Xie & McCreary's comprehensive Reviews of Geophysics survey
//     consolidated a decade of observational and modeling evidence establishing
//     the Indian Ocean Dipole as a genuine coupled ocean–atmosphere mode with its
//     own Bjerknes-type feedback dynamics, distinct from — though interacting with
//     — ENSO. The review reflects the field consensus that vindicated the core
//     claim of Saji et al. Schott FA, Xie S-P, McCreary JP Jr. "Indian Ocean
//     circulation and climate variability." Reviews of Geophysics 2009;47:RG1002.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-saji-indian-ocean-dipole.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmq2w5imu00x9sa8hilrsui28'

async function main() {
  // ── RECORDED -> CONTESTED : Dommenget & Latif EOF cautionary note (2002) ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:dommenget-latif-cautionary-note-eofs-2002' },
    create: {
      externalId: 'src:dommenget-latif-cautionary-note-eofs-2002',
      name: 'Dommenget D, Latif M. "A Cautionary Note on the Interpretation of EOFs." Journal of Climate 2002;15(2):216–225.',
      url: 'https://doi.org/10.1175/1520-0442(2002)015%3C0216:ACNOTI%3E2.0.CO;2',
      publishedAt: new Date('2002-01-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Dommenget D, Latif M. "A Cautionary Note on the Interpretation of EOFs." Journal of Climate 2002;15(2):216–225.',
      url: 'https://doi.org/10.1175/1520-0442(2002)015%3C0216:ACNOTI%3E2.0.CO;2',
      publishedAt: new Date('2002-01-01'),
    },
  })

  {
    const occurredAt = new Date('2002-01-01')
    const slug = `${claimId}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      'Dommenget and Latif argued that dipole-like patterns extracted by EOF and rotated-EOF analysis of tropical ocean SST — explicitly including the tropical Indian Ocean dipole introduced by Saji et al. — can be statistical artifacts of the eigenvector decomposition rather than a distinct physical mode of variability. This challenged whether the Indian Ocean Dipole was an independent coupled ocean–atmosphere mode, or a construct partly slaved to ENSO, opening a substantive dispute over the physical reality of the mode.'

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: contestSource.id,
      },
      update: {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: contestSource.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: contestSource.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: contestSource.id, type: 'AGAINST' } })
    }
  }

  // ── CONTESTED -> SETTLED : Schott, Xie & McCreary consolidating review (2009) ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:schott-xie-mccreary-indian-ocean-review-2009' },
    create: {
      externalId: 'src:schott-xie-mccreary-indian-ocean-review-2009',
      name: 'Schott FA, Xie S-P, McCreary JP Jr. "Indian Ocean circulation and climate variability." Reviews of Geophysics 2009;47:RG1002.',
      url: 'https://doi.org/10.1029/2007RG000245',
      publishedAt: new Date('2009-01-27'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Schott FA, Xie S-P, McCreary JP Jr. "Indian Ocean circulation and climate variability." Reviews of Geophysics 2009;47:RG1002.',
      url: 'https://doi.org/10.1029/2007RG000245',
      publishedAt: new Date('2009-01-27'),
    },
  })

  {
    const occurredAt = new Date('2009-01-27')
    const slug = `${claimId}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      "Schott, Xie & McCreary's comprehensive Reviews of Geophysics survey consolidated a decade of observational and modeling evidence establishing the Indian Ocean Dipole as a genuine coupled ocean–atmosphere mode of the tropical Indian Ocean, with its own Bjerknes-type feedback dynamics, distinct from though interacting with ENSO. The review reflects the field consensus that resolved the earlier EOF-artifact dispute and vindicated the core claim of Saji et al. that a dipole mode operates in the tropical Indian Ocean."

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason,
        sourceId: settleSource.id,
      },
      update: {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason,
        sourceId: settleSource.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: settleSource.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: settleSource.id, type: 'FOR' } })
    }
  }

  console.log(
    `  ✓ enriched ${claimId} (+2 transitions: RECORDED -> CONTESTED 2002-01, CONTESTED -> SETTLED 2009-01-27)`,
  )
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
