// Enrichment: epistemic trajectory for Boschma R. A. (2005)
// "Proximity and innovation: a critical assessment", Regional Studies 39(1):61–74.
// DOI 10.1080/0034340052000320887 · OpenAlex W2129208071 · Claim cmpm1p3ns0ccpsadnh7nwzc78
//
// Boschma's paper is a conceptual contribution: the "five proximities" framework
// (cognitive, organizational, social, institutional, geographical) and the argument
// that geographical proximity is neither necessary nor sufficient for interactive
// learning and must be assessed relative to other proximity dimensions that can
// substitute for it (with the "proximity paradox": too much proximity harms
// innovation via lock-in). There is NO retraction, expression of concern, or failed
// replication. The single post-publication adjudicating event added here is a
// peer-reviewed systematic literature review — Wilke & Pyka (2024), Journal of
// Economic Surveys — that synthesizes ~two decades of empirical work around exactly
// these five dimensions and confirms both the dimensions and their interdependencies
// (reinforcement and substitution) as the field's established analytical framework.
// This is treated as RECORDED -> SETTLED (vindication), not a contest.
//
// The baseline row (fromAxis=null -> RECORDED at the 2005 publication date) already
// exists; this script does NOT duplicate it and does NOT create a new Claim.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-boschma-2005-proximity-innovation.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm1p3ns0ccpsadnh7nwzc78'

async function main() {
  // ── RECORDED -> SETTLED · Wilke & Pyka (2024) systematic literature review ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:wilke-pyka-2024-proximity-systematic-review' },
    create: {
      externalId: 'src:wilke-pyka-2024-proximity-systematic-review',
      name: 'Wilke U, Pyka A. Sustainable innovations, knowledge and the role of proximity: A systematic literature review. Journal of Economic Surveys 2025;39(1) (first published online 8 March 2024). doi:10.1111/joes.12617',
      url: 'https://doi.org/10.1111/joes.12617',
      publishedAt: new Date('2024-03-08'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-boschma-2005-proximity-innovation',
    },
    update: {
      name: 'Wilke U, Pyka A. Sustainable innovations, knowledge and the role of proximity: A systematic literature review. Journal of Economic Surveys 2025;39(1) (first published online 8 March 2024). doi:10.1111/joes.12617',
      url: 'https://doi.org/10.1111/joes.12617',
      publishedAt: new Date('2024-03-08'),
    },
  })

  const occurredAt = '2024-03-08'
  const toAxis = 'SETTLED'
  const histId = `${CLAIM_ID}-${toAxis}-${occurredAt.slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date(occurredAt),
      datePrecision: 'DAY',
      reason:
        "A systematic literature review in the Journal of Economic Surveys (Wilke & Pyka, first published online 8 March 2024) synthesizes empirical work organized explicitly around Boschma's five proximity dimensions (geographical, cognitive, institutional, organizational, social). It concludes that all five dimensions and, crucially, the interdependencies between them govern knowledge flows — operating through reinforcement and substitution mechanisms — thereby vindicating Boschma's core argument that geographical proximity cannot be assessed in isolation. The review's adoption of the framework as the field's standard analytical lens marks it as settled rather than merely widely cited.",
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date(occurredAt),
      datePrecision: 'DAY',
      reason:
        "A systematic literature review in the Journal of Economic Surveys (Wilke & Pyka, first published online 8 March 2024) synthesizes empirical work organized explicitly around Boschma's five proximity dimensions (geographical, cognitive, institutional, organizational, social). It concludes that all five dimensions and, crucially, the interdependencies between them govern knowledge flows — operating through reinforcement and substitution mechanisms — thereby vindicating Boschma's core argument that geographical proximity cannot be assessed in isolation. The review's adoption of the framework as the field's standard analytical lens marks it as settled rather than merely widely cited.",
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({
    where: { claimId: CLAIM_ID, sourceId: source.id },
  })
  if (!existingEdge) {
    await prisma.edge.create({
      data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' },
    })
  }

  console.log(`  ✓ ${CLAIM_ID} — added RECORDED->SETTLED (${occurredAt})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
