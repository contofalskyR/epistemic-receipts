import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Page, M.J., McKenzie, J.E., Bossuyt, P.M., et al. (2020),
//   "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews."
//   OSF preprint DOI: 10.31222/osf.io/v7gm2 · OpenAlex: W4236476849 · published 2020-09-14
//
// Baseline row (fromAxis=null -> RECORDED at 2020-09-14, the OSF preprint) already
// exists; NOT duplicated here.
//
// Post-publication arc added (single step):
//   RECORDED -> SETTLED (2021-03-29): The preprint's proposed guideline was formally
//     peer-reviewed and published as Page MJ et al., "The PRISMA 2020 statement: an
//     updated guideline for reporting systematic reviews," BMJ 2021;372:n71
//     (DOI 10.1136/bmj.n71). It appeared simultaneously across five journals
//     (BMJ; PLoS Med 2021;18(3):e1003583; J Clin Epidemiol; Int J Surg; Systematic
//     Reviews) and was registered by the EQUATOR Network as the standard reporting
//     guideline for systematic reviews, superseding the 2009 PRISMA statement.
//     This is institutional ratification of the guideline, not empirical contest.
//     Terminal state: SETTLED. Community: INSTITUTIONAL.

const CLAIM_ID = 'cmpm1oasp0wlrsa86ooblno5e'

async function main() {
  // ── RECORDED -> SETTLED: peer-reviewed publication + EQUATOR adoption ──
  const bmj = await prisma.source.upsert({
    where: { externalId: 'src:page-2021-prisma-2020-bmj-n71' },
    create: {
      externalId: 'src:page-2021-prisma-2020-bmj-n71',
      name: 'Page MJ, McKenzie JE, Bossuyt PM, et al. (2021). "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews." BMJ 372:n71. Published simultaneously in 5 journals; registered by the EQUATOR Network.',
      url: 'https://doi.org/10.1136/bmj.n71',
      publishedAt: new Date('2021-03-29'),
      methodologyType: 'guideline',
      ingestedBy: 'enrich:openalex_v1-prisma-2020-statement',
    },
    update: {
      name: 'Page MJ, McKenzie JE, Bossuyt PM, et al. (2021). "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews." BMJ 372:n71. Published simultaneously in 5 journals; registered by the EQUATOR Network.',
      url: 'https://doi.org/10.1136/bmj.n71',
      publishedAt: new Date('2021-03-29'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2021-03-29`
  const settledReason = 'The PRISMA 2020 statement proposed in the 2020 OSF preprint was formally peer-reviewed and published on 29 March 2021 as Page et al., BMJ 2021;372:n71, appearing simultaneously across five journals (BMJ, PLoS Medicine, Journal of Clinical Epidemiology, International Journal of Surgery, and Systematic Reviews). It was registered by the EQUATOR Network as the authoritative reporting guideline for systematic reviews, superseding the 2009 PRISMA statement. This institutional adoption established PRISMA 2020 as the field-standard reporting guideline, settling the claim through consensus ratification rather than empirical contest.'
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2021-03-29'),
      datePrecision: 'DAY',
      reason: settledReason,
      sourceId: bmj.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2021-03-29'),
      datePrecision: 'DAY',
      reason: settledReason,
      sourceId: bmj.id,
    },
  })

  const bmjEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: bmj.id } })
  if (!bmjEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: bmj.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via peer-reviewed BMJ publication + EQUATOR adoption, 2021-03-29)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
