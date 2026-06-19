import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const ext = 'trajectory:india-polio-free-certification-2014'
  const claim = await prisma.claim.findUnique({ where: { externalId: ext } })
  if (!claim) {
    console.log(`No claim found for ${ext} — nothing to delete.`)
    return
  }
  const edges = await prisma.edge.deleteMany({ where: { claimId: claim.id } })
  const hist = await prisma.claimStatusHistory.deleteMany({ where: { claimId: claim.id } })
  await prisma.claim.delete({ where: { id: claim.id } })
  console.log(`Deleted claim ${ext} (id=${claim.id}); edges=${edges.count}, statusHistory=${hist.count}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
