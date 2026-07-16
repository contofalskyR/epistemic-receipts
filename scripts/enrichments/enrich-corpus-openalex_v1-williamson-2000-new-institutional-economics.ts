import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Williamson, O. E. (2000), "The New Institutional Economics: Taking Stock,
//   Looking Ahead." Journal of Economic Literature 38(3): 595-613.
//   DOI: 10.1257/jel.38.3.595 · OpenAlex: W2136823593 · Cited-by (OpenAlex): 6,305
//
// Baseline row (fromAxis=null -> RECORDED at 2000-09-01) already exists; NOT duplicated here.
//
// This is a synthesizing/programmatic review article by Williamson himself,
// "taking stock" of the new institutional economics (NIE) research program —
// not an empirical finding, so retraction / failed-replication tracks do not
// apply. The relevant post-publication event is a FIELD-CONSENSUS recognition
// at the INSTITUTIONAL level.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2009-10-12): the Royal Swedish Academy of Sciences
//   awarded Oliver E. Williamson the 2009 Sveriges Riksbank Prize in Economic
//   Sciences in Memory of Alfred Nobel (shared with Elinor Ostrom) "for his
//   analysis of economic governance, especially the boundaries of the firm" —
//   precisely the NIE program (transaction-cost economics, firms as governance
//   structures, the institutions of governance) that this paper takes stock of.
//   The prize is an institutional adjudication that the research program had
//   become established economics. Announced 2009-10-12 (DAY precision). No dated
//   prior contest existed to resolve, so RECORDED -> SETTLED directly.

const CLAIM_ID = 'cmplyu4i203bzsaqkf6qyq9pq'

async function main() {
  // ── RECORDED -> SETTLED: 2009 Nobel Memorial Prize in Economics ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:nobel-2009-economics-williamson' },
    create: {
      externalId: 'src:nobel-2009-economics-williamson',
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2009 — Oliver E. Williamson, "for his analysis of economic governance, especially the boundaries of the firm" (Royal Swedish Academy of Sciences, announced 12 October 2009).',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2009/williamson/facts/',
      publishedAt: new Date('2009-10-12'),
      methodologyType: 'institutional_recognition',
      ingestedBy: 'enrich:openalex_v1-williamson-2000-new-institutional-economics',
    },
    update: {
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2009 — Oliver E. Williamson, "for his analysis of economic governance, especially the boundaries of the firm" (Royal Swedish Academy of Sciences, announced 12 October 2009).',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2009/williamson/facts/',
      publishedAt: new Date('2009-10-12'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2009-10-12`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2009-10-12'),
      datePrecision: 'DAY',
      reason: 'On 12 October 2009 the Royal Swedish Academy of Sciences awarded Oliver E. Williamson — this paper\'s author — the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel (shared with Elinor Ostrom) "for his analysis of economic governance, especially the boundaries of the firm." That is precisely the new-institutional-economics program (transaction-cost economics, firms as governance structures, the institutions of governance) that this JEL review takes stock of. The prize is an institutional adjudication that the research program had become established economics, so the claim moves RECORDED -> SETTLED. No dated prior contest existed to resolve.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2009-10-12'),
      datePrecision: 'DAY',
      reason: 'On 12 October 2009 the Royal Swedish Academy of Sciences awarded Oliver E. Williamson — this paper\'s author — the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel (shared with Elinor Ostrom) "for his analysis of economic governance, especially the boundaries of the firm." That is precisely the new-institutional-economics program (transaction-cost economics, firms as governance structures, the institutions of governance) that this JEL review takes stock of. The prize is an institutional adjudication that the research program had become established economics, so the claim moves RECORDED -> SETTLED. No dated prior contest existed to resolve.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via 2009 Nobel Prize in Economics to Williamson)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
