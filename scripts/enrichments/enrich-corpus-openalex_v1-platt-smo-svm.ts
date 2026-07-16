// Enrichment: post-publication epistemic trajectory for
// "Fast Training of Support Vector Machines Using Sequential Minimal Optimization"
// Platt JC. In: Advances in Kernel Methods — Support Vector Learning. MIT Press, 1998.
// DOI 10.7551/mitpress/1130.003.0016 · OpenAlex W1512098439
//
// This is the foundational chapter introducing Sequential Minimal Optimization (SMO),
// which breaks the large SVM quadratic-programming problem into a series of smallest
// possible (two-multiplier) QP subproblems solved analytically.
//
// Baseline RECORDED transition (fromAxis=null -> RECORDED at 1998-12-01) already
// exists and is NOT duplicated here.
//
// Post-publication events added:
//   RECORDED -> CONTESTED (2001-03, EXPERT_LITERATURE)
//     Keerthi, Shevade, Bhattacharyya & Murthy showed that Platt's original SMO,
//     because of the way it maintained a single threshold b and checked the KKT
//     conditions, could be quite inefficient and in some cases stalled — directly
//     contesting the efficiency at the heart of the SMO contribution. They proposed
//     a modification using two threshold parameters that provably improved
//     convergence. Keerthi SS, Shevade SK, Bhattacharyya C, Murthy KRK.
//     "Improvements to Platt's SMO Algorithm for SVM Classifier Design."
//     Neural Computation 2001;13(3):637–649.
//
//   CONTESTED -> SETTLED (2011-04, EXPERT_LITERATURE)
//     LIBSVM — the most widely used SVM library — is built on an SMO-type
//     decomposition method (incorporating the two-threshold / second-order working-
//     set-selection refinements to Platt's original scheme). Its canonical ACM TIST
//     paper documents SMO-type decomposition as the de facto standard for training
//     SVMs, vindicating Platt's core contribution: the small-QP analytic decomposition
//     became the settled foundation of practical SVM training. Chang C-C, Lin C-J.
//     "LIBSVM: A Library for Support Vector Machines." ACM Transactions on Intelligent
//     Systems and Technology 2011;2(3):27.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-platt-smo-svm.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmq2w5hgi00wrsa8hsku4mxc7'

async function main() {
  // ── RECORDED -> CONTESTED : Keerthi et al. improvements to SMO (2001) ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:keerthi-improvements-platt-smo-2001' },
    create: {
      externalId: 'src:keerthi-improvements-platt-smo-2001',
      name: "Keerthi SS, Shevade SK, Bhattacharyya C, Murthy KRK. \"Improvements to Platt's SMO Algorithm for SVM Classifier Design.\" Neural Computation 2001;13(3):637–649.",
      url: 'https://doi.org/10.1162/089976601300014493',
      publishedAt: new Date('2001-03-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: "Keerthi SS, Shevade SK, Bhattacharyya C, Murthy KRK. \"Improvements to Platt's SMO Algorithm for SVM Classifier Design.\" Neural Computation 2001;13(3):637–649.",
      url: 'https://doi.org/10.1162/089976601300014493',
      publishedAt: new Date('2001-03-01'),
    },
  })

  {
    const occurredAt = new Date('2001-03-01')
    const slug = `${claimId}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      "Keerthi, Shevade, Bhattacharyya and Murthy showed that Platt's original SMO — because of the way it maintained a single threshold b and checked the KKT optimality conditions — could be quite inefficient and, in some configurations, stall. This directly contested the efficiency claim central to SMO's contribution. They proposed a modification maintaining two threshold parameters that provably improved convergence, opening a substantive methodological dispute over the original algorithm's design."

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: contestSource.id,
      },
      update: {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: contestSource.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: contestSource.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: contestSource.id, type: 'AGAINST' } })
    }
  }

  // ── CONTESTED -> SETTLED : LIBSVM establishes SMO-type decomposition as standard (2011) ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:chang-lin-libsvm-2011' },
    create: {
      externalId: 'src:chang-lin-libsvm-2011',
      name: 'Chang C-C, Lin C-J. "LIBSVM: A Library for Support Vector Machines." ACM Transactions on Intelligent Systems and Technology 2011;2(3):27.',
      url: 'https://doi.org/10.1145/1961189.1961199',
      publishedAt: new Date('2011-04-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Chang C-C, Lin C-J. "LIBSVM: A Library for Support Vector Machines." ACM Transactions on Intelligent Systems and Technology 2011;2(3):27.',
      url: 'https://doi.org/10.1145/1961189.1961199',
      publishedAt: new Date('2011-04-01'),
    },
  })

  {
    const occurredAt = new Date('2011-04-01')
    const slug = `${claimId}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      "LIBSVM — the most widely used SVM library — is built on an SMO-type decomposition method that incorporates the two-threshold and second-order working-set-selection refinements to Platt's original scheme. Its canonical ACM TIST paper documents SMO-type decomposition as the de facto standard for training support vector machines, resolving the earlier efficiency dispute and vindicating Platt's core contribution: analytically solving a series of smallest-possible QP subproblems became the settled foundation of practical SVM training."

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: settleSource.id,
      },
      update: {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: settleSource.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: settleSource.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: settleSource.id, type: 'FOR' } })
    }
  }

  console.log(
    `  ✓ enriched ${claimId} (+2 transitions: RECORDED -> CONTESTED 2001-03, CONTESTED -> SETTLED 2011-04)`,
  )
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
