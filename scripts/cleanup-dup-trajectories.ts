// One-off cleanup: remove orphan duplicate records created by an erroneous
// run of seed-human-history-trajectories.ts that re-added two modern-era SE Asia
// events already present in the DB under different externalIds:
//   - Homo luzonensis 2019 (already: trajectory:homo-luzonensis-philippines-2019)
//   - Khmer Rouge ECCC genocide verdict 2018 (already: trajectory:khmer-rouge-genocide-eccc-2018)
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// New duplicate claims that did NOT exist before the bad run.
const ORPHAN_CLAIMS = [
  'trajectory:homo-luzonensis-discovery-2019',
  'trajectory:khmer-rouge-genocide-verdict-2018',
]

// Sources created exclusively by the bad run.
// NOTE: src:detroit-luzonensis-nature-2019 is SHARED with the surviving
// luzonensis entry — it is intentionally NOT listed here.
const ORPHAN_SOURCES = [
  'src:eccc-genocide-verdict-amnesty-2018',
  'src:eccc-appeal-upheld-un-2022',
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
