import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const source = await prisma.source.findUnique({ where: { externalId: 'src:who-smallpox-eradication-1980' } })
  if (!source) { console.log('source gone'); return }
  console.log('SOURCE NOW:', source.name)
  console.log('URL NOW:', source.url)

  const jenner = await prisma.claim.findUnique({ where: { externalId: 'trajectory:jenner-vaccination-1796' } })
  if (jenner) {
    const del = await prisma.edge.deleteMany({ where: { claimId: jenner.id, sourceId: source.id } })
    console.log(`Deleted ${del.count} orphan edge(s) jenner -> who-smallpox-eradication-1980`)
  }

  // confirm jenner edges now point only to its three legit sources
  const jennerEdges = await prisma.edge.findMany({ where: { claimId: jenner!.id }, include: { source: { select: { externalId: true } } } })
  console.log('Jenner edges now:', jennerEdges.map(e => e.source.externalId).join(', '))
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
