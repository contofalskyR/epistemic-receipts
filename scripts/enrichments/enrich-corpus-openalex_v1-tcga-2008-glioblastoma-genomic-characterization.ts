import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   The Cancer Genome Atlas Research Network (2008), "Comprehensive genomic
//   characterization defines human glioblastoma genes and core pathways,"
//   Nature 455(7216): 1061-1068.
//   DOI: 10.1038/nature07385 · OpenAlex: W2025183726
//
// Baseline row (fromAxis=null -> RECORDED at 2008-09-04) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2013-10): Brennan et al., "The Somatic Genomic
//   Landscape of Glioblastoma," Cell 155(2): 462-477 (DOI 10.1016/j.cell.2013.09.034).
//   The 2008 paper was the TCGA pilot, whose explicit stated aim was "to assess
//   the value of large-scale multi-dimensional analysis" of cancer genomes.
//   Brennan et al. (2013) is the definitive full-scale TCGA glioblastoma study
//   (n=543), which confirmed and extended the pilot's copy-number, expression,
//   and methylation findings and the RTK/RAS/PI3K, p53 and RB core pathways —
//   vindicating the pilot's central premise at scale. The finding was
//   broadly validated (not contested/overturned): terminal state SETTLED.
//   Intermediate validation: Verhaak et al. (2010), Cancer Cell 17(1): 98-110
//   (DOI 10.1016/j.ccr.2009.12.020), which used TCGA GBM data to define the
//   four clinically relevant molecular subtypes.

const CLAIM_ID = 'cmplyhco806drsaihkgjndcwn'

async function main() {
  // ── RECORDED -> SETTLED: Brennan et al. (2013) full-scale TCGA GBM analysis ──
  const brennan = await prisma.source.upsert({
    where: { externalId: 'src:brennan-2013-somatic-genomic-landscape-glioblastoma' },
    create: {
      externalId: 'src:brennan-2013-somatic-genomic-landscape-glioblastoma',
      name: 'Brennan, C. W. et al. (The Cancer Genome Atlas Research Network) (2013). "The Somatic Genomic Landscape of Glioblastoma." Cell 155(2): 462-477.',
      url: 'https://doi.org/10.1016/j.cell.2013.09.034',
      publishedAt: new Date('2013-10-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-tcga-2008-glioblastoma',
    },
    update: {
      name: 'Brennan, C. W. et al. (The Cancer Genome Atlas Research Network) (2013). "The Somatic Genomic Landscape of Glioblastoma." Cell 155(2): 462-477.',
      url: 'https://doi.org/10.1016/j.cell.2013.09.034',
      publishedAt: new Date('2013-10-01'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2013-10-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-10-01'),
      datePrecision: 'MONTH',
      reason: 'The 2008 paper was the TCGA pilot, whose declared aim was "to assess the value of large-scale multi-dimensional analysis" of cancer molecular characteristics. Brennan et al. (2013), the definitive full-scale TCGA glioblastoma study (n=543) published in Cell, confirmed and extended the pilot\'s integrated copy-number, expression and methylation findings and its RTK/RAS/PI3K, p53 and RB core-pathway model, vindicating the pilot\'s central premise at scale. Together with Verhaak et al. (2010), which used the same TCGA data to define four clinically relevant molecular subtypes, the pilot\'s approach was broadly validated rather than contested, marking a settled consensus that multi-dimensional genomic characterization delineates the biology of glioblastoma.',
      sourceId: brennan.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-10-01'),
      datePrecision: 'MONTH',
      reason: 'The 2008 paper was the TCGA pilot, whose declared aim was "to assess the value of large-scale multi-dimensional analysis" of cancer molecular characteristics. Brennan et al. (2013), the definitive full-scale TCGA glioblastoma study (n=543) published in Cell, confirmed and extended the pilot\'s integrated copy-number, expression and methylation findings and its RTK/RAS/PI3K, p53 and RB core-pathway model, vindicating the pilot\'s central premise at scale. Together with Verhaak et al. (2010), which used the same TCGA data to define four clinically relevant molecular subtypes, the pilot\'s approach was broadly validated rather than contested, marking a settled consensus that multi-dimensional genomic characterization delineates the biology of glioblastoma.',
      sourceId: brennan.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: brennan.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: brennan.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via Brennan et al. 2013)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
