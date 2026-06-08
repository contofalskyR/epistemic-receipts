/**
 * Backfill epistemicAxis from currentStatus + epistemicStatus.
 *
 * Mapping (priority order — epistemicStatus takes precedence):
 *   epistemicStatus IN (retracted, contested, contested_dissent) → CONTESTED
 *   epistemicStatus IN (active_trial, candidate)                 → OPEN
 *   currentStatus = HARD_FACT                                    → SETTLED
 *   currentStatus = NEVER_RESOLVES                               → UNRESOLVABLE
 *   epistemicStatus IN (confirmed, approved, settled_judgment,
 *     completed_trial, registered_trial, false_positive,
 *     established)                                               → RECORDED
 *   everything else                                              → RECORDED
 *
 * Runs in batches of 5000 with a 30s transaction timeout.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BATCH = 5000

async function main() {
  const counts: Record<string, number> = {
    SETTLED: 0,
    CONTESTED: 0,
    OPEN: 0,
    UNRESOLVABLE: 0,
    RECORDED: 0,
  }

  let cursor: string | undefined
  let total = 0
  let batch = 0

  console.log('Starting epistemicAxis backfill...')

  while (true) {
    const claims = await prisma.claim.findMany({
      where: {
        deleted: false,
        epistemicAxis: null,
      },
      select: {
        id: true,
        currentStatus: true,
        epistemicStatus: true,
      },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (claims.length === 0) break

    cursor = claims[claims.length - 1].id
    batch++

    // Compute axis for each claim in this batch
    const updates: { id: string; axis: string }[] = claims.map(c => ({
      id: c.id,
      axis: computeAxis(c.currentStatus, c.epistemicStatus),
    }))

    // Group by axis value to run efficient bulk updates
    const byAxis: Record<string, string[]> = {}
    for (const u of updates) {
      if (!byAxis[u.axis]) byAxis[u.axis] = []
      byAxis[u.axis].push(u.id)
    }

    await prisma.$transaction(
      async (tx) => {
        for (const [axis, ids] of Object.entries(byAxis)) {
          await tx.$executeRaw`
            UPDATE "Claim"
            SET "epistemicAxis" = ${axis}
            WHERE id = ANY(${ids}::text[])
          `
          counts[axis] = (counts[axis] || 0) + ids.length
        }
      },
      { timeout: 30000 }
    )

    total += claims.length
    console.log(`Batch ${batch}: processed ${claims.length} claims (total: ${total})`)
  }

  console.log('\nBackfill complete.')
  console.log('Distribution:')
  for (const [axis, count] of Object.entries(counts)) {
    console.log(`  ${axis}: ${count}`)
  }
  console.log(`  TOTAL: ${total}`)

  return counts
}

function computeAxis(currentStatus: string, epistemicStatus: string | null): string {
  const es = epistemicStatus?.toLowerCase()

  // Contested signals take priority
  if (es && ['retracted', 'contested', 'contested_dissent'].includes(es)) return 'CONTESTED'

  // Open frontier
  if (es && ['active_trial', 'candidate'].includes(es)) return 'OPEN'

  // currentStatus-based
  if (currentStatus === 'HARD_FACT') return 'SETTLED'
  if (currentStatus === 'NEVER_RESOLVES') return 'UNRESOLVABLE'

  // Known epistemicStatus values that map to RECORDED
  if (es && [
    'confirmed', 'approved', 'settled_judgment',
    'completed_trial', 'registered_trial', 'false_positive', 'established',
  ].includes(es)) return 'RECORDED'

  // Default
  return 'RECORDED'
}

main()
  .then(counts => {
    console.log('\nFinal counts JSON:', JSON.stringify(counts))
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect())
