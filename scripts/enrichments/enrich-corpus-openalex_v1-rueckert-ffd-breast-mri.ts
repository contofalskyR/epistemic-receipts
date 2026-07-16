// Epistemic-receipt enrichment for Rueckert et al. 1999,
// "Nonrigid registration using free-form deformations: application to breast MR images"
// IEEE Transactions on Medical Imaging. DOI 10.1109/42.796284 · OpenAlex W2113576511.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 1999
// publication date) already exists and is NOT recreated here.
//
// This adds the single verified post-publication arc:
//   RECORDED -> SETTLED (2013-07)
// The claim is a methods claim (B-spline free-form deformation for nonrigid
// registration). No retraction or expression of concern exists (Crossref
// update-to / updated-by are both null; not present in Retraction Watch). There
// was never a contest, so the transition is a direct RECORDED -> SETTLED at the
// point the field's canonical survey adjudicated FFD/B-splines as a standard
// transformation model.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rueckert-ffd-breast-mri.ts
// Dry-run: (idempotent upserts on externalId / id)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5mr500zrsa8hxn1up98c'

async function main() {
  // ── RECORDED -> SETTLED ──
  // Field-consensus adjudication (category 4). Sotiras, Davatzikos & Paragios,
  // "Deformable Medical Image Registration: A Survey" (IEEE TMI, July 2013), the
  // field's authoritative review, states that "Free-Form Deformations (FFDs) is
  // one of the most common types of transformation models in medical image
  // registration" and treats Rueckert et al.'s cubic B-spline FFD as a
  // foundational, standard model.
  const source = await prisma.source.upsert({
    where: { externalId: 'src:sotiras-deformable-registration-survey-2013' },
    create: {
      externalId: 'src:sotiras-deformable-registration-survey-2013',
      name: 'Sotiras A, Davatzikos C, Paragios N. Deformable Medical Image Registration: A Survey. IEEE Transactions on Medical Imaging. 2013;32(7):1153–1190.',
      url: 'https://doi.org/10.1109/TMI.2013.2265603',
      publishedAt: new Date('2013-07-01'),
      methodologyType: 'derivative',
      ingestedBy: 'openalex_v1',
    },
    update: {
      name: 'Sotiras A, Davatzikos C, Paragios N. Deformable Medical Image Registration: A Survey. IEEE Transactions on Medical Imaging. 2013;32(7):1153–1190.',
      url: 'https://doi.org/10.1109/TMI.2013.2265603',
      publishedAt: new Date('2013-07-01'),
      methodologyType: 'derivative',
    },
  })

  const occurredAt = new Date('2013-07-01')
  const toAxis = 'SETTLED'
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

  const reason =
    'The field\'s canonical survey of deformable medical image registration (Sotiras, Davatzikos & Paragios, IEEE Transactions on Medical Imaging, July 2013) classifies free-form deformations as "one of the most common types of transformation models in medical image registration" and treats Rueckert et al.\'s cubic B-spline FFD as a foundational standard model. Its adoption as a de facto standard transformation model across the registration literature marks the method as settled expert consensus rather than a novel proposal. No retraction, expression of concern, or methodological reversal exists.'

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason,
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason,
      sourceId: source.id,
    },
  })

  console.log(`Upserted ${toAxis} transition ${slug} (source ${source.id})`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
