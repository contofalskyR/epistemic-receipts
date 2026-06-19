// One-off cleanup: remove orphan duplicate records created by an erroneous
// run of seed-human-history-trajectories.ts that re-added two ancient-Rome
// events already present in the DB under different externalIds:
//   - Battle of Adrianople 378 CE (already: trajectory:battle-of-adrianople-378)
//   - Battle of the Frigidus 394 CE (already: trajectory:battle-of-frigidus-394)
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// New duplicate claims that did NOT exist before the bad run.
const ORPHAN_CLAIMS = [
  'trajectory:battle-of-adrianople-378ce',
  'trajectory:battle-of-the-frigidus-394ce',
]

// Sources created exclusively by the bad run.
const ORPHAN_SOURCES = [
  'src:ammianus-adrianople-378',
  'src:adrianople-scholarship',
  'src:frigidus-contemporary-394',
  'src:frigidus-scholarship',
]

async function main() {
  for (const ext of ORPHAN_CLAIMS) {
    const claim = await prisma.claim.findUnique({ where: { externalId: ext } })
    if (!claim) { console.log(`claim ${ext}: not found, skip`); continue }
    const e = await prisma.edge.deleteMany({ where: { claimId: claim.id } })
    const h = await prisma.claimStatusHistory.deleteMany({ where: { claimId: claim.id } })
    await prisma.claim.delete({ where: { id: claim.id } })
    console.log(`claim ${ext}: deleted (${e.count} edges, ${h.count} history)`)
  }

  for (const ext of ORPHAN_SOURCES) {
    const src = await prisma.source.findUnique({ where: { externalId: ext } })
    if (!src) { console.log(`source ${ext}: not found, skip`); continue }
    const refEdges = await prisma.edge.count({ where: { sourceId: src.id } })
    const refHist = await prisma.claimStatusHistory.count({ where: { sourceId: src.id } })
    if (refEdges > 0 || refHist > 0) {
      console.log(`source ${ext}: still referenced (${refEdges} edges, ${refHist} history), SKIP`)
      continue
    }
    await prisma.source.delete({ where: { id: src.id } })
    console.log(`source ${ext}: deleted`)
  }

  console.log('Cleanup done.')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
