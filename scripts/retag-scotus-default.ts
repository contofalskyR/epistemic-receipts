// One-time retag: SCOTUS ingester bulk imports were auto-tagged constitutional-law,
// which is too broad (covers civil procedure, evidence, employment cases).
// This script swaps the tag to supreme-court-ruling for all courtlistener_scotus_v1 claims.
// Claims manually tagged constitutional-law (e.g. Korematsu, seeded with ingestedBy: "manual")
// are not touched because they don't have ingestedBy: "courtlistener_scotus_v1".
//
// Run once: npx tsx scripts/retag-scotus-default.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const constitutionalLaw = await prisma.topic.findUnique({ where: { slug: 'constitutional-law' } })
  if (!constitutionalLaw) {
    console.error('Topic "constitutional-law" not found — nothing to retag')
    process.exit(1)
  }

  const scotusTopic = await prisma.topic.findUnique({ where: { slug: 'supreme-court-ruling' } })
  if (!scotusTopic) {
    console.error('Topic "supreme-court-ruling" not found — run npx tsx scripts/seed-topics.ts first')
    process.exit(1)
  }

  // All claims ingested by the SCOTUS bulk ingester that carry the constitutional-law tag
  const targets = await prisma.claimTopic.findMany({
    where: {
      topicId: constitutionalLaw.id,
      claim: { ingestedBy: 'courtlistener_scotus_v1' },
    },
    select: { claimId: true },
  })

  console.log(`\n=== SCOTUS Retag: constitutional-law → supreme-court-ruling ===\n`)
  console.log(`Found ${targets.length} claim(s) to retag\n`)

  let retagged = 0
  let errors   = 0

  for (const { claimId } of targets) {
    try {
      await prisma.$transaction(async tx => {
        await tx.claimTopic.delete({
          where: { claimId_topicId: { claimId, topicId: constitutionalLaw.id } },
        })
        await tx.claimTopic.upsert({
          where:  { claimId_topicId: { claimId, topicId: scotusTopic.id } },
          update: {},
          create: { claimId, topicId: scotusTopic.id },
        })
      })
      retagged++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${claimId} — ${msg}`)
      errors++
    }
  }

  console.log(`=== Summary ===`)
  console.log(`  Retagged : ${retagged}`)
  console.log(`  Errors   : ${errors}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
