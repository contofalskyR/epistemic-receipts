// Epistemic receipt enrichment for claim cmpm0b5740et7sat0bng8ugb6
// "The Somatic Genomic Landscape of Glioblastoma" (Brennan et al., Cell, 2013-10; TCGA).
// DOI: 10.1016/j.cell.2013.09.034 · OpenAlex: W2109816625
//
// Baseline row (fromAxis=null -> RECORDED @ 2013-10-01) already exists — NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> SETTLED @ 2016-06 (INSTITUTIONAL)
//     The 2016 WHO Classification of Tumours of the Central Nervous System was the first
//     WHO classification to formally incorporate molecular/genomic markers (notably IDH
//     mutation status) into the diagnostic definition of glioblastoma and diffuse gliomas.
//     This is the field-consensus adoption of the genomic-characterization framework that
//     this TCGA landscape paper established — a genuine institutional consensus shift, not a
//     citation-count inference. No retraction or contest exists (only a minor 2014 erratum).
//
// Idempotent: upserts source on externalId, transition on deterministic id slug.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-somatic-genomic-landscape-glioblastoma.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm0b5740et7sat0bng8ugb6'

async function main() {
  // ── RECORDED -> SETTLED : WHO 2016 CNS tumor classification (institutional consensus) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:who-2016-cns-classification-glioblastoma' },
    update: {},
    create: {
      externalId: 'src:who-2016-cns-classification-glioblastoma',
      name: 'Louis DN, Perry A, Reifenberger G, et al. The 2016 World Health Organization Classification of Tumors of the Central Nervous System: a summary. Acta Neuropathologica. 2016 Jun;131(6):803–820.',
      url: 'https://doi.org/10.1007/s00401-016-1545-1',
      publishedAt: new Date('2016-06-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-corpus-openalex_v1',
    },
  })

  const occurredAt = new Date('2016-06-01')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    update: {},
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        'The 2016 WHO Classification of Tumours of the Central Nervous System was the first WHO classification to formally incorporate molecular/genomic markers — notably IDH mutation status — into the diagnostic definition of glioblastoma and diffuse gliomas. This institutional consensus adopted the genomic-characterization framework that the TCGA somatic genomic landscape of glioblastoma helped establish, moving these findings from a recorded research result into the standard diagnostic classification used clinically worldwide.',
      sourceId: source.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED->SETTLED @ ${slug.slice(-10)})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
