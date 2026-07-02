/**
 * pick-promotable-claim.ts
 *
 * Finds corpus claims with exactly 1 ClaimStatusHistory row (single-step) from
 * high-value Tier 1 pipelines, picks one at random (round-robin across pipelines
 * via run number), and outputs JSON to stdout for the corpus-promoter loop.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/pick-promotable-claim.ts [--run N] [--count 3] [--attempted path]
 *
 * Output (newline-delimited JSON, one per line):
 *   { "id": "...", "text": "...", "ingestedBy": "...", "claimEmergedAt": "..." }
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ── Configuration ─────────────────────────────────────────────────────────────

const TIER1_PIPELINES = [
  'drugsatfda_v1',
  'crossref_retractions_v1',
  'openfda_labels_v1',
  'voteview_v1',
  'congress_bills_tracker_v1',
  'who_essential_medicines_v1',
]

const TIER2_PIPELINES = ['openalex_v1']

// ── Parse CLI args ────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let run = 0
  let count = 3
  let attemptedPath: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run' && args[i + 1]) {
      run = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--attempted' && args[i + 1]) {
      attemptedPath = args[i + 1]
      i++
    }
  }

  return { run, count, attemptedPath }
}

// ── Load already-attempted claim IDs ──────────────────────────────────────────

function loadAttemptedIds(path: string | null): string[] {
  if (!path) return []
  try {
    const raw = fs.readFileSync(path, 'utf8')
    return raw
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
  } catch {
    // File doesn't exist yet — start fresh
    return []
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { run, count, attemptedPath } = parseArgs()
  const attemptedIds = loadAttemptedIds(attemptedPath)

  // Alternate tiers: runs 0,1 = TIER1; run 2 = TIER2; then repeats
  const pipelines = run % 3 === 2 ? TIER2_PIPELINES : TIER1_PIPELINES

  // Filter out claims unlikely to have a verifiable multi-step arc
  const SKIP_PATTERNS = [
    'homeopathic', 'HOMEOPATHIC',
    'Arnica', 'Nux Vomica', 'Belladonna', 'Ignatia',
    'hand sanitizer', 'Hand Sanitizer',
    'sunscreen', 'Sunscreen', 'SUNSCREEN',
    'antiperspirant', 'Antiperspirant',
    'lip balm', 'Lip Balm',
    'toothpaste', 'Toothpaste',
    'mouthwash', 'Mouthwash',
  ]

  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: { in: pipelines },
      deleted: false,
      verificationStatus: { not: 'DEPRECATED' },
      statusHistory: { every: { fromAxis: null } },
      ...(attemptedIds.length > 0 ? { NOT: { id: { in: attemptedIds } } } : {}),
      AND: SKIP_PATTERNS.map(p => ({ text: { not: { contains: p } } })),
    },
    select: {
      id: true,
      text: true,
      ingestedBy: true,
      claimEmergedAt: true,
    },
    take: count,
    orderBy: [{ claimEmergedAt: 'desc' }],
  })

  for (const claim of claims) {
    console.log(JSON.stringify(claim))
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
