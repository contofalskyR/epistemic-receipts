import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Levine, R. & Renelt, D. (1992), "A Sensitivity Analysis of Cross-Country
//   Growth Regressions," American Economic Review 82(4): 942-963.
//   OpenAlex: W1606377008 (dated 1991-03-31) · DOI: not assigned in OpenAlex
//
// Baseline row (fromAxis=null -> RECORDED at 1991-03-31) already exists; NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> CONTESTED (1997): Xavier Sala-i-Martin's "I Just Ran Two Million
//     Regressions" (AER Papers & Proceedings 87(2): 178-183) directly challenged
//     Levine & Renelt's extreme-bounds analysis (EBA) as an excessively stringent
//     robustness test that mechanically produces fragility, and — running millions
//     of regressions with a less draconian criterion — found a substantial set of
//     variables robustly correlated with growth. This put the headline "almost all
//     results are fragile" conclusion into active scholarly contestation.
//   CONTESTED -> SETTLED (2004-09): Sala-i-Martin, Doppelhofer & Miller's Bayesian
//     Averaging of Classical Estimates (BACE) paper (AER 94(4): 813-835,
//     DOI 10.1257/0002828042002570) supplied a principled model-averaging framework
//     that became the standard resolution of the growth-determinant robustness
//     debate, identifying ~18 robust determinants. This vindicated Levine & Renelt's
//     own positive finding that robust growth correlates exist (investment share
//     prominent among them) while showing the extreme fragility verdict was an
//     artifact of the EBA test rather than the data.

const CLAIM_ID = 'cmpm0kvqz0exvsa86z35q0t1o'

async function main() {
  // ── RECORDED -> CONTESTED: Sala-i-Martin (1997) ──
  const sim1997 = await prisma.source.upsert({
    where: { externalId: 'src:sala-i-martin-1997-two-million-regressions' },
    create: {
      externalId: 'src:sala-i-martin-1997-two-million-regressions',
      name: 'Sala-i-Martin, X. (1997). "I Just Ran Two Million Regressions." American Economic Review 87(2): 178-183.',
      url: 'https://econpapers.repec.org/RePEc:aea:aecrev:v:87:y:1997:i:2:p:178-83',
      publishedAt: new Date('1997-01-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-levine-renelt-1992-growth-regressions',
    },
    update: {
      name: 'Sala-i-Martin, X. (1997). "I Just Ran Two Million Regressions." American Economic Review 87(2): 178-183.',
      url: 'https://econpapers.repec.org/RePEc:aea:aecrev:v:87:y:1997:i:2:p:178-83',
      publishedAt: new Date('1997-01-01'),
    },
  })

  const contestedId = `${CLAIM_ID}-CONTESTED-1997-01-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedId },
    create: {
      id: contestedId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1997-01-01'),
      datePrecision: 'YEAR',
      reason: 'Xavier Sala-i-Martin\'s "I Just Ran Two Million Regressions" (AER 1997) directly challenged Levine & Renelt\'s extreme-bounds analysis, arguing that requiring a coefficient to stay significant across every possible model is an excessively stringent test that mechanically manufactures fragility. Running millions of regressions under a less draconian robustness criterion, he found a large set of variables robustly correlated with growth, putting the headline "almost all results are fragile" conclusion into active scholarly contestation.',
      sourceId: sim1997.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1997-01-01'),
      datePrecision: 'YEAR',
      reason: 'Xavier Sala-i-Martin\'s "I Just Ran Two Million Regressions" (AER 1997) directly challenged Levine & Renelt\'s extreme-bounds analysis, arguing that requiring a coefficient to stay significant across every possible model is an excessively stringent test that mechanically manufactures fragility. Running millions of regressions under a less draconian robustness criterion, he found a large set of variables robustly correlated with growth, putting the headline "almost all results are fragile" conclusion into active scholarly contestation.',
      sourceId: sim1997.id,
    },
  })

  const edge1 = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: sim1997.id } })
  if (!edge1) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: sim1997.id, type: 'AGAINST' } })
  }

  // ── CONTESTED -> SETTLED: Sala-i-Martin, Doppelhofer & Miller (2004) BACE ──
  const bace2004 = await prisma.source.upsert({
    where: { externalId: 'src:sala-i-martin-doppelhofer-miller-2004-bace' },
    create: {
      externalId: 'src:sala-i-martin-doppelhofer-miller-2004-bace',
      name: 'Sala-i-Martin, X., Doppelhofer, G. & Miller, R. I. (2004). "Determinants of Long-Term Growth: A Bayesian Averaging of Classical Estimates (BACE) Approach." American Economic Review 94(4): 813-835.',
      url: 'https://doi.org/10.1257/0002828042002570',
      publishedAt: new Date('2004-09-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-levine-renelt-1992-growth-regressions',
    },
    update: {
      name: 'Sala-i-Martin, X., Doppelhofer, G. & Miller, R. I. (2004). "Determinants of Long-Term Growth: A Bayesian Averaging of Classical Estimates (BACE) Approach." American Economic Review 94(4): 813-835.',
      url: 'https://doi.org/10.1257/0002828042002570',
      publishedAt: new Date('2004-09-01'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2004-09-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-09-01'),
      datePrecision: 'MONTH',
      reason: 'Sala-i-Martin, Doppelhofer & Miller\'s Bayesian Averaging of Classical Estimates (BACE) paper (AER 2004) supplied a principled model-averaging framework that became the standard resolution of the growth-determinant robustness debate, identifying roughly eighteen robust determinants. It vindicated Levine & Renelt\'s own positive finding that robust growth correlates do exist — with investment share prominent among them — while demonstrating that the extreme fragility verdict was an artifact of the excessively stringent extreme-bounds test rather than a property of the data.',
      sourceId: bace2004.id,
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-09-01'),
      datePrecision: 'MONTH',
      reason: 'Sala-i-Martin, Doppelhofer & Miller\'s Bayesian Averaging of Classical Estimates (BACE) paper (AER 2004) supplied a principled model-averaging framework that became the standard resolution of the growth-determinant robustness debate, identifying roughly eighteen robust determinants. It vindicated Levine & Renelt\'s own positive finding that robust growth correlates do exist — with investment share prominent among them — while demonstrating that the extreme fragility verdict was an artifact of the excessively stringent extreme-bounds test rather than a property of the data.',
      sourceId: bace2004.id,
    },
  })

  const edge2 = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: bace2004.id } })
  if (!edge2) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: bace2004.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED via Sala-i-Martin 1997; CONTESTED -> SETTLED via BACE 2004)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
