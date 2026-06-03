// One-time migration: rename ad-hoc court Topic slugs to canonical court-<id> form.
//
// The circuits + state-supreme ingesters historically created Topics with
// ad-hoc slugs (e.g. `us-court-of-appeals-9th-circuit`, `california-supreme-court`).
// The canonical form going forward is `court-<CL-id>` (e.g. `court-ca9`, `court-cal`)
// so the topic trees produced by the various CourtListener ingesters merge into
// a single per-court Topic instead of duplicating.
//
// Idempotent: re-running is safe. For each entry:
//   1. Find existing Topic by old slug. If not found, skip.
//   2. If a Topic with the target new slug already exists, skip.
//   3. Otherwise update `topic.slug` to the new value.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-court-slugs.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-court-slugs.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SlugRename {
  oldSlug: string
  newSlug: string
  courtId: string
}

const RENAMES: SlugRename[] = [
  // Federal circuits
  { oldSlug: 'us-court-of-appeals-1st-circuit',        newSlug: 'court-ca1',   courtId: 'ca1'   },
  { oldSlug: 'us-court-of-appeals-2nd-circuit',        newSlug: 'court-ca2',   courtId: 'ca2'   },
  { oldSlug: 'us-court-of-appeals-3rd-circuit',        newSlug: 'court-ca3',   courtId: 'ca3'   },
  { oldSlug: 'us-court-of-appeals-4th-circuit',        newSlug: 'court-ca4',   courtId: 'ca4'   },
  { oldSlug: 'us-court-of-appeals-5th-circuit',        newSlug: 'court-ca5',   courtId: 'ca5'   },
  { oldSlug: 'us-court-of-appeals-6th-circuit',        newSlug: 'court-ca6',   courtId: 'ca6'   },
  { oldSlug: 'us-court-of-appeals-7th-circuit',        newSlug: 'court-ca7',   courtId: 'ca7'   },
  { oldSlug: 'us-court-of-appeals-8th-circuit',        newSlug: 'court-ca8',   courtId: 'ca8'   },
  { oldSlug: 'us-court-of-appeals-9th-circuit',        newSlug: 'court-ca9',   courtId: 'ca9'   },
  { oldSlug: 'us-court-of-appeals-10th-circuit',       newSlug: 'court-ca10',  courtId: 'ca10'  },
  { oldSlug: 'us-court-of-appeals-11th-circuit',       newSlug: 'court-ca11',  courtId: 'ca11'  },
  { oldSlug: 'us-court-of-appeals-dc-circuit',         newSlug: 'court-cadc',  courtId: 'cadc'  },
  { oldSlug: 'us-court-of-appeals-federal-circuit',    newSlug: 'court-cafc',  courtId: 'cafc'  },
  // State supremes
  { oldSlug: 'california-supreme-court',               newSlug: 'court-cal',   courtId: 'cal'   },
  { oldSlug: 'new-york-court-of-appeals',              newSlug: 'court-ny',    courtId: 'ny'    },
  { oldSlug: 'texas-supreme-court',                    newSlug: 'court-tex',   courtId: 'tex'   },
  { oldSlug: 'florida-supreme-court',                  newSlug: 'court-fla',   courtId: 'fla'   },
  { oldSlug: 'illinois-supreme-court',                 newSlug: 'court-ill',   courtId: 'ill'   },
  { oldSlug: 'pennsylvania-supreme-court',             newSlug: 'court-pa',    courtId: 'pa'    },
  { oldSlug: 'ohio-supreme-court',                     newSlug: 'court-ohio',  courtId: 'ohio'  },
  { oldSlug: 'washington-supreme-court',               newSlug: 'court-wash',  courtId: 'wash'  },
  { oldSlug: 'massachusetts-supreme-judicial-court',   newSlug: 'court-mass',  courtId: 'mass'  },
  { oldSlug: 'new-jersey-supreme-court',               newSlug: 'court-nj',    courtId: 'nj'    },
  { oldSlug: 'georgia-supreme-court',                  newSlug: 'court-ga',    courtId: 'ga'    },
  { oldSlug: 'virginia-supreme-court',                 newSlug: 'court-va',    courtId: 'va'    },
  { oldSlug: 'michigan-supreme-court',                 newSlug: 'court-mich',  courtId: 'mich'  },
  { oldSlug: 'colorado-supreme-court',                 newSlug: 'court-colo',  courtId: 'colo'  },
  { oldSlug: 'arizona-supreme-court',                  newSlug: 'court-ariz',  courtId: 'ariz'  },
]

function parseDryRun(): boolean {
  return process.argv.includes('--dry-run')
}

async function main() {
  const dryRun = parseDryRun()

  console.log(`\n=== Court slug migration → court-<id> form${dryRun ? ' [DRY RUN]' : ''} ===\n`)

  let renamed       = 0
  let skippedMissing = 0
  let skippedTarget  = 0
  let errors        = 0

  for (const { oldSlug, newSlug } of RENAMES) {
    try {
      const existing = await prisma.topic.findUnique({ where: { slug: oldSlug } })
      if (!existing) {
        console.log(`  Skipped (not found): ${oldSlug}`)
        skippedMissing++
        continue
      }

      const target = await prisma.topic.findUnique({ where: { slug: newSlug } })
      if (target) {
        console.log(`  Skipped (target exists): ${oldSlug} → ${newSlug}`)
        skippedTarget++
        continue
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would rename: ${oldSlug} → ${newSlug}`)
        renamed++
        continue
      }

      await prisma.topic.update({
        where: { id: existing.id },
        data:  { slug: newSlug },
      })
      console.log(`  Renamed: ${oldSlug} → ${newSlug}`)
      renamed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${oldSlug} → ${newSlug} — ${msg}`)
      errors++
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  ${dryRun ? 'Would rename' : 'Renamed'}     : ${renamed}`)
  console.log(`  Skipped (not found)  : ${skippedMissing}`)
  console.log(`  Skipped (target hit) : ${skippedTarget}`)
  console.log(`  Errors               : ${errors}`)
  console.log('')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
