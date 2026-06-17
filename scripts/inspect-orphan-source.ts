import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const source = await prisma.source.findUnique({ where: { externalId: 'src:who-smallpox-eradication-1980' } })
  if (!source) { console.log('source gone'); return }
  const edges = await prisma.edge.findMany({ where: { sourceId: source.id }, include: { claim: { select: { externalId: true } } } })
  const hist = await prisma.claimStatusHistory.findMany({ where: { sourceId: source.id }, include: { claim: { select: { externalId: true } } } })
  console.log('EDGES:')
  for (const e of edges) console.log(`  edge ${e.id} -> claim ${e.claim.externalId}`)
  console.log('HISTORY:')
  for (const h of hist) console.log(`  hist ${h.id} -> claim ${h.claim.externalId} (${h.fromAxis}->${h.toAxis})`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
