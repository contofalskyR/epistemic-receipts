// Backfill: add missing edges for eu_legislation_v1 claims created without edges
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const INGESTED_BY = 'eu_legislation_v1'

async function main() {
  const claims = await prisma.claim.findMany({
    where: { ingestedBy: INGESTED_BY, edges: { none: {} } },
    select: { id: true, externalId: true },
  })
  console.log(`Claims missing edges: ${claims.length}`)

  let created = 0
  let errors = 0
  const BATCH = 50

  for (let i = 0; i < claims.length; i += BATCH) {
    const batch = claims.slice(i, i + BATCH)
    await prisma.$transaction(async (tx) => {
      for (const claim of batch) {
        if (!claim.externalId) { errors++; continue }
        // externalId: eu_legislation_32024R2773 → source externalId: eu_legislation_source_32024r2773
        const celex = claim.externalId.replace('eu_legislation_', '')
        const sourceExtId = `eu_legislation_source_${celex.toLowerCase()}`
        const source = await tx.source.findUnique({ where: { externalId: sourceExtId }, select: { id: true } })
        if (!source) { errors++; continue }
        await tx.edge.create({
          data: {
            claimId: claim.id,
            sourceId: source.id,
            type: 'CITES',
            ingestedBy: INGESTED_BY,
            autoApproved: true,
          },
        })
        created++
      }
    }, { timeout: 30000 })
    process.stdout.write(`  ${Math.min(i + BATCH, claims.length)}/${claims.length} processed...\r`)
  }

  console.log(`\nDone. Edges created: ${created} | Errors: ${errors}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
