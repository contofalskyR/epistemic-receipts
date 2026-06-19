// One-off cleanup: remove orphan duplicate records created by an erroneous run
// of seed-human-history-trajectories.ts that re-added pre-500 CE Byzantine/Balkan
// events already present under different externalIds (Frigidus, Ephesus) and that
// left stray sources/edges on the shared-id Adrianople/Chalcedon claims.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// New duplicate claims that did NOT exist before the bad run (originals live
// under battle-of-frigidus-394 and council-ephesus-431).
const ORPHAN_CLAIMS = [
  'trajectory:battle-of-the-frigidus-394',
  'trajectory:council-of-ephesus-431',
]

// Sources invented by the bad run that no longer appear in the seed file.
// (src:acts-council-ephesus-431 and src:acts-council-chalcedon-451 are SHARED
//  with the surviving originals — intentionally NOT listed here.)
const ORPHAN_SOURCES = [
  'src:ammianus-res-gestae-adrianople',
  'src:adrianople-378-scholarship',
  'src:rufinus-historia-frigidus',
  'src:frigidus-394-scholarship',
  'src:formula-of-reunion-433',
  'src:chalcedon-imperial-confirmation',
  'src:oriental-orthodox-chalcedon-schism',
]

async function main() {
  for (const ext of ORPHAN_CLAIMS) {
    const claim = await prisma.claim.findUnique({ where: { externalId: ext } })
    if (!claim) {
      console.log(`  - claim ${ext} not found (already clean)`)
      continue
    }
    const edges = await prisma.edge.deleteMany({ where: { claimId: claim.id } })
    await prisma.claim.delete({ where: { id: claim.id } }) // CSH cascades
    console.log(`  ✓ deleted claim ${ext} (${edges.count} edges)`)
  }

  for (const ext of ORPHAN_SOURCES) {
    const source = await prisma.source.findUnique({ where: { externalId: ext } })
    if (!source) {
      console.log(`  - source ${ext} not found (already clean)`)
      continue
    }
    const edges = await prisma.edge.deleteMany({ where: { sourceId: source.id } })
    await prisma.source.delete({ where: { id: source.id } })
    console.log(`  ✓ deleted source ${ext} (${edges.count} stray edges)`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
