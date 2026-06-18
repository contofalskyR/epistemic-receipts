// One-off cleanup: remove orphan duplicate records created by an erroneous
// run of seed-human-history-trajectories.ts that re-added four modern-era events
// (Chandrayaan-1 lunar water, WHO Wuhan cluster notification, AlphaFold CASP14,
// programmable CRISPR-Cas9) already present in the DB under different externalIds.
// (The Chang'e-4 entry collided on an existing externalId and is restored by
// re-running the reverted seed, which is idempotent.)
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// New duplicate claims that did NOT exist before the bad run.
const ORPHAN_CLAIMS = [
  'trajectory:chandrayaan1-moon-water-2009',
  'trajectory:who-wuhan-pneumonia-cluster-2019',
  'trajectory:alphafold-casp14-protein-folding-2020',
  'trajectory:crispr-cas9-programmable-2012',
]

// Sources created exclusively by the bad run.
const ORPHAN_SOURCES = [
  'src:pieters-m3-moon-water-science-2009',
  'src:li-moon-ice-pnas-2018',
  'src:who-don-wuhan-pneumonia-2020',
  'src:zhou-sarscov2-bat-origin-nature-2020',
  'src:deepmind-alphafold-casp14-2020',
  'src:jumper-alphafold-nature-2021',
  'src:jinek-crispr-cas9-science-2012',
  'src:cong-crispr-mammalian-science-2013',
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
