import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5acd00sfsa8hrq0zyxph'

// Post-publication trajectory for Schmidt et al. (2011),
// "Persistence of soil organic matter as an ecosystem property,"
// Nature 478(7367):49-56. DOI 10.1038/nature10386 / OpenAlex W2132484323 / PMID 21979045.
//
// Baseline RECORDED row (fromAxis=null -> RECORDED @ 2011-10-01) already exists; not duplicated here.
//
// No retraction, expression of concern, failed replication, or dated methodological
// critique was found. The paper's core thesis — that the persistence of soil organic
// matter is controlled by environmental and biological (ecosystem) factors rather than
// by intrinsic molecular "recalcitrance" — became the mainstream paradigm over the 2010s.
//
// Verified adjudicating event:
//   RECORDED -> SETTLED @ 2015-12 — Lehmann & Kleber (2015), "The contentious nature
//   of soil organic matter," Nature 528:60-68 (PMID 26595271, DOI 10.1038/nature16069).
//   This landmark Nature review adjudicates the long-standing recalcitrance/"humic
//   substances" theory against the continuum view: it argues the available evidence does
//   not support persistent large-molecular humic substances, and that soil organic matter
//   is instead a continuum of progressively decomposing compounds whose stability is an
//   emergent ecosystem property. It consolidated the Schmidt et al. (2011) framing into
//   field consensus. Community: EXPERT_LITERATURE, MONTH precision. URL verified 200.

async function main() {
  const source = await prisma.source.upsert({
    where: { externalId: 'src:lehmann-kleber-2015-contentious-som' },
    create: {
      externalId: 'src:lehmann-kleber-2015-contentious-som',
      name: 'Lehmann, J. & Kleber, M. (2015), "The contentious nature of soil organic matter," Nature 528:60-68',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26595271/',
      publishedAt: new Date('2015-12-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:persistence-soil-organic-matter-schmidt-2011',
    },
    update: {
      name: 'Lehmann, J. & Kleber, M. (2015), "The contentious nature of soil organic matter," Nature 528:60-68',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26595271/',
      publishedAt: new Date('2015-12-01'),
    },
  })

  const slug = `${CLAIM_ID}-SETTLED-2015-12-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2015-12-01'),
      datePrecision: 'MONTH',
      reason:
        'Lehmann & Kleber (2015, Nature 528:60-68), "The contentious nature of soil organic matter," reviewed the field-wide evidence and rejected the long-standing recalcitrance / "humic substances" theory of persistence, arguing that soil organic matter is a continuum of progressively decomposing compounds whose stability is an emergent ecosystem property. This landmark review adjudicated the paradigm in favor of the Schmidt et al. (2011) thesis and consolidated the ecosystem-property view as mainstream consensus in soil biogeochemistry.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2015-12-01'),
      datePrecision: 'MONTH',
      reason:
        'Lehmann & Kleber (2015, Nature 528:60-68), "The contentious nature of soil organic matter," reviewed the field-wide evidence and rejected the long-standing recalcitrance / "humic substances" theory of persistence, arguing that soil organic matter is a continuum of progressively decomposing compounds whose stability is an emergent ecosystem property. This landmark review adjudicated the paradigm in favor of the Schmidt et al. (2011) thesis and consolidated the ecosystem-property view as mainstream consensus in soil biogeochemistry.',
      sourceId: source.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: RECORDED -> SETTLED (Lehmann & Kleber 2015)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
