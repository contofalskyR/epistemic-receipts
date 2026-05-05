// Adds two things from the SSCP Final Report findings:
// 1. New claim: "NIH funded gain-of-function research at WIV" with SourceRelationship graph
// 2. MetaEdge: SSCP LABELED the Lancet statement edge (lab origin = not a conspiracy theory)
// Run: npx tsx scripts/add-nih-funding-claim-and-lancet-metaedge.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const REVIEW = {
  ingestedBy:       'manual',
  humanReviewed:    true,
  reviewConfidence: 'HIGH' as const,
  reviewedBy:       'robert',
  reviewedAt:       new Date(),
}

// IDs from existing DB
const PARENT_CLAIM_ID = 'cmoqm2czi0000xn7jvsg8zwow'
const LANCET_EDGE_ID  = 'cmoqm2d3w0008xn7j6a8l39a6'
const SSCP_SOURCE_ID  = 'cmorj0i6l00008ovamqireoj1'

async function main() {

  // ── 1. Source records for the funding network ────────────────────────────

  const nih = await prisma.source.create({ data: {
    name:            'National Institutes of Health (NIH)',
    url:             'https://www.nih.gov',
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const ecohealth = await prisma.source.create({ data: {
    name:            'EcoHealth Alliance, Inc.',
    url:             'https://www.ecohealthalliance.org',
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const wiv = await prisma.source.create({ data: {
    name:            'Wuhan Institute of Virology (WIV)',
    methodologyType: 'primary',
    ...REVIEW,
  }})

  console.log(`Created sources: NIH=${nih.id} EcoHealth=${ecohealth.id} WIV=${wiv.id}`)

  // ── 2. SourceRelationship graph: NIH → EcoHealth → WIV ──────────────────

  await prisma.sourceRelationship.create({
    data: { sourceAId: nih.id, sourceBId: ecohealth.id, type: 'funder_of' },
  })
  await prisma.sourceRelationship.create({
    data: { sourceAId: ecohealth.id, sourceBId: wiv.id, type: 'funder_of' },
  })
  await prisma.sourceRelationship.create({
    data: { sourceAId: ecohealth.id, sourceBId: wiv.id, type: 'affiliated_with' },
  })

  console.log('Created SourceRelationship: NIH → EcoHealth → WIV')

  // ── 3. New claim: NIH gain-of-function funding ───────────────────────────

  const nihClaim = await prisma.claim.create({ data: {
    text:                  'NIH funded gain-of-function research at the Wuhan Institute of Virology through EcoHealth Alliance grants',
    claimType:             'EMPIRICAL',
    currentStatus:         'DISPUTED',
    claimEmergedAt:        new Date('2021-05-01'),
    claimEmergedPrecision: 'MONTH',
    parentClaimId:         PARENT_CLAIM_ID,
    ...REVIEW,
  }})

  console.log(`Created claim: ${nihClaim.id}`)

  // SSCP as FOR edge (congressional finding)
  const sscpEdge = await prisma.edge.create({
    data: {
      sourceId:     SSCP_SOURCE_ID,
      claimId:      nihClaim.id,
      type:         'FOR',
      evidenceType: 'EVIDENTIARY',
      ...REVIEW,
    },
  })
  await prisma.edgeRevision.create({
    data: {
      edgeId:     sscpEdge.id,
      priorScore: null,
      newScore:   72,
      reason:     'SSCP bipartisan finding: "The U.S. National Institutes of Health funded gain-of-function research at the Wuhan Institute of Virology." ' +
                  'One of the explicit numbered findings in the final report. ' +
                  'Bipartisan endorsement raises weight above majority-only findings.',
    },
  })
  console.log(`Created edge SSCP → nihClaim (FOR, score 72)`)

  // Tag the new claim
  try {
    const pandemicTopic = await prisma.topic.findUnique({ where: { slug: 'pandemic-origins' } })
    if (pandemicTopic) {
      await prisma.claimTopic.create({ data: { claimId: nihClaim.id, topicId: pandemicTopic.id } })
      console.log('Tagged: pandemic-origins')
    }
  } catch { /* topic may not exist */ }

  // ── 4. MetaEdge: SSCP LABELED the Lancet edge ───────────────────────────
  // The Lancet statement called lab origin claims "conspiracy theories."
  // The SSCP found bipartisan consensus that lab origin is NOT a conspiracy theory —
  // a formal institutional labeling of the Lancet framing as politically motivated.

  await prisma.metaEdge.create({ data: {
    actorSourceId: SSCP_SOURCE_ID,
    targetEdgeId:  LANCET_EDGE_ID,
    claimId:       PARENT_CLAIM_ID,
    type:          'LABELED',
    reason:        'SSCP bipartisan consensus finding: "The possibility that COVID-19 emerged because of a laboratory or research related accident is not a conspiracy theory." ' +
                   'The Lancet statement (Calisher et al., Feb 2020) explicitly used the term "conspiracy theories" to describe lab-origin claims. ' +
                   'This is a formal congressional counter-labeling of that framing — bipartisan, issued December 2024 after review of 1M+ pages of documents and 38 depositions. ' +
                   'Structurally distinct from disagreement: SSCP is not contesting the genomic analysis; it is contesting the delegitimization framing used by the Lancet signatories.',
    createdAt:     new Date('2024-12-04'),
    ...REVIEW,
  }})

  console.log('Created MetaEdge: SSCP LABELED Lancet edge')
  console.log('\nDone.')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
