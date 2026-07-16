/**
 * ab-test-fetch-claims.ts — fetch specific claims by ID for the promoter A/B test.
 *
 * pick-promotable-claim.ts selects *not-yet-attempted* claims and has no by-ID
 * mode, so this companion exists for the A/B harness: given claim IDs on argv,
 * it emits the SAME newline-delimited JSON shape the loop's build_prompt consumes:
 *   { id, text, ingestedBy, claimEmergedAt, citedByCount, doi, isRetracted, openalexId }
 *
 * READ-ONLY. One bind-parameterized SELECT. No writes of any kind.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/ab-test-fetch-claims.ts <claimId> [<claimId> ...]
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Row {
  id: string
  text: string
  ingestedBy: string
  claimEmergedAt: Date | null
  citedByCount: number
  doi: string | null
  isRetracted: boolean | null
  openalexId: string | null
}

async function main() {
  const ids = process.argv.slice(2).filter(Boolean)
  if (ids.length === 0) {
    console.error('usage: tsx scripts/ab-test-fetch-claims.ts <claimId> [<claimId> ...]')
    process.exit(1)
  }

  // Same field extraction as pick-promotable-claim.ts, filtered by explicit IDs.
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT
       c.id, c.text, c."ingestedBy", c."claimEmergedAt",
       CASE WHEN (c.metadata->>'cited_by_count') ~ '^\\d+$'
            THEN (c.metadata->>'cited_by_count')::int ELSE 0 END AS "citedByCount",
       c.metadata->>'doi' AS doi,
       (c.metadata->>'is_retracted')::boolean AS "isRetracted",
       c.metadata->>'openalex_id' AS "openalexId"
     FROM "Claim" c
     WHERE c.id = ANY($1)`,
    ids,
  )) as Row[]

  const byId = new Map(rows.map((r) => [r.id, r]))
  let missing = 0
  for (const id of ids) {
    const r = byId.get(id)
    if (!r) {
      console.error(`missing in DB: ${id}`)
      missing++
      continue
    }
    console.log(JSON.stringify(r))
  }
  if (missing > 0) console.error(`${missing}/${ids.length} ids not found`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
