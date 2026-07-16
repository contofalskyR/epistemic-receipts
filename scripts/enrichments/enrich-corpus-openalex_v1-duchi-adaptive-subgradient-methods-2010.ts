import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Duchi, Hazan & Singer (2010/2011), "Adaptive Subgradient Methods for
//   Online Learning and Stochastic Optimization" (AdaGrad).
//   OpenAlex W2146502635. No DOI (JMLR). Identity confirmed via OpenAlex
//   title + authors (John C. Duchi, Elad Hazan, Yoram Singer).
//
// Baseline row (fromAxis=null -> RECORDED at 2010-01-01) already exists; do NOT
// duplicate it.
//
// Post-publication event: Wilson, Roelofs, Stern, Srebro & Recht (2017),
// "The Marginal Value of Adaptive Gradient Methods in Machine Learning"
// (arXiv:1705.08292, published NeurIPS 2017). A specific, heavily-cited
// methodological critique showing that adaptive subgradient methods (AdaGrad,
// RMSProp, Adam) find solutions that generalize measurably worse than plain
// SGD on several standard tasks, directly contesting the claim that adaptive
// subgradient methods are broadly "effective tools." RECORDED -> CONTESTED.

const claimId = 'cmq2w4ppe00fxsa8h8l94e5fb'

async function main() {
  // --- Transition: RECORDED -> CONTESTED (Wilson et al. 2017 critique) ---
  await prisma.source.upsert({
    where: { externalId: 'src:wilson-marginal-value-adaptive-gradient-2017' },
    create: {
      externalId: 'src:wilson-marginal-value-adaptive-gradient-2017',
      title:
        'The Marginal Value of Adaptive Gradient Methods in Machine Learning (Wilson, Roelofs, Stern, Srebro & Recht, 2017)',
      url: 'https://arxiv.org/abs/1705.08292',
    },
    update: {
      title:
        'The Marginal Value of Adaptive Gradient Methods in Machine Learning (Wilson, Roelofs, Stern, Srebro & Recht, 2017)',
      url: 'https://arxiv.org/abs/1705.08292',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${claimId}-CONTESTED-2017-05-23` },
    create: {
      id: `${claimId}-CONTESTED-2017-05-23`,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2017-05-23'),
      datePrecision: 'DAY',
      sourceExternalId: 'src:wilson-marginal-value-adaptive-gradient-2017',
      reason:
        'Wilson et al. (2017), "The Marginal Value of Adaptive Gradient Methods in Machine Learning" (arXiv:1705.08292; NeurIPS 2017), presented dated, citable evidence that adaptive subgradient methods — AdaGrad and its descendants RMSProp and Adam — converge to solutions that generalize worse than plain stochastic gradient descent on standard deep-learning benchmarks. This directly contested the paper\'s claim that adaptive geometry-aware subgradient methods are broadly effective optimization tools, opening a sustained debate over adaptive-vs-SGD generalization.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2017-05-23'),
      datePrecision: 'DAY',
      sourceExternalId: 'src:wilson-marginal-value-adaptive-gradient-2017',
      reason:
        'Wilson et al. (2017), "The Marginal Value of Adaptive Gradient Methods in Machine Learning" (arXiv:1705.08292; NeurIPS 2017), presented dated, citable evidence that adaptive subgradient methods — AdaGrad and its descendants RMSProp and Adam — converge to solutions that generalize worse than plain stochastic gradient descent on standard deep-learning benchmarks. This directly contested the paper\'s claim that adaptive geometry-aware subgradient methods are broadly effective optimization tools, opening a sustained debate over adaptive-vs-SGD generalization.',
    },
  })

  console.log('Enrichment complete: AdaGrad (W2146502635) RECORDED -> CONTESTED (Wilson et al. 2017).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
