// Epistemic-receipt enrichment for Mirjalili et al. (2017),
// "Salp Swarm Algorithm: A bio-inspired optimizer for engineering design problems,"
// Advances in Engineering Software 114:163–191. DOI 10.1016/j.advengsoft.2017.07.002
// OpenAlex W2738900493. Claim id cmq2w5tjn013xsa8hu7xl3pv0.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 2017-07-25
// publication date) already exists and is NOT duplicated here.
//
// Post-publication arc added: RECORDED -> CONTESTED.
// The Salp Swarm Algorithm is one of the "metaphor-based" metaheuristics whose
// novelty has been formally contested by the optimization research community. The
// algorithm is specifically catalogued (entry "Salp Planktons", naming Mirjalili
// et al. 2017) in the peer-reviewed community catalog of metaphor-based algorithms
// of questionable originality, the Evolutionary Computation Bestiary (Campelo &
// Aranha; Zenodo, first published 2018-06-20). This critique movement was
// subsequently formalized as a field-level "call for action" editorial
// (Aranha et al., Swarm Intelligence, 2021), which argues such metaphor-dressed
// methods must be deconstructed into, and benchmarked against, established
// components (e.g. particle swarm optimization) rather than accepted as novel.
// This is a genuine, dated, ongoing methodological contest — not a retraction —
// so the status moves to CONTESTED, not REVERSED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-salp-swarm-algorithm.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-salp-swarm-algorithm.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmq2w5tjn013xsa8hu7xl3pv0'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
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
    occurredAt: '2018-06-20',
    datePrecision: 'DAY',
    reason:
      'The Salp Swarm Algorithm is specifically catalogued (entry "Salp Planktons", citing Mirjalili et al. 2017) in the Evolutionary Computation Bestiary — a peer-reviewed community catalog of metaphor-based evolutionary, swarm, and nature-inspired algorithms whose originality is disputed (Campelo & Aranha; Zenodo, first published 2018-06-20). Inclusion flags the algorithm as part of the "metaphor-based metaheuristics" whose novel contribution over established techniques such as particle swarm optimization is contested. This methodological critique was subsequently formalized as a field-level call for action (Aranha et al., "Metaphor-based metaheuristics, a call for action: the elephant in the room," Swarm Intelligence, 2021), which demands that such methods be deconstructed into and benchmarked against known components rather than accepted as novel. The finding therefore stands as a widely used but actively contested method.',
    source: {
      externalId: 'src:ec-bestiary-salp-swarm-2018',
      name: 'Campelo F, Aranha C. EC Bestiary: A bestiary of evolutionary, swarm and other metaphor-based algorithms (entry "Salp Planktons", citing Mirjalili et al. 2017 Salp Swarm Algorithm). Zenodo, 2018.',
      url: 'https://doi.org/10.5281/zenodo.1293352',
      publishedAt: '2018-06-20',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${tr.source.externalId}`)
      console.log(`[dry-run] would upsert claimStatusHistory ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
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
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    console.log(`✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
