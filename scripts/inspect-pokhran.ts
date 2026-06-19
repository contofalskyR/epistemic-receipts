import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const ext = 'trajectory:india-pokhran-ii-nuclear-tests-1998'
  const claim = await prisma.claim.findUnique({ where: { externalId: ext } })
  if (!claim) { console.log('no claim'); return }
  const hist = await prisma.claimStatusHistory.findMany({ where: { claimId: claim.id }, select: { id: true, toAxis: true, occurredAt: true } })
  const edges = await prisma.edge.findMany({ where: { claimId: claim.id }, select: { id: true, sourceId: true } })
  const sources = await prisma.source.findMany({ where: { id: { in: edges.map(e => e.sourceId) } }, select: { id: true, externalId: true } })
  console.log('claim.id', claim.id)
  console.log('history:', JSON.stringify(hist, null, 2))
  console.log('edges->source externalIds:', sources.map(s => s.externalId))

  // Also list my orphan sources from the removed blocks
  const myOrphanExt = [
    'src:india-smiling-buddha-1974','src:india-pokhran-ii-1998','src:india-pokhran-ii-seismic-1998',
    'src:india-last-polio-case-2011','src:india-removed-endemic-list-2012','src:who-searo-polio-free-2014',
  ]
  const orphans = await prisma.source.findMany({ where: { externalId: { in: myOrphanExt } }, select: { id: true, externalId: true } })
  for (const o of orphans) {
    const ec = await prisma.edge.count({ where: { sourceId: o.id } })
    const cshc = await prisma.claimStatusHistory.count({ where: { sourceId: o.id } })
    console.log(`orphan-src ${o.externalId} edges=${ec} csh=${cshc}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
