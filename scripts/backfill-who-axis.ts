// Backfill epistemicAxis = 'RECORDED' for all who_gho_v1 claims with NULL axis.
//
// WHO GHO is measured/observed indicator data (life expectancy, U5MR, PM2.5, alcohol,
// obesity) — the RECORDED axis ("measured/observed, not evaluated") is the correct
// classification. ~32,713 claims were left NULL by the original axis backfill because
// the WHO ingester predates the axis schema field.
//
// Run:
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-who-axis.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const INGESTED_BY = 'who_gho_v1'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const writesEnabled = process.env.ALLOW_EDITS === 'true'
  if (!dryRun && !writesEnabled) {
    console.error('Real run requires ALLOW_EDITS=true. (Or pass --dry-run.)')
    process.exit(1)
  }

  const before = await prisma.claim.count({
    where: { ingestedBy: INGESTED_BY, epistemicAxis: null },
  })
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}`)
  console.log(`${INGESTED_BY} claims with NULL epistemicAxis: ${before}`)

  if (before === 0) {
    console.log('Nothing to do.')
    return
  }

  if (dryRun) {
    console.log('Dry-run: would set epistemicAxis = RECORDED on all rows above.')
    return
  }

  const result = await prisma.claim.updateMany({
    where: { ingestedBy: INGESTED_BY, epistemicAxis: null },
    data: { epistemicAxis: 'RECORDED' },
  })
  console.log(`Updated ${result.count} claims.`)

  const after = await prisma.claim.count({
    where: { ingestedBy: INGESTED_BY, epistemicAxis: null },
  })
  console.log(`${INGESTED_BY} claims with NULL epistemicAxis (post-update): ${after}`)
}

main()
  .catch(async err => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
