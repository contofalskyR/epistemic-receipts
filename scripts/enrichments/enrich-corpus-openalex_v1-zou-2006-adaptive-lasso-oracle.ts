import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmq2w4uca00irsa8hzerk05zr'

async function main() {
  // ── Transition 1: RECORDED -> CONTESTED ──────────────────────────────
  // Leeb & Pötscher (2008), "Sparse estimators and the oracle property, or
  // the return of Hodges' estimator," Journal of Econometrics 142(1):201-211.
  // A direct, named methodological critique of the "oracle property" that is
  // the central claim of Zou (2006). They show sparse/oracle estimators
  // (adaptive lasso among them) are essentially superefficient à la Hodges:
  // their finite-sample distributions can be far from the pointwise-asymptotic
  // normal limit, and their worst-case (maximal) risk is unbounded — so the
  // oracle property does not deliver the uniform performance it appears to
  // promise. This contests the practical interpretation of the paper's result.
  const critiqueUrl = 'https://doi.org/10.1016/j.jeconom.2007.05.017'

  await prisma.source.upsert({
    where: { externalId: 'src:leeb-potscher-2008-oracle-hodges' },
    create: {
      externalId: 'src:leeb-potscher-2008-oracle-hodges',
      url: critiqueUrl,
      title:
        "Leeb & Pötscher (2008), Sparse estimators and the oracle property, or the return of Hodges' estimator, Journal of Econometrics 142(1):201-211",
    },
    update: {
      url: critiqueUrl,
      title:
        "Leeb & Pötscher (2008), Sparse estimators and the oracle property, or the return of Hodges' estimator, Journal of Econometrics 142(1):201-211",
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${claimId}-CONTESTED-2008-01-01` },
    create: {
      id: `${claimId}-CONTESTED-2008-01-01`,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2008-01-01'),
      datePrecision: 'MONTH',
      sourceExternalId: 'src:leeb-potscher-2008-oracle-hodges',
      reason:
        "Leeb & Pötscher (2008, Journal of Econometrics) directly challenged the paper's central 'oracle property' claim. They argued that estimators possessing the oracle property — the adaptive lasso included — are superefficient in the Hodges sense: their finite-sample distributions can deviate sharply from the pointwise-asymptotic normal limit and their maximal risk is unbounded. The critique does not dispute the theorems but reframes the oracle property as a misleading guide to actual finite-sample performance.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2008-01-01'),
      datePrecision: 'MONTH',
      sourceExternalId: 'src:leeb-potscher-2008-oracle-hodges',
      reason:
        "Leeb & Pötscher (2008, Journal of Econometrics) directly challenged the paper's central 'oracle property' claim. They argued that estimators possessing the oracle property — the adaptive lasso included — are superefficient in the Hodges sense: their finite-sample distributions can deviate sharply from the pointwise-asymptotic normal limit and their maximal risk is unbounded. The critique does not dispute the theorems but reframes the oracle property as a misleading guide to actual finite-sample performance.",
    },
  })

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
