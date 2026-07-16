import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Akyildiz, I.F., Lee, W.-Y., Vuran, M.C., & Mohanty, S. (2006),
//   "NeXt generation/dynamic spectrum access/cognitive radio wireless
//    networks: A survey," Computer Networks 50(13): 2127-2159.
//   DOI: 10.1016/j.comnet.2006.05.001 · OpenAlex: W2144369278
//
// Baseline row (fromAxis=null -> RECORDED at 2006-05-19) already exists; do NOT
// duplicate it. This survey articulated and championed the dynamic-spectrum-
// access (DSA) / cognitive-radio paradigm as the answer to spectrum
// underutilization. There is no retraction, failed replication, or meta-analysis
// (the paper is a survey, not a testable empirical finding). The post-publication
// arc is a FIELD-CONSENSUS SHIFT: the paradigm moved from research concept to
// formal regulatory reality.
//
//   RECORDED -> SETTLED  (FCC Second Report and Order, FCC 08-260, adopted
//     2008-11-04: the U.S. regulator authorized unlicensed devices to operate
//     opportunistically in the TV "white spaces" using spectrum-sensing /
//     geolocation database techniques — the first hard institutional adoption of
//     the dynamic-spectrum-access model this survey advocated. Corroborated by
//     IEEE 802.22-2011, the first cognitive-radio wireless standard, in 2011.)
//
// The adjudication is institutional (a national regulator + a standards body),
// hence community INSTITUTIONAL.

const CLAIM_ID = 'cmpm195s40pxfsa86rsk9xb78'

async function main() {
  // ── RECORDED -> SETTLED: FCC TV White Spaces Second Report and Order (2008) ──
  const fcc = await prisma.source.upsert({
    where: { externalId: 'src:fcc-08-260-tv-white-spaces-second-report-order' },
    create: {
      externalId: 'src:fcc-08-260-tv-white-spaces-second-report-order',
      name: 'FCC (2008). Second Report and Order and Memorandum Opinion and Order, In the Matter of Unlicensed Operation in the TV Broadcast Bands (ET Docket No. 04-186), FCC 08-260, adopted Nov. 4, 2008 — authorizing unlicensed cognitive/dynamic-spectrum-access devices in the TV white spaces.',
      url: 'https://docs.fcc.gov/public/attachments/FCC-08-260A1.pdf',
      publishedAt: new Date('2008-11-04'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-akyildiz-2006-cognitive-radio-survey',
    },
    update: {
      name: 'FCC (2008). Second Report and Order and Memorandum Opinion and Order, In the Matter of Unlicensed Operation in the TV Broadcast Bands (ET Docket No. 04-186), FCC 08-260, adopted Nov. 4, 2008 — authorizing unlicensed cognitive/dynamic-spectrum-access devices in the TV white spaces.',
      url: 'https://docs.fcc.gov/public/attachments/FCC-08-260A1.pdf',
      publishedAt: new Date('2008-11-04'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2008-11-04`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2008-11-04'),
      datePrecision: 'DAY',
      reason: 'The dynamic-spectrum-access / cognitive-radio model this survey championed transitioned from research concept to sanctioned reality when the FCC adopted its Second Report and Order (FCC 08-260) authorizing unlicensed devices to operate opportunistically in the TV white spaces via spectrum sensing and geolocation databases. This institutional adoption was reinforced in 2011 by IEEE 802.22, the first cognitive-radio wireless standard, marking the paradigm as settled within the regulatory and engineering communities.',
      sourceId: fcc.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2008-11-04'),
      datePrecision: 'DAY',
      sourceId: fcc.id,
    },
  })

  const fccEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: fcc.id } })
  if (!fccEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: fcc.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via FCC 08-260 TV white spaces order, 2008)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
