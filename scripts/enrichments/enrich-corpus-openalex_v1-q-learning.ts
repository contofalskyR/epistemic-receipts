import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Claim: Watkins & Dayan (1992), "Q-learning", Machine Learning 8(3–4):279–292
// DOI 10.1007/bf00992698 — OpenAlex W32403112 — claim id cmq2w4o2q00exsa8hnhxmgs7u
// Baseline row (fromAxis=null -> RECORDED @ 1992-05-01) already exists; do NOT duplicate.
//
// Post-publication arc: the central claim — that Q-learning converges to the optimal
// action-value function Q* — was put on rigorous footing by two independent 1994 proofs
// via stochastic-approximation theory (Tsitsiklis 1994; Jaakkola, Jordan & Singh 1994).
// This settled the convergence result within the expert literature. No contest phase,
// no retraction, no failed replication found -> RECORDED -> SETTLED.

const CLAIM_ID = 'cmq2w4o2q00exsa8hnhxmgs7u'

async function main() {
  // --- Transition: RECORDED -> SETTLED (rigorous convergence proofs, 1994) ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:q-learning-convergence-proof-tsitsiklis-1994' },
    create: {
      name: "Tsitsiklis, J.N. (1994) \"Asynchronous Stochastic Approximation and Q-Learning\", Machine Learning 16(3):185–202; with Jaakkola, Jordan & Singh (1994), Neural Computation 6(6):1185–1201",
      url: 'https://doi.org/10.1023/A:1022689125041',
      publishedAt: new Date('1994-09-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich-corpus-openalex_v1-q-learning',
      externalId: 'src:q-learning-convergence-proof-tsitsiklis-1994',
      humanReviewed: true,
      autoApproved: false,
    },
    update: {
      url: 'https://doi.org/10.1023/A:1022689125041',
      publishedAt: new Date('1994-09-01'),
    },
  })

  const occurredAt = new Date('1994-09-01')
  const toAxis = 'SETTLED'
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      sourceId: source.id,
      reason:
        "Watkins & Dayan's 1992 convergence argument for Q-learning was made rigorous by two independent 1994 proofs. Tsitsiklis (\"Asynchronous Stochastic Approximation and Q-Learning\", Machine Learning, Sept 1994) and Jaakkola, Jordan & Singh (\"On the Convergence of Stochastic Iterative Dynamic Programming Algorithms\", Neural Computation, Nov 1994) both proved, via stochastic-approximation theory, that Q-learning converges to the optimal action-value function under standard step-size and exploration conditions. This established Q-learning's convergence as a settled result in the expert literature.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      sourceId: source.id,
    },
  })

  console.log(`Upserted transition ${slug} (source ${source.id})`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
