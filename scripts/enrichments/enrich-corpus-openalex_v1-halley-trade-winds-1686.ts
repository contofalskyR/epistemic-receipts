// Enrich: Halley (1686) "An Historical Account of the Trade Winds, and Monsoons"
// — an attempt to assign the physical cause of the trade winds.
//
// Post-publication arc: Halley's proposed physical mechanism (the sun's heat
// tracking westward and dragging the air with it) was directly critiqued and
// superseded by George Hadley's 1735 paper "Concerning the Cause of the General
// Trade-Winds," which opened by stating prior explanations were inadequate and
// supplied the rotation / angular-momentum account now known as the Hadley cell.
// This is a dated, citable major methodological critique → RECORDED -> CONTESTED.
//
// The baseline (fromAxis=null -> RECORDED, 1686-09-30) already exists; do NOT
// duplicate it. Idempotent: upserts on stable ids.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-halley-trade-winds-1686.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq3lldbf4wopsavcucnf5for'

async function main() {
  // ── RECORDED -> CONTESTED: Hadley (1735) supersedes Halley's mechanism ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:hadley-trade-winds-critique-1735' },
    create: {
      externalId: 'src:hadley-trade-winds-critique-1735',
      name: 'Hadley G. VI. Concerning the cause of the general trade-winds. Philosophical Transactions of the Royal Society of London 1735;39(437):58–62.',
      url: 'https://royalsocietypublishing.org/rstl/article/39/437/58/25395/VI-Concerning-the-cause-of-the-general-trade-winds',
      publishedAt: new Date('1735-06-30'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1',
    },
    update: {
      name: 'Hadley G. VI. Concerning the cause of the general trade-winds. Philosophical Transactions of the Royal Society of London 1735;39(437):58–62.',
      url: 'https://royalsocietypublishing.org/rstl/article/39/437/58/25395/VI-Concerning-the-cause-of-the-general-trade-winds',
      publishedAt: new Date('1735-06-30'),
      methodologyType: 'primary',
    },
  })

  const slug = `${CLAIM_ID}-CONTESTED-1735-06-30`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1735-06-30'),
      datePrecision: 'DAY',
      reason:
        'George Hadley\'s 1735 paper directly contested Halley\'s physical explanation of the trade winds, opening that "the causes of the general trade-winds have not been fully explained by any of those who have wrote on that subject." Where Halley attributed the easterly winds to the sun\'s heat moving westward and dragging the air, Hadley showed this was insufficient and supplied the mechanism of Earth\'s rotation and conservation of angular momentum — the account later formalized as the Hadley cell. Halley\'s proposed physical cause was thereby superseded within the expert literature.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1735-06-30'),
      datePrecision: 'DAY',
      reason:
        'George Hadley\'s 1735 paper directly contested Halley\'s physical explanation of the trade winds, opening that "the causes of the general trade-winds have not been fully explained by any of those who have wrote on that subject." Where Halley attributed the easterly winds to the sun\'s heat moving westward and dragging the air, Hadley showed this was insufficient and supplied the mechanism of Earth\'s rotation and conservation of angular momentum — the account later formalized as the Hadley cell. Halley\'s proposed physical cause was thereby superseded within the expert literature.',
      sourceId: source.id,
    },
  })

  console.log('Enriched claim', CLAIM_ID, '-> CONTESTED (Hadley 1735)')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
