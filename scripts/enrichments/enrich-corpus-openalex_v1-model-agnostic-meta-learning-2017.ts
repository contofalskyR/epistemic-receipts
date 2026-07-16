// Epistemic-receipt enrichment for the MAML claim (openalex_v1).
//
// Claim: cmpm032fk06n1sa86rj438t5k
//   "Model-Agnostic Meta-Learning for Fast Adaptation of Deep Networks"
//   Finn, Abbeel & Levine, arXiv:1703.03400, 2017-03-09 (OpenAlex W2604763608).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at 2017-03-09)
// already exists and is NOT recreated here. This script adds the post-publication
// arc that the claim actually traversed in the ML literature:
//
//   RECORDED -> CONTESTED  (Raghu et al., "Rapid Learning or Feature Reuse?",
//                           ICLR 2020 / arXiv:1909.09157, 2019-09-19) — a specific,
//                           dated methodological critique of MAML's stated mechanism.
//   CONTESTED -> SETTLED   (Hospedales, Antoniou, Micaelli & Storkey,
//                           "Meta-Learning in Neural Networks: A Survey",
//                           IEEE TPAMI 2022, DOI 10.1109/tpami.2021.3079209) —
//                           the field's canonical review establishes MAML as the
//                           foundational optimization-based meta-learning method.
//
// Idempotent: upserts on Source.externalId and a deterministic ClaimStatusHistory id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-model-agnostic-meta-learning-2017.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-model-agnostic-meta-learning-2017.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm032fk06n1sa86rj438t5k'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2019-09-19',
    datePrecision: 'DAY',
    reason:
      "Raghu et al. (\"Rapid Learning or Feature Reuse? Towards Understanding the Effectiveness of MAML\", ICLR 2020, arXiv:1909.09157) empirically challenged MAML's core mechanistic claim that the meta-learned initialization enables rapid adaptation through a few inner-loop gradient steps. Freezing the network body during task adaptation left few-shot accuracy almost unchanged, showing MAML's effectiveness comes largely from reusing a fixed feature representation rather than rapidly learning new features, and they proposed the simplified ANIL variant. This is a specific, dated critique of the paper's stated learning mechanism, alongside \"How to train your MAML\" (Antoniou et al., ICLR 2019, arXiv:1810.09502), which documented MAML's training instability and reproducibility difficulties.",
    source: {
      externalId: 'src:openalex-W2974885182-raghu-maml-feature-reuse-2019',
      name: 'Raghu A, Raghu M, Bengio S, Vinyals O. Rapid Learning or Feature Reuse? Towards Understanding the Effectiveness of MAML. ICLR 2020 (arXiv:1909.09157).',
      url: 'https://doi.org/10.48550/arxiv.1909.09157',
      publishedAt: '2019-09-19',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2021-01-01',
    datePrecision: 'YEAR',
    reason:
      "The field's authoritative review (Hospedales, Antoniou, Micaelli & Storkey, \"Meta-Learning in Neural Networks: A Survey\", IEEE Transactions on Pattern Analysis and Machine Intelligence 2022, DOI 10.1109/TPAMI.2021.3079209) canonizes MAML as the foundational optimization-based / gradient-based meta-learning method and the standard baseline across classification, regression, and reinforcement learning — exactly the applicability the original paper claimed. The earlier critiques were absorbed as refinements (MAML++, ANIL, Reptile) of a validated core rather than as a reversal, settling MAML's status as an established method in the field's canonical survey.",
    source: {
      externalId: 'src:openalex-W3015606043-hospedales-metalearning-survey-2021',
      name: 'Hospedales T, Antoniou A, Micaelli P, Storkey A. Meta-Learning in Neural Networks: A Survey. IEEE Transactions on Pattern Analysis and Machine Intelligence 2022;44(9):5149–5169.',
      url: 'https://doi.org/10.1109/tpami.2021.3079209',
      publishedAt: '2021-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' (DRY RUN)' : ''}`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source ${tr.source.externalId}`)
      console.log(`  would upsert ClaimStatusHistory ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-maml-2017',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: tr.toAxis === 'CONTESTED' ? 'AGAINST' : 'FOR' } })
    }

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
