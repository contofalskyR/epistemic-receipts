/**
 * pick-promotable-claim.ts — openalex promoter claim selector.
 *
 * Retargeted 2026-07-03 (see CORPUS-PROMOTER-BULK-PLAN.md §5): after wave 1
 * (205,679 vote/FDA claims), wave 2 (18,280 retraction curves), and the
 * completeness reclassification (lib/corpus-completeness.ts), openalex_v1 is
 * the only large pipeline whose settling curves genuinely need LLM research.
 * The old FDA/votes/openalex tier alternation is gone.
 *
 * Selection: single-step openalex_v1 claims (exactly one ClaimStatusHistory
 * row, the fromAxis=null baseline), highest metadata.cited_by_count first so
 * high-impact papers get curved before the long tail. Claims without a
 * citation count sort last (0), then by recency.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/pick-promotable-claim.ts \
 *     [--count 8] [--attempted path] [--pipeline openalex_v1]
 *
 * --pipeline may override the default for occasional manual runs (e.g.
 * crossref_retractions_v1 residue that wave 2 couldn't date), but pipelines
 * classified complete-at-length-1 are always refused.
 *
 * Output (newline-delimited JSON, one per line):
 *   { "id": "...", "text": "...", "ingestedBy": "...", "claimEmergedAt": "...", "citedByCount": N, "doi": "..." | null, "isRetracted": bool, "openalexId": "..." | null }
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { COMPLETE_SINGLE_STEP } from '../lib/corpus-completeness'

const prisma = new PrismaClient()

const DEFAULT_PIPELINE = 'openalex_v1'

// ── Parse CLI args ────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let count = 8
  let attemptedPath: string | null = null
  let pipeline = DEFAULT_PIPELINE

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--attempted' && args[i + 1]) {
      attemptedPath = args[i + 1]
      i++
    } else if (args[i] === '--pipeline' && args[i + 1]) {
      pipeline = args[i + 1]
      i++
    }
    // (--run is obsolete and silently ignored if passed by an old loop script)
  }

  return { count, attemptedPath, pipeline }
}

// ── Load already-attempted claim IDs ──────────────────────────────────────────

function loadAttemptedIds(path: string | null): Set<string> {
  if (!path) return new Set()
  try {
    const raw = fs.readFileSync(path, 'utf8')
    const ids = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line).claimId as string
        } catch {
          return null
        }
      })
      .filter((id): id is string => id !== null)
    return new Set(ids)
  } catch {
    // File doesn't exist yet — start fresh
    return new Set()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Candidate {
  id: string
  text: string
  ingestedBy: string
  claimEmergedAt: Date | null
  citedByCount: number
  doi: string | null
  isRetracted: boolean
  openalexId: string | null
}

async function main() {
  const { count, attemptedPath, pipeline } = parseArgs()
  const attempted = loadAttemptedIds(attemptedPath)

  // Defensive: never hand the LLM a pipeline classified complete-at-length-1.
  if (COMPLETE_SINGLE_STEP.has(pipeline)) {
    console.error(`Refusing: ${pipeline} is classified complete-at-length-1 (lib/corpus-completeness.ts)`)
    process.exit(1)
  }

  // Single-step = has a baseline row (fromAxis IS NULL) and nothing else.
  // Ordering (2026-07-05): cited_by_count DESC first — but ingest-openalex.ts
  // stores NO cited_by_count, so today that column is uniformly 0 and the
  // tiebreak decides. Tiebreak is OLDEST-first, not newest: a settling event
  // (retraction, replication, meta-analysis) needs YEARS to accrue, so the
  // oldest papers have the best hit rate; newest-first guaranteed SKIPs on
  // weeks-old papers. When citation counts get backfilled (briefing 06 Phase
  // A), the DESC clause auto-prioritizes high-impact papers with no code change.
  const fetchLimit = count + attempted.size + 50
  const candidates = (await prisma.$queryRawUnsafe(
    `SELECT
       c.id, c.text, c."ingestedBy", c."claimEmergedAt",
       CASE WHEN (c.metadata->>'cited_by_count') ~ '^\\d+$'
            THEN (c.metadata->>'cited_by_count')::int ELSE 0 END AS "citedByCount",
       c.metadata->>'doi' AS doi,
       (c.metadata->>'is_retracted')::boolean AS "isRetracted",
       c.metadata->>'openalex_id' AS "openalexId"
     FROM "Claim" c
     JOIN "ClaimStatusHistory" h
       ON h."claimId" = c.id AND h."fromAxis" IS NULL
     WHERE c."ingestedBy" = $1
       AND c.deleted = false
       AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
       AND c."claimEmergedAt" IS NOT NULL
       AND c."claimEmergedAt" < now() - interval '2 years'
       AND (c.metadata->>'is_retracted') IS DISTINCT FROM 'true'
       AND c.text !~* '^\\s*(Retracted[: ]|Retraction[: ]|Notice of Retraction|Expression of Concern|Erratum[: ]|Correction[: ])'
       AND NOT EXISTS (
         SELECT 1 FROM "ClaimStatusHistory" h2
         WHERE h2."claimId" = c.id AND h2.id <> h.id
       )
     ORDER BY 5 DESC, c."claimEmergedAt" ASC
     LIMIT $2`,
    pipeline,
    fetchLimit,
  )) as Candidate[]

  const picked = candidates.filter((c) => !attempted.has(c.id)).slice(0, count)

  for (const claim of picked) {
    console.log(JSON.stringify(claim))
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
