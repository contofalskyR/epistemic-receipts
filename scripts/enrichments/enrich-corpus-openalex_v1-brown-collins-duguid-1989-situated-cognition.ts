// Enrichment: post-publication epistemic arc for Brown, Collins & Duguid's
// "Situated Cognition and the Culture of Learning".
//
// Claim: cmplxm2p800odsa7fo95k2v01 (openalex_v1, W2164599981)
//   Brown JS, Collins A, Duguid P. Situated Cognition and the Culture of Learning.
//   Educational Researcher 1989;18(1):32-42. DOI 10.3102/0013189x018001032.
//   (Identity confirmed via Crossref: title, authors, container, vol/issue, page,
//    issued 1989-01 all match the claim + OpenAlex ID.)
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1989-01-01) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref):
//   - No retraction and no expression of concern on the 1989 paper
//     (Crossref update-to: none).
//   - RECORDED -> CONTESTED: Anderson JR, Reder LM, Simon HA. "Situated Learning and
//     Education." Educational Researcher 1996;25(4):5-11, DOI 10.3102/0013189X025004005.
//     A direct, specific, dated methodological/theoretical critique in the same journal.
//     It reviews four central claims of the situated-learning program (action is bound to
//     its concrete situation; knowledge does not transfer between tasks; abstract training
//     is of little use; instruction must occur in complex social settings) and marshals
//     empirical literature to argue each is overstated and that transfer and abstraction
//     demonstrably work. This opened the well-known published exchange (Greeno's 1997
//     response and the authors' rejoinder), i.e. a genuine, sustained contest in the
//     expert literature. Crossref confirms the critique DOI resolves (HTTP 200).
//
// No systematic review or consensus statement subsequently adjudicated the situated-vs-
// cognitivist debate to a SETTLED/REVERSED endpoint, so the honest terminal state is
// CONTESTED. One verified transition only.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-brown-collins-duguid-1989-situated-cognition.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxm2p800odsa7fo95k2v01'

async function main() {
  // ── RECORDED -> CONTESTED: Anderson, Reder & Simon critique (1996) ──
  const critiqueSource = await prisma.source.upsert({
    where: { externalId: 'src:anderson-reder-simon-1996-situated-learning-critique' },
    create: {
      externalId: 'src:anderson-reder-simon-1996-situated-learning-critique',
      name: 'Anderson JR, Reder LM, Simon HA. Situated Learning and Education. Educational Researcher 1996;25(4):5-11. DOI 10.3102/0013189X025004005.',
      url: 'https://doi.org/10.3102/0013189X025004005',
      publishedAt: new Date('1996-05-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Anderson JR, Reder LM, Simon HA. Situated Learning and Education. Educational Researcher 1996;25(4):5-11. DOI 10.3102/0013189X025004005.',
      url: 'https://doi.org/10.3102/0013189X025004005',
      publishedAt: new Date('1996-05-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-1996-05-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1996-05-01'),
      datePrecision: 'MONTH',
      sourceId: critiqueSource.id,
      reason:
        'Anderson, Reder & Simon (Educational Researcher 1996;25(4):5-11) published a direct critique in the same journal, reviewing four central claims of the situated-learning program and citing empirical literature to argue each is overstated — that knowledge transfer and abstract instruction demonstrably work, contrary to the situated-cognition thesis. It opened the well-known published exchange (Greeno 1997 and the authors\u2019 rejoinder), placing the finding in active expert dispute: RECORDED -> CONTESTED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1996-05-01'),
      datePrecision: 'MONTH',
      sourceId: critiqueSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED @ 1996-05)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
