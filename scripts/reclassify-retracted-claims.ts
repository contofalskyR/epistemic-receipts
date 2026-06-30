/**
 * Phase 3: Reclassify retracted OpenAlex claims from SETTLED -> CONTESTED.
 *
 * Background: the initial OpenAlex backfill tagged all published papers as
 * epistemicAxis = 'SETTLED'. But a paper that was later retracted is, by
 * definition, contested. Retractions are modeled as a REVERSED ClaimRelation
 * where:
 *   - fromClaimId = the original paper (should become CONTESTED)
 *   - toClaimId   = the retraction notice itself (also CONTESTED if SETTLED)
 *
 * This script finds claims on either side of a REVERSED relation that are
 * still SETTLED and flips them to CONTESTED.
 *
 * Only the epistemicAxis field is touched. The WHERE clause guards on the
 * current value (epistemicAxis = 'SETTLED'), so re-running is a no-op.
 * Safe and reversible — epistemicAxis is a derived field.
 *
 * Processes in chunks of 500.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CHUNK = 500

async function reclassify(side: 'from' | 'to'): Promise<number> {
  const idColumn = side === 'from' ? 'fromClaimId' : 'toClaimId'
  const label = side === 'from' ? 'originals (fromClaimId)' : 'retractions (toClaimId)'

  // Collect distinct claim ids that are SETTLED and sit on this side of a
  // REVERSED relation.
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT DISTINCT cr."${idColumn}" AS id
       FROM "ClaimRelation" cr
       JOIN "Claim" c ON c.id = cr."${idColumn}"
      WHERE cr."relationType" = 'REVERSED'
        AND c."epistemicAxis" = 'SETTLED'
        AND c.deleted = false`,
  )

  const ids = rows.map(r => r.id)
  console.log(`[${label}] ${ids.length} SETTLED claim(s) to reclassify`)

  let updated = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const res = await prisma.claim.updateMany({
      where: {
        id: { in: chunk },
        epistemicAxis: 'SETTLED', // guard: only flip if still SETTLED
      },
      data: { epistemicAxis: 'CONTESTED' },
    })
    updated += res.count
    console.log(
      `[${label}] chunk ${Math.floor(i / CHUNK) + 1}: updated ${res.count} (running total ${updated})`,
    )
  }

  return updated
}

async function main() {
  console.log('Phase 3: reclassifying retracted claims SETTLED -> CONTESTED\n')

  // Before counts
  const before = await prisma.claim.count({ where: { epistemicAxis: 'CONTESTED' } })
  console.log(`CONTESTED claims before: ${before}\n`)

  const fromUpdated = await reclassify('from')
  const toUpdated = await reclassify('to')
  const total = fromUpdated + toUpdated

  // After counts
  const after = await prisma.claim.count({ where: { epistemicAxis: 'CONTESTED' } })

  console.log('\n--- Summary ---')
  console.log(`originals updated:    ${fromUpdated}`)
  console.log(`retractions updated:  ${toUpdated}`)
  console.log(`total updated:        ${total}`)
  console.log(`CONTESTED before:     ${before}`)
  console.log(`CONTESTED after:      ${after}`)
  console.log(`delta:                ${after - before}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
