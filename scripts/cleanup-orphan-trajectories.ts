import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ORPHAN_CLAIMS = [
  'trajectory:herschel-uranus-1781',
  'trajectory:bessel-parallax-1838',
  'trajectory:bell-telephone-1876',
]

const ORPHAN_SOURCES = [
  'src:herschel-account-comet-1781',
  'src:uranus-planet-acceptance',
  'src:stellar-parallax-problem',
  'src:bessel-61-cygni-1838',
  'src:61-cygni-modern-parallax',
  'src:bell-patent-174465',
  'src:telephone-cases-1888',
  'src:who-smallpox-eradication-1980',
]

async function main() {
  for (const ext of ORPHAN_CLAIMS) {
    const claim = await prisma.claim.findUnique({ where: { externalId: ext } })
    if (!claim) {
      console.log(`  - ${ext} not found (already clean)`)
      continue
    }
    await prisma.edge.deleteMany({ where: { claimId: claim.id } })
    await prisma.claimStatusHistory.deleteMany({ where: { claimId: claim.id } })
    await prisma.claim.delete({ where: { id: claim.id } })
    console.log(`  ✓ deleted claim ${ext}`)
  }

  for (const ext of ORPHAN_SOURCES) {
    const source = await prisma.source.findUnique({ where: { externalId: ext } })
    if (!source) {
      console.log(`  - source ${ext} not found (already clean)`)
      continue
    }
    const edgeRefs = await prisma.edge.count({ where: { sourceId: source.id } })
    const histRefs = await prisma.claimStatusHistory.count({ where: { sourceId: source.id } })
    if (edgeRefs > 0 || histRefs > 0) {
      console.log(`  ! source ${ext} still referenced (edges=${edgeRefs}, hist=${histRefs}) — skipping`)
      continue
    }
    await prisma.source.delete({ where: { id: source.id } })
    console.log(`  ✓ deleted source ${ext}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
