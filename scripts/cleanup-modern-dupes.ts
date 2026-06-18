// One-off cleanup: revert an accidental run that added 5 duplicate "modern era"
// trajectories to seed-human-history-trajectories.ts.
//
// - 2 created NEW orphan claims (different externalId) -> delete entirely.
// - 3 collided with existing externalIds (upsert overwrote them; the originals
//   have since been restored by re-running the seed) -> remove only the extra
//   sources/edges my run introduced.
//
// A candidate source is deleted ONLY if no ClaimStatusHistory references it
// (i.e. it is genuinely orphaned by my run and not used by the restored original).

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ORPHAN_CLAIMS = [
  'trajectory:homo-floresiensis-flores-2004',
  'trajectory:rwandan-genocide-1994',
]

const CANDIDATE_SOURCES = [
  'src:sino-british-joint-declaration-1984',
  'src:hong-kong-handover-ceremony-1997',
  'src:rwandan-genocide-onset-1994',
  'src:ictr-resolution-955-1994',
  'src:east-timor-referendum-1999',
  'src:untaet-resolution-1272-1999',
  'src:pokhran-ii-tests-1998',
  'src:unsc-resolution-1172-1998',
  'src:homo-floresiensis-nature-2004',
  'src:mata-menge-floresiensis-2016',
]

async function main() {
  // 1. Delete orphan claims (edges first — no cascade on Edge->Claim).
  for (const ext of ORPHAN_CLAIMS) {
    const claim = await prisma.claim.findUnique({ where: { externalId: ext } })
    if (!claim) {
      console.log(`  - claim not found (already gone): ${ext}`)
      continue
    }
    await prisma.edge.deleteMany({ where: { claimId: claim.id } })
    await prisma.claimStatusHistory.deleteMany({ where: { claimId: claim.id } })
    await prisma.claim.delete({ where: { id: claim.id } })
    console.log(`  ✓ deleted orphan claim + edges + history: ${ext}`)
  }

  // 2. Delete sources I introduced that no ClaimStatusHistory references.
  for (const ext of CANDIDATE_SOURCES) {
    const source = await prisma.source.findUnique({ where: { externalId: ext } })
    if (!source) {
      console.log(`  - source not found: ${ext}`)
      continue
    }
    const refCount = await prisma.claimStatusHistory.count({ where: { sourceId: source.id } })
    if (refCount > 0) {
      console.log(`  · KEEP ${ext} — referenced by ${refCount} status-history row(s)`)
      continue
    }
    const edgeCount = await prisma.edge.deleteMany({ where: { sourceId: source.id } })
    await prisma.source.delete({ where: { id: source.id } })
    console.log(`  ✓ deleted orphan source + ${edgeCount.count} edge(s): ${ext}`)
  }

  await prisma.$disconnect()
  console.log('Done.')
}

main()
