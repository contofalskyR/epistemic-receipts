import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Duplicate claims accidentally created (same events already exist under other externalIds)
const DUP_CLAIMS = [
  'trajectory:babylonian-total-eclipse-136bce',
  'trajectory:chinese-eclipse-709bce',
  'trajectory:assyrian-bur-sagale-eclipse-763bce',
  'trajectory:meton-solstice-432bce',
]

// Sources unique to the duplicates (safe to delete). The two colliding sources
// (src:assyrian-eponym-canon-bur-sagale, src:ptolemy-almagest-meton-solstice)
// are shared with pre-existing trajectories and are intentionally NOT deleted —
// re-running the seed restores their original name/url.
const DUP_SOURCES = [
  'src:babylonian-diary-136bce-eclipse',
  'src:imcce-babylon-136bce-eclipse',
  'src:spring-autumn-annals-709bce-eclipse',
  'src:hayakawa-2025-709bce-eclipse',
  'src:assyrian-eclipse-chronology-anchor',
  'src:meton-solstice-432bce-observation',
]

async function main() {
  for (const extId of DUP_CLAIMS) {
    const claim = await prisma.claim.findUnique({ where: { externalId: extId } })
    if (!claim) {
      console.log(`  (not found) ${extId}`)
      continue
    }
    const edges = await prisma.edge.deleteMany({ where: { claimId: claim.id } })
    const hist = await prisma.claimStatusHistory.deleteMany({ where: { claimId: claim.id } })
    await prisma.claim.delete({ where: { id: claim.id } })
    console.log(`  ✓ deleted ${extId} (edges: ${edges.count}, history: ${hist.count})`)
  }

  for (const sid of DUP_SOURCES) {
    const src = await prisma.source.findUnique({ where: { externalId: sid } })
    if (!src) {
      console.log(`  (source not found) ${sid}`)
      continue
    }
    const refEdges = await prisma.edge.count({ where: { sourceId: src.id } })
    const refHist = await prisma.claimStatusHistory.count({ where: { sourceId: src.id } })
    if (refEdges > 0 || refHist > 0) {
      console.log(`  ! KEEPING ${sid} — still referenced (edges: ${refEdges}, history: ${refHist})`)
      continue
    }
    await prisma.source.delete({ where: { id: src.id } })
    console.log(`  ✓ deleted source ${sid}`)
  }

  await prisma.$disconnect()
}

main()
