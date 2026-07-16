import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Greenwald, A.G., & Banaji, M.R. (1995), "Implicit social cognition:
//   Attitudes, self-esteem, and stereotypes," Psychological Review 102(1): 4-27.
//   DOI: 10.1037/0033-295x.102.1.4 · OpenAlex: W1965514675
//
// Baseline row (fromAxis=null -> RECORDED at 1995-01-01) already exists; do NOT
// duplicate it. This paper launched the "implicit social cognition" program,
// arguing that attitudes, self-esteem, and stereotypes have important implicit
// (unconscious) modes of operation. There is no retraction or expression of
// concern. The post-publication arc is a METHODOLOGICAL CONTEST over the central
// practical pillar of the claim — that implicitly-measured constructs have
// *important* behavioral consequences.
//
//   RECORDED -> CONTESTED  (Oswald, Mitchell, Blanton, Jaccard & Tetlock (2013),
//     "Predicting ethnic and racial discrimination: A meta-analysis of IAT
//     criterion studies," JPSP 105(2):171-192, DOI 10.1037/a0032734. This
//     meta-analysis found Implicit Association Test scores were weak and unreliable
//     predictors of discriminatory behavior, directly challenging the claim that
//     implicit attitudes/stereotypes operate in *important* behavioral ways.
//     Corroborated by Forscher et al. (2019), "A meta-analysis of procedures to
//     change implicit measures," JPSP 117(3):522-559, DOI 10.1037/pspa0000160,
//     which found that changing implicit measures does not reliably change behavior.)
//
// The existence of implicit cognition is not reversed; what is contested is its
// behavioral-predictive importance. This is an expert-literature adjudication,
// hence community EXPERT_LITERATURE. A single, well-anchored transition.

const CLAIM_ID = 'cmpm1ssd80e2jsadnwbwjwijn'

async function main() {
  // ── RECORDED -> CONTESTED: Oswald et al. (2013) IAT criterion meta-analysis ──
  const oswald = await prisma.source.upsert({
    where: { externalId: 'src:oswald-2013-iat-criterion-meta-analysis' },
    create: {
      externalId: 'src:oswald-2013-iat-criterion-meta-analysis',
      name: 'Oswald, F.L., Mitchell, G., Blanton, H., Jaccard, J., & Tetlock, P.E. (2013). Predicting ethnic and racial discrimination: A meta-analysis of IAT criterion studies. Journal of Personality and Social Psychology, 105(2), 171-192.',
      url: 'https://doi.org/10.1037/a0032734',
      publishedAt: new Date('2013-08-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-greenwald-1995-implicit-social-cognition',
    },
    update: {
      name: 'Oswald, F.L., Mitchell, G., Blanton, H., Jaccard, J., & Tetlock, P.E. (2013). Predicting ethnic and racial discrimination: A meta-analysis of IAT criterion studies. Journal of Personality and Social Psychology, 105(2), 171-192.',
      url: 'https://doi.org/10.1037/a0032734',
      publishedAt: new Date('2013-08-01'),
    },
  })

  const contestedId = `${CLAIM_ID}-CONTESTED-2013-08-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-08-01'),
      datePrecision: 'MONTH',
      reason: 'Oswald et al. (2013) meta-analyzed the criterion studies of the Implicit Association Test — the dominant operationalization of the implicit attitudes and stereotypes this paper theorized — and found IAT scores were weak, unreliable predictors of ethnic and racial discrimination. This directly contested the claim that implicit modes of operation are behaviorally *important*, opening a sustained methodological debate reinforced by Forscher et al. (2019), whose meta-analysis found that changing implicit measures does not reliably change behavior. The existence of implicit cognition was not overturned, but its predictive significance became actively disputed in the expert literature.',
      sourceId: oswald.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2013-08-01'),
      datePrecision: 'MONTH',
      sourceId: oswald.id,
    },
  })

  const oswaldEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: oswald.id } })
  if (!oswaldEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: oswald.id, type: 'CONTRADICTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED via Oswald et al. 2013 IAT criterion meta-analysis)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
