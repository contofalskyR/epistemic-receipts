import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Bronfenbrenner, U. (1986), "Ecology of the family as a context for human
//   development: Research perspectives," Developmental Psychology 22(6): 723-742.
//   DOI: 10.1037/0012-1649.22.6.723 · OpenAlex: W2050336499
//
// Baseline row (fromAxis=null -> RECORDED at 1986-11-01) already exists; NOT duplicated here.
//
// Post-publication arc added (verified via Crossref + DOI.org handle API):
//   RECORDED -> CONTESTED (1994-10): Bronfenbrenner & Ceci, "Nature-nurture
//     reconceptualized in developmental perspective: A bioecological model,"
//     Psychological Review 101(4): 568-586 (DOI 10.1037/0033-295X.101.4.568).
//     Bronfenbrenner explicitly critiqued his own earlier ecological formulation
//     (including the 1986 statement) for overemphasizing environmental context
//     and structure while neglecting the developing person and the proximal
//     processes driving development, reformulating it as the bioecological model.
//     A documented self-reformulation contesting the completeness of the original.
//   CONTESTED -> SETTLED (2006): Bronfenbrenner & Morris, "The Bioecological
//     Model of Human Development," in Handbook of Child Psychology, 6th ed.
//     (DOI 10.1002/9780470147658.chpsy0114). The mature Process-Person-Context-
//     Time (PPCT) model canonized in the field's authoritative reference work,
//     consolidating the framework (which retains the 1986 nested-systems
//     ecology) as the settled consensus theory of developmental context.

const CLAIM_ID = 'cmplyui3f03itsaqkm2at5knw'

async function main() {
  // ── RECORDED -> CONTESTED: Bronfenbrenner & Ceci (1994) bioecological reformulation ──
  const ceci = await prisma.source.upsert({
    where: { externalId: 'src:bronfenbrenner-ceci-1994-bioecological-model' },
    create: {
      externalId: 'src:bronfenbrenner-ceci-1994-bioecological-model',
      name: 'Bronfenbrenner, U., & Ceci, S. J. (1994). "Nature-nurture reconceptualized in developmental perspective: A bioecological model." Psychological Review 101(4): 568-586.',
      url: 'https://doi.org/10.1037/0033-295X.101.4.568',
      publishedAt: new Date('1994-10-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-bronfenbrenner-1986-ecology-family',
    },
    update: {
      name: 'Bronfenbrenner, U., & Ceci, S. J. (1994). "Nature-nurture reconceptualized in developmental perspective: A bioecological model." Psychological Review 101(4): 568-586.',
      url: 'https://doi.org/10.1037/0033-295X.101.4.568',
      publishedAt: new Date('1994-10-01'),
    },
  })

  const contestedId = `${CLAIM_ID}-CONTESTED-1994-10-01`
  const contestedReason = 'In Psychological Review (1994), Bronfenbrenner and Ceci explicitly critiqued Bronfenbrenner\'s own earlier ecological framework — including the 1986 formulation — as having overemphasized environmental context and nested-systems structure while neglecting the developing person and the proximal processes that actually drive development. They reformulated it as the bioecological model, marking the original statement as incomplete rather than settled. This documented self-reformulation put the finding into active revision within the expert literature.'
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1994-10-01'),
      datePrecision: 'MONTH',
      reason: contestedReason,
      sourceId: ceci.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1994-10-01'),
      datePrecision: 'MONTH',
      reason: contestedReason,
      sourceId: ceci.id,
    },
  })

  const ceciEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: ceci.id } })
  if (!ceciEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: ceci.id, type: 'AGAINST' } })
  }

  // ── CONTESTED -> SETTLED: Bronfenbrenner & Morris (2006) canonical mature model ──
  const morris = await prisma.source.upsert({
    where: { externalId: 'src:bronfenbrenner-morris-2006-bioecological-model' },
    create: {
      externalId: 'src:bronfenbrenner-morris-2006-bioecological-model',
      name: 'Bronfenbrenner, U., & Morris, P. A. (2006). "The Bioecological Model of Human Development." In Handbook of Child Psychology, 6th ed. (Vol. 1, pp. 793-828). Wiley.',
      url: 'https://doi.org/10.1002/9780470147658.chpsy0114',
      publishedAt: new Date('2006-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-bronfenbrenner-1986-ecology-family',
    },
    update: {
      name: 'Bronfenbrenner, U., & Morris, P. A. (2006). "The Bioecological Model of Human Development." In Handbook of Child Psychology, 6th ed. (Vol. 1, pp. 793-828). Wiley.',
      url: 'https://doi.org/10.1002/9780470147658.chpsy0114',
      publishedAt: new Date('2006-01-01'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2006-01-01`
  const settledReason = 'The bioecological reformulation reached its mature, canonical form in Bronfenbrenner & Morris\'s "The Bioecological Model of Human Development," the dedicated chapter in the 6th edition of the Handbook of Child Psychology — the field\'s authoritative reference. The Process-Person-Context-Time (PPCT) model presented there, which retains the 1986 paper\'s nested-systems ecology of external environments as developmental contexts, became the settled consensus framework cited across developmental psychology, consolidating the earlier contest into an accepted theory.'
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2006-01-01'),
      datePrecision: 'YEAR',
      reason: settledReason,
      sourceId: morris.id,
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2006-01-01'),
      datePrecision: 'YEAR',
      reason: settledReason,
      sourceId: morris.id,
    },
  })

  const morrisEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: morris.id } })
  if (!morrisEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: morris.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED via Bronfenbrenner & Ceci 1994; CONTESTED -> SETTLED via Bronfenbrenner & Morris 2006)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
