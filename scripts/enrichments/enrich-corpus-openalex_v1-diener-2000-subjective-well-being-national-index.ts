import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Diener, E. (2000), "Subjective well-being: The science of happiness and a
//   proposal for a national index," American Psychologist 55(1): 34-43.
//   DOI: 10.1037/0003-066x.55.1.34 · OpenAlex: W2070808447
//
// Baseline row (fromAxis=null -> RECORDED at 2000-01-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2013-03-20): The OECD published its "Guidelines on
//   Measuring Subjective Well-being" (DOI 10.1787/9789264191655-en), the first
//   set of international statistical standards recommending that national
//   statistical offices collect subjective well-being data in official surveys.
//   This intergovernmental guideline directly institutionalises the central
//   proposal of Diener (2000) — a national index of subjective well-being — so
//   the finding is recorded as SETTLED at the INSTITUTIONAL community level
//   rather than merely contested in the literature.

const CLAIM_ID = 'cmpm17soy049dsadnmfbshgci'

async function main() {
  // ── RECORDED -> SETTLED: OECD Guidelines on Measuring Subjective Well-being (2013) ──
  const oecd = await prisma.source.upsert({
    where: { externalId: 'src:oecd-2013-guidelines-measuring-subjective-wellbeing' },
    create: {
      externalId: 'src:oecd-2013-guidelines-measuring-subjective-wellbeing',
      name: 'OECD (2013). OECD Guidelines on Measuring Subjective Well-being. OECD Publishing, Paris.',
      url: 'https://doi.org/10.1787/9789264191655-en',
      publishedAt: new Date('2013-03-20'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-diener-2000-subjective-well-being-national-index',
    },
    update: {
      name: 'OECD (2013). OECD Guidelines on Measuring Subjective Well-being. OECD Publishing, Paris.',
      url: 'https://doi.org/10.1787/9789264191655-en',
      publishedAt: new Date('2013-03-20'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2013-03-20`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2013-03-20'),
      datePrecision: 'DAY',
      reason: 'The OECD published its Guidelines on Measuring Subjective Well-being, the first international statistical standard recommending that national statistical offices measure subjective well-being in official household surveys. This intergovernmental guideline institutionally enacts the central proposal of Diener (2000) — a national index of subjective well-being — moving the finding from a scholarly proposal to adopted measurement practice at the institutional level.',
      sourceId: oecd.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2013-03-20'),
      datePrecision: 'DAY',
      reason: 'The OECD published its Guidelines on Measuring Subjective Well-being, the first international statistical standard recommending that national statistical offices measure subjective well-being in official household surveys. This intergovernmental guideline institutionally enacts the central proposal of Diener (2000) — a national index of subjective well-being — moving the finding from a scholarly proposal to adopted measurement practice at the institutional level.',
      sourceId: oecd.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: oecd.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: oecd.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via OECD 2013 guidelines)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
