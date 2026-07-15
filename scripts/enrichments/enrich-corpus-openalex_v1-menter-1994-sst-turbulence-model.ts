// Enrichment: epistemic trajectory for Menter 1994 SST turbulence model paper.
//
// Claim: cmq2w44x20039sa8h9o4neled
// "Two-Equation Eddy-Viscosity Turbulence Models for Engineering Applications"
// Menter FR. AIAA Journal. 1994;32(8):1598-1605.
// DOI 10.2514/3.12149 · OpenAlex W1974097079
//
// Identity confirmed via Crossref: title ("Two-equation eddy-viscosity
// turbulence models for engineering applications"), author (Menter), container
// (AIAA Journal), published 1994-08 all match. No retraction, erratum, or
// expression of concern exists (Crossref update-to / updated-by both null).
//
// Post-publication event: this is an engineering-methods contribution (the SST
// k-omega model), so the relevant adjudication is field consensus, not
// replication or meta-analysis. The SST model was adopted as a default/standard
// turbulence closure across commercial and open-source CFD codes over the
// following 15 years. Menter's own peer-reviewed retrospective, "Review of the
// shear-stress transport turbulence model experience from an industrial
// perspective" (Int J Comput Fluid Dyn 2009;23(4):305-316), adjudicates this:
// a dated, highly-cited (~925) document reviewing 15 years of industrial use
// and documenting the model's establishment as an industry-standard closure.
//
// Arc: RECORDED (1994-08) --> SETTLED (2009, EXPERT_LITERATURE)
// The baseline RECORDED row (fromAxis=null) already exists; do NOT duplicate it.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-menter-1994-sst-turbulence-model.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w44x20039sa8h9o4neled'

async function main() {
  // ── SETTLED: SST model established as industry-standard closure ──
  await prisma.source.upsert({
    where: { externalId: 'src:menter-2009-sst-industrial-review' },
    create: {
      externalId: 'src:menter-2009-sst-industrial-review',
      name: 'Menter FR. Review of the shear-stress transport turbulence model experience from an industrial perspective. Int J Comput Fluid Dyn. 2009;23(4):305-316.',
      url: 'https://doi.org/10.1080/10618560902773387',
      publishedAt: new Date('2009-01-01'),
      methodologyType: 'review',
    },
    update: {
      name: 'Menter FR. Review of the shear-stress transport turbulence model experience from an industrial perspective. Int J Comput Fluid Dyn. 2009;23(4):305-316.',
      url: 'https://doi.org/10.1080/10618560902773387',
      publishedAt: new Date('2009-01-01'),
      methodologyType: 'review',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2009-01-01` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2009-01-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-01-01'),
      datePrecision: 'YEAR',
      reason:
        'The SST (shear-stress transport) k-omega model was adopted as a default/standard turbulence closure across commercial and open-source CFD codes in the years after 1994. Menter\'s peer-reviewed retrospective (Int J Comput Fluid Dyn 2009;23(4):305-316) reviews ~15 years of industrial experience and documents the model\'s establishment as an industry-standard closure, adjudicating the finding as settled field consensus. No retraction, erratum, or expression of concern exists for the 1994 paper (Crossref update-to/updated-by both null).',
      source: { connect: { externalId: 'src:menter-2009-sst-industrial-review' } },
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-01-01'),
      datePrecision: 'YEAR',
      reason:
        'The SST (shear-stress transport) k-omega model was adopted as a default/standard turbulence closure across commercial and open-source CFD codes in the years after 1994. Menter\'s peer-reviewed retrospective (Int J Comput Fluid Dyn 2009;23(4):305-316) reviews ~15 years of industrial experience and documents the model\'s establishment as an industry-standard closure, adjudicating the finding as settled field consensus. No retraction, erratum, or expression of concern exists for the 1994 paper (Crossref update-to/updated-by both null).',
      source: { connect: { externalId: 'src:menter-2009-sst-industrial-review' } },
    },
  })

  console.log('Enrichment complete: RECORDED -> SETTLED (2009) for', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
