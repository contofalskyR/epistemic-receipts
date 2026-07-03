import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// Epistemic-trajectory enrichment for the retracted paper
//   "Silver doped reduced graphene oxide as a promising plasmonic photocatalyst
//    for oxidative coupling of benzylamines under visible light irradiation"
//   Anurag Kumar et al., New J. Chem., 2019, 43, 9116-9122
//   https://doi.org/10.1039/C9NJ00852G
//
// The corpus claim (id below) is the retraction notice, ingested via openalex_v1
// (which mirrors Crossref's retraction relation). This script adds the two
// documented arcs of the underlying finding's trajectory:
//   OPEN -> RECORDED       (original 2019 publication in New Journal of Chemistry)
//   RECORDED -> REVERSED   (retraction, published 2025)
//
// Both events cite the canonical RSC/DOI landing page for the article, which
// resolves and now displays the retraction status. No unverifiable
// retraction-notice DOI is invented; the arc is grounded only in the article DOI
// carried in the claim text and the retraction relation that produced the claim.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ag-rgo-benzylamine-retraction.ts

const prisma = new PrismaClient()

const claimId = '7ac3f5ce-eac3-4e1b-bd76-4b8a13bc1007'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Arc {
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

const ARCS: Arc[] = [
  // ── OPEN -> RECORDED: original publication (2019) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2019-01-01',
    datePrecision: 'YEAR',
    reason:
      'Anurag Kumar and colleagues published "Silver doped reduced graphene oxide as a promising plasmonic photocatalyst for oxidative coupling of benzylamines under visible light irradiation" in the Royal Society of Chemistry journal New Journal of Chemistry (New J. Chem., 2019, 43, 9116-9122), entering the finding into the peer-reviewed literature as a recorded result.',
    source: {
      externalId: 'src:c9nj00852g-original-2019',
      name: 'Kumar A, et al. Silver doped reduced graphene oxide as a promising plasmonic photocatalyst for oxidative coupling of benzylamines under visible light irradiation. New J. Chem. 2019;43:9116-9122.',
      url: 'https://doi.org/10.1039/C9NJ00852G',
      publishedAt: '2019-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> REVERSED: retraction (2025) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2025-01-01',
    datePrecision: 'YEAR',
    reason:
      'The Royal Society of Chemistry retracted the article; a formal retraction notice was published in New Journal of Chemistry (2025), and the DOI landing page for C9NJ00852G now records the retraction. The recorded finding was withdrawn from the standing literature, reversing its epistemic status.',
    source: {
      externalId: 'src:c9nj00852g-retraction-2025',
      name: 'Retraction of "Silver doped reduced graphene oxide as a promising plasmonic photocatalyst for oxidative coupling of benzylamines under visible light irradiation" (New J. Chem., 2019, 43, 9116-9122). New Journal of Chemistry, Royal Society of Chemistry, 2025.',
      url: 'https://doi.org/10.1039/C9NJ00852G',
      publishedAt: '2025-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } })
  if (!claim) {
    throw new Error(`Claim ${claimId} not found — aborting (this script does not create claims).`)
  }

  for (const arc of ARCS) {
    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-trajectories',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
      },
    })

    const slug = `${claimId}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: arc.fromAxis ?? undefined,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis ?? undefined,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${arc.fromAxis ?? 'null'} -> ${arc.toAxis} @ ${arc.occurredAt}`)
  }

  console.log(`Enriched claim ${claimId} with ${ARCS.length} trajectory arcs.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
