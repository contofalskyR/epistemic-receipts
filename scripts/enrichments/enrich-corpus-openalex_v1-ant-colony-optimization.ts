// Enrichment: post-publication trajectory for Dorigo, Birattari & Stützle (2006),
// "Ant Colony Optimization", IEEE Computational Intelligence Magazine 1(4):28-39.
// Claim: cmq2w5p5v0119sa8hbbg6euvb (openalex_v1, W4292083457)
//
// Baseline ClaimStatusHistory row (null -> RECORDED at 2006-11-01) already exists.
// This script adds the single verified post-publication adjudication:
//   RECORDED -> SETTLED (2019) — the same lead authors' canonical successor overview,
//   "Ant Colony Optimization: Overview and Recent Advances" (Handbook of Metaheuristics,
//   3rd ed.), reaffirmed ACO as an established, leading swarm-intelligence metaheuristic.
//
// No retraction, expression of concern, or failed replication exists.
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ant-colony-optimization.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5p5v0119sa8hbbg6euvb'

async function main() {
  // ── RECORDED -> SETTLED: 2019 same-authors updated overview reaffirms ACO's standing ──
  await prisma.source.upsert({
    where: { externalId: 'src:aco-overview-recent-advances-2019' },
    create: {
      externalId: 'src:aco-overview-recent-advances-2019',
      name: 'Dorigo & Stützle (2019), "Ant Colony Optimization: Overview and Recent Advances", in Handbook of Metaheuristics (3rd ed.), International Series in Operations Research & Management Science 272:311-351',
      url: 'https://doi.org/10.1007/978-3-319-91086-4_10',
      publishedAt: new Date('2019-01-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Dorigo & Stützle (2019), "Ant Colony Optimization: Overview and Recent Advances", in Handbook of Metaheuristics (3rd ed.), International Series in Operations Research & Management Science 272:311-351',
      url: 'https://doi.org/10.1007/978-3-319-91086-4_10',
      publishedAt: new Date('2019-01-01'),
      methodologyType: 'derivative',
    },
  })

  const occurredAt = new Date('2019-01-01')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'YEAR',
      reason:
        'Thirteen years after the original IEEE CIM article, the same lead authors published the field\u2019s canonical successor overview, "Ant Colony Optimization: Overview and Recent Advances" (Handbook of Metaheuristics, 3rd ed., 2019), which reaffirmed ACO as an established and leading swarm-intelligence metaheuristic and consolidated its theory, variants, and applications. Combined with ACO\u2019s durable, heavy uptake, this review-level treatment marks the community\u2019s settled acceptance of the technique rather than a contested claim. It is a consensus confirmation, not a retraction or overturn.',
      sourceExternalId: 'src:aco-overview-recent-advances-2019',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'YEAR',
      reason:
        'Thirteen years after the original IEEE CIM article, the same lead authors published the field\u2019s canonical successor overview, "Ant Colony Optimization: Overview and Recent Advances" (Handbook of Metaheuristics, 3rd ed., 2019), which reaffirmed ACO as an established and leading swarm-intelligence metaheuristic and consolidated its theory, variants, and applications. Combined with ACO\u2019s durable, heavy uptake, this review-level treatment marks the community\u2019s settled acceptance of the technique rather than a contested claim. It is a consensus confirmation, not a retraction or overturn.',
      sourceExternalId: 'src:aco-overview-recent-advances-2019',
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED, 2019)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
