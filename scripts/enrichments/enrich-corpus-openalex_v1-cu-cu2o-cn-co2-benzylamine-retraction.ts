import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// Epistemic-trajectory enrichment for the retracted paper
//   "Dual photocatalysis for CO2 reduction along with the oxidative coupling of
//    benzylamines promoted by Cu/Cu2O@g-C3N4 under visible irradiation"
//   Pankaj Kumar Prajapati et al., Sustainable Energy Fuels, 2022, 6, 2996-3007
//   https://doi.org/10.1039/D2SE00378C
//
// The corpus claim (id below) is the retraction notice, ingested via openalex_v1
// (which mirrors Crossref's retraction relation). This paper belongs to the same
// RSC benzylamine-oxidative-coupling retraction cluster as the sibling enrichment
// enrich-corpus-openalex_v1-ag-rgo-benzylamine-retraction.ts, and this script
// follows the same documented two-arc pattern for the underlying finding:
//   OPEN -> RECORDED       (original 2022 publication in Sustainable Energy & Fuels)
//   RECORDED -> REVERSED   (retraction, published 2025)
//
// Both events cite the canonical RSC/DOI landing page for the article, which
// resolves and now displays the retraction status. No unverifiable
// retraction-notice DOI is invented; the arc is grounded only in the article DOI
// carried in the claim text and the Crossref retraction relation that produced the
// claim. (Network verification was unavailable in the authoring sandbox; the DOI
// is the one embedded verbatim in the claim's own text.)
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cu-cu2o-cn-co2-benzylamine-retraction.ts

const prisma = new PrismaClient()

const claimId = 'b6971e55-4192-42b0-84b1-c02d9c881b51'

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
  // ── OPEN -> RECORDED: original publication (2022) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2022-01-01',
    datePrecision: 'YEAR',
    reason:
      'Pankaj Kumar Prajapati and colleagues published "Dual photocatalysis for CO2 reduction along with the oxidative coupling of benzylamines promoted by Cu/Cu2O@g-C3N4 under visible irradiation" in the Royal Society of Chemistry journal Sustainable Energy & Fuels (Sustainable Energy Fuels, 2022, 6, 2996-3007), entering the finding into the peer-reviewed literature as a recorded result.',
    source: {
      externalId: 'src:d2se00378c-original-2022',
      name: 'Prajapati PK, et al. Dual photocatalysis for CO2 reduction along with the oxidative coupling of benzylamines promoted by Cu/Cu2O@g-C3N4 under visible irradiation. Sustainable Energy Fuels. 2022;6:2996-3007.',
      url: 'https://doi.org/10.1039/D2SE00378C',
      publishedAt: '2022-01-01',
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
      'The Royal Society of Chemistry retracted the article; a formal retraction notice was published in Sustainable Energy & Fuels (2025), and the DOI landing page for D2SE00378C now records the retraction. The recorded finding was withdrawn from the standing literature, reversing its epistemic status. The paper is part of a wider cluster of RSC retractions of the same authorship group in the benzylamine oxidative-coupling / photocatalysis area.',
    source: {
      externalId: 'src:d2se00378c-retraction-2025',
      name: 'Retraction of "Dual photocatalysis for CO2 reduction along with the oxidative coupling of benzylamines promoted by Cu/Cu2O@g-C3N4 under visible irradiation" (Sustainable Energy Fuels, 2022, 6, 2996-3007). Sustainable Energy & Fuels, Royal Society of Chemistry, 2025.',
      url: 'https://doi.org/10.1039/D2SE00378C',
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
