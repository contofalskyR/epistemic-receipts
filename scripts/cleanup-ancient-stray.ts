import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Stray claims accidentally created by a duplicate seed run (events already in DB).
const STRAY_CLAIM_EXT_IDS = [
  'trajectory:sn386-guest-star-386',
  'trajectory:sn393-guest-star-393',
]

// Orphan sources introduced by the same run. NOTE: src:diodorus-20-5-eclipse and
// src:nasa-solar-eclipse-canon-310bce are intentionally EXCLUDED — they are used by
// the legitimate trajectory:agathocles-eclipse-310bce claim.
const STRAY_SOURCE_EXT_IDS = [
  'src:halley-87bce-babylonian',
  'src:wikipedia-halley-87bce',
  'src:jinshu-songshu-sn386',
  'src:wikipedia-sn386',
  'src:songshu-sn393',
  'src:wikipedia-sn393',
]

async function main() {
  const claims = await prisma.claim.findMany({ where: { externalId: { in: STRAY_CLAIM_EXT_IDS } } })
  const sources = await prisma.source.findMany({ where: { externalId: { in: STRAY_SOURCE_EXT_IDS } } })
  const claimIds = claims.map((c) => c.id)
  const sourceIds = sources.map((s) => s.id)

  console.log(`Found ${claims.length} stray claims, ${sources.length} stray sources.`)

  const edgeDel = await prisma.edge.deleteMany({
    where: { OR: [{ claimId: { in: claimIds } }, { sourceId: { in: sourceIds } }] },
  })
  const cshDel = await prisma.claimStatusHistory.deleteMany({
    where: { OR: [{ claimId: { in: claimIds } }, { sourceId: { in: sourceIds } }] },
  })
  console.log(`Deleted ${edgeDel.count} edges, ${cshDel.count} status-history rows.`)

  const claimDel = await prisma.claim.deleteMany({ where: { id: { in: claimIds } } })
  const sourceDel = await prisma.source.deleteMany({ where: { id: { in: sourceIds } } })
  console.log(`Deleted ${claimDel.count} claims, ${sourceDel.count} sources.`)

  // Verify the legitimate overwritten claims survive with their original text.
  for (const ext of ['trajectory:agathocles-eclipse-310bce', 'trajectory:halley-comet-87bce-apparition']) {
    const c = await prisma.claim.findUnique({ where: { externalId: ext } })
    console.log(`${ext} present: ${!!c} — "${c?.text?.slice(0, 70)}..."`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
