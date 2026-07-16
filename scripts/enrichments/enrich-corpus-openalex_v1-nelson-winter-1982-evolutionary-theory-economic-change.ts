import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Nelson, R. R. & Winter, S. G. (1982), "An Evolutionary Theory of Economic
//   Change." Cambridge, MA: Harvard University Press.
//   DOI: none · OpenAlex: W3124140110 · Cited-by (OpenAlex): 6,330
//
// Baseline row (fromAxis=null -> RECORDED at 1982-01-01) already exists; NOT duplicated here.
//
// This is a foundational theoretical treatise, not an empirical finding, so
// retraction / failed-replication tracks do not apply. The relevant post-
// publication event is a FIELD-CONSENSUS shift: the book founded the modern
// research program in evolutionary / industrial-dynamics economics.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2003-04): the 20th-anniversary retrospective
//   symposium in Industrial and Corporate Change 12(2), opened by the preface
//   of Giovanni Dosi, Franco Malerba & David Teece ("Twenty years after Nelson
//   and Winter's An Evolutionary Theory of Economic Change...", ICC 12(2):
//   147-148, DOI 10.1093/icc/12.2.147). Convened by leading figures in the
//   field, the symposium adjudicates that the Nelson-Winter framework had
//   become the established foundation for the study of industrial dynamics,
//   organizational routines, and economic change — expert-literature consensus,
//   not merely high citation counts. Terminal state SETTLED (no dated prior
//   contest to resolve, so RECORDED -> SETTLED directly).

const CLAIM_ID = 'cmplyrq5m024zsaqkagkoobzy'

async function main() {
  // ── RECORDED -> SETTLED: ICC 20th-anniversary retrospective (2003) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:dosi-malerba-teece-2003-twenty-years-nelson-winter' },
    create: {
      externalId: 'src:dosi-malerba-teece-2003-twenty-years-nelson-winter',
      name: 'Dosi, G., Malerba, F. & Teece, D. (2003). "Twenty years after Nelson and Winter\'s An Evolutionary Theory of Economic Change: a preface on knowledge, the nature of organizations and the patterns of organizational changes." Industrial and Corporate Change 12(2): 147-148.',
      url: 'https://doi.org/10.1093/icc/12.2.147',
      publishedAt: new Date('2003-04-01'),
      methodologyType: 'review',
      ingestedBy: 'enrich:openalex_v1-nelson-winter-1982-evolutionary-theory',
    },
    update: {
      name: 'Dosi, G., Malerba, F. & Teece, D. (2003). "Twenty years after Nelson and Winter\'s An Evolutionary Theory of Economic Change: a preface on knowledge, the nature of organizations and the patterns of organizational changes." Industrial and Corporate Change 12(2): 147-148.',
      url: 'https://doi.org/10.1093/icc/12.2.147',
      publishedAt: new Date('2003-04-01'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2003-04-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2003-04-01'),
      datePrecision: 'MONTH',
      reason: 'The 20th-anniversary retrospective symposium in Industrial and Corporate Change 12(2), opened by the preface of Dosi, Malerba & Teece, adjudicated that Nelson & Winter\'s evolutionary framework had become the established foundation for the study of industrial dynamics, organizational routines, and technological change. Convened by leading scholars in the field, it marks expert-literature consensus that the 1982 research program is settled and generative, rather than merely widely cited. No dated prior contest existed to resolve, so the transition is RECORDED -> SETTLED directly.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2003-04-01'),
      datePrecision: 'MONTH',
      reason: 'The 20th-anniversary retrospective symposium in Industrial and Corporate Change 12(2), opened by the preface of Dosi, Malerba & Teece, adjudicated that Nelson & Winter\'s evolutionary framework had become the established foundation for the study of industrial dynamics, organizational routines, and technological change. Convened by leading scholars in the field, it marks expert-literature consensus that the 1982 research program is settled and generative, rather than merely widely cited. No dated prior contest existed to resolve, so the transition is RECORDED -> SETTLED directly.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via ICC 2003 20th-anniversary symposium)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
