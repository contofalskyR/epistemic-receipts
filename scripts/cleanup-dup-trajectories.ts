// One-off cleanup: remove orphan duplicate records created by an erroneous
// run of seed-human-history-trajectories.ts that re-added four events
// (Pydna eclipse, Agathocles eclipse, Babylonian Halley, Zhang Heng seismoscope)
// already present in the DB under different externalIds.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// New duplicate claims that did NOT exist before the bad run.
const ORPHAN_CLAIMS = [
  'trajectory:pydna-eclipse-168bce',
  'trajectory:babylonian-halley-164bce',
  'trajectory:zhang-heng-seismoscope-134ce',
]

// Sources created exclusively by the bad run. NOTE: src:nasa-solar-eclipse-canon-310bce
// is intentionally excluded — it is shared with the pre-existing Agathocles entry.
const ORPHAN_SOURCES = [
  'src:pliny-hn-2-53-sulpicius-gallus',
  'src:nasa-lunar-eclipse-canon-168bce',
  'src:diodorus-20-5-agathocles-eclipse',
  'src:penn-expedition-babylonian-halley',
  'src:stephenson-1985-babylonian-halley',
  'src:hou-hanshu-zhang-heng-seismoscope',
  'src:zhang-heng-longxi-confirmation',
  'src:earthquake-science-2006-longxi',
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
    const e = await prisma.edge.deleteMany({ where: { sourceId: src.id } })
    const h = await prisma.claimStatusHistory.deleteMany({ where: { sourceId: src.id } })
    if (h.count > 0) console.log(`  WARNING ${ext} had ${h.count} history rows referencing it`)
    await prisma.source.delete({ where: { id: src.id } })
    console.log(`source ${ext}: deleted (${e.count} edges)`)
  }

  console.log('Cleanup done.')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
