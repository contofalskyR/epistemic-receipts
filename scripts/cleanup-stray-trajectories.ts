import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STRAY_CLAIM_EXT_IDS = [
  'trajectory:battle-of-hastings-1066',
  'trajectory:las-navas-de-tolosa-1212',
  'trajectory:leo-deacon-corona-eclipse-968',
]

const STRAY_SOURCE_EXT_IDS = [
  'src:leo-deacon-history-corona',
  'src:hao-corona-968',
  'src:asc-hastings-1066',
  'src:britannica-hastings',
  'src:ibn-al-athir-hattin',
  'src:britannica-hattin',
  'src:alfonso-letter-las-navas',
  'src:britannica-las-navas',
]

async function main() {
  const claims = await prisma.claim.findMany({ where: { externalId: { in: STRAY_CLAIM_EXT_IDS } } })
  const sources = await prisma.source.findMany({ where: { externalId: { in: STRAY_SOURCE_EXT_IDS } } })
  const claimIds = claims.map((c) => c.id)
  const sourceIds = sources.map((s) => s.id)

  console.log(`Found ${claims.length} stray claims, ${sources.length} stray sources.`)

  // Delete edges & status-history referencing either the stray claims or stray sources.
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

  // Verify the legitimate Hattin claim and its original sources survive.
  const hattin = await prisma.claim.findUnique({ where: { externalId: 'trajectory:battle-of-hattin-1187' } })
  console.log(`Hattin claim present: ${!!hattin} — "${hattin?.text?.slice(0, 60)}..."`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
