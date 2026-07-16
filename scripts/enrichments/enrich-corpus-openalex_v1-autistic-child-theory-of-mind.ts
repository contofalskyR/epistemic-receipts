import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Claim: "Does the autistic child have a 'theory of mind'?"
//   Baron-Cohen, Leslie & Frith (1985), Cognition, DOI 10.1016/0010-0277(85)90022-8
//   OpenAlex W2093410327 | claim id cmpm196fv04wpsadnh7e9b3lv
//
// The baseline row (fromAxis=null -> RECORDED at 1985-10) already exists; do NOT duplicate it.
// This script adds ONE verified post-publication transition:
//   RECORDED -> CONTESTED (2019-12-09) via Gernsbacher & Yergeau, a direct empirical
//   refutation of the "autistic people lack a theory of mind" claim.
// No retraction or expression of concern exists (Crossref update-to: null; PubMed: none).

const CLAIM_ID = 'cmpm196fv04wpsadnh7e9b3lv'

async function main() {
  // ── RECORDED -> CONTESTED: Gernsbacher & Yergeau (2019) empirical refutation ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:gernsbacher-yergeau-2019-tom-empirical-failures' },
    create: {
      externalId: 'src:gernsbacher-yergeau-2019-tom-empirical-failures',
      name: 'Gernsbacher MA, Yergeau M. "Empirical Failures of the Claim That Autistic People Lack a Theory of Mind." Archives of Scientific Psychology 7(1):102–118 (2019). PMID 31938672; DOI 10.1037/arc0000067.',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6959478/',
      publishedAt: new Date('2019-12-09'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1-autistic-child-theory-of-mind',
    },
    update: {
      name: 'Gernsbacher MA, Yergeau M. "Empirical Failures of the Claim That Autistic People Lack a Theory of Mind." Archives of Scientific Psychology 7(1):102–118 (2019). PMID 31938672; DOI 10.1037/arc0000067.',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6959478/',
      publishedAt: new Date('2019-12-09'),
    },
  })

  const occurredAt = new Date('2019-12-09')
  const histId = `${CLAIM_ID}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`
  const reason =
    'Gernsbacher and Yergeau systematically reviewed three decades of evidence and argued that the theory-of-mind deficit account originating with Baron-Cohen, Leslie and Frith (1985) fails to replicate reliably, is not specific to autism, and rests on false-belief tasks that confound language and executive demands. Published as "Empirical Failures of the Claim That Autistic People Lack a Theory of Mind," it—alongside the parallel "double empathy" critique (Milton, 2012)—marked a substantive expert-literature contest, moving the finding from settled record to actively disputed rather than overturning it outright.'

  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason,
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason,
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({
    where: { claimId: CLAIM_ID, sourceId: source.id },
  })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
  }

  console.log(`✓ ${CLAIM_ID}: added RECORDED->CONTESTED (2019-12-09) via ${source.externalId}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
