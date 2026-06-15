/**
 * fix-nobel-deprecated.ts
 *
 * 662 nobel_v1 claims have verificationStatus=DEPRECATED incorrectly.
 * Only uspto_v1 should have DEPRECATED status.
 * This script patches them back to VERIFIED (Nobel prizes don't get un-awarded).
 *
 * Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/fix-nobel-deprecated.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`=== Nobel DEPRECATED fix (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ===`)

  // Count affected claims
  const count = await prisma.claim.count({
    where: {
      ingestedBy: 'nobel_v1',
      verificationStatus: 'DEPRECATED',
    },
  })
  console.log(`Found ${count} nobel_v1 claims with verificationStatus=DEPRECATED`)

  if (count === 0) {
    console.log('Nothing to fix.')
    return
  }

  // Sample 5 to confirm
  const sample = await prisma.claim.findMany({
    where: { ingestedBy: 'nobel_v1', verificationStatus: 'DEPRECATED' },
    select: { id: true, text: true, externalId: true },
    take: 5,
  })
  console.log('\nSample records:')
  for (const c of sample) {
    console.log(`  ${c.id} [${c.externalId}]: ${c.text.slice(0, 80)}...`)
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would update to VERIFIED. Run without --dry-run to apply.')
    return
  }

  const result = await prisma.claim.updateMany({
    where: {
      ingestedBy: 'nobel_v1',
      verificationStatus: 'DEPRECATED',
    },
    data: {
      verificationStatus: 'VERIFIED',
    },
  })

  console.log(`\nUpdated ${result.count} claims → VERIFIED`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
