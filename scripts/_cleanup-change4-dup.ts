import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const ext = 'trajectory:change-4-far-side-moon-landing-2019'
  const claim = await prisma.claim.findUnique({ where: { externalId: ext } })
  if (!claim) {
    console.log('No orphan claim found for', ext)
    return
  }
  const csh = await prisma.claimStatusHistory.deleteMany({ where: { claimId: claim.id } })
  const edges = await prisma.edge.deleteMany({ where: { claimId: claim.id } })
  await prisma.claim.delete({ where: { id: claim.id } })
  console.log(`Deleted orphan claim ${ext}: ${csh.count} status-history rows, ${edges.count} edges, 1 claim.`)

  // The duplicate-only sources (change-4 specific) created by the orphan run:
  const orphanSourceIds = [
    'src:change-4-launch-2018',
    'src:change-4-landing-2019',
    'src:change-4-mission-success-2019',
  ]
  for (const sid of orphanSourceIds) {
    const src = await prisma.source.findUnique({ where: { externalId: sid } })
    if (!src) { console.log('  source not found:', sid); continue }
    const refs = await prisma.edge.count({ where: { sourceId: src.id } })
    if (refs === 0) {
      await prisma.source.delete({ where: { id: src.id } })
      console.log('  deleted unreferenced source', sid)
    } else {
      console.log(`  kept source ${sid} (${refs} edges still reference it)`)
    }
  }
}

main().finally(() => prisma.$disconnect())
