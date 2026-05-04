// One-time backfill: auto-approve existing openFDA claims that pass all quality gates.
// Claims that fail any gate are left untouched — they stay in the manual review queue.
// Run: npx tsx scripts/backfill-openfda-auto-approval.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Quality gates ─────────────────────────────────────────────────────────────
//
// Gate 1: Has a real display name — claim text must NOT begin with the
//         application number (the old pre-fix format was "NDA018181 demonstrated…")
//
// Gate 2: Has at least one non-deleted source edge linked
//
// Gate 3: Has at least one non-deleted threshold event
//
// Gate 4: Has a parsed approval date (claimEmergedAt is not null)
//
// These mirror the skip conditions in the ingestion script: any record that
// would have been skipped at ingest time fails here too.

function extractDisplayName(claimText: string): string {
  const match = claimText.match(/^(.+?) demonstrated sufficient/)
  return match ? match[1] : claimText.slice(0, 60)
}

async function main() {
  const now = new Date()

  const candidates = await prisma.claim.findMany({
    where: { ingestedBy: 'openfda_v1', humanReviewed: false, deleted: false },
    include: {
      edges: { where: { deleted: false }, select: { id: true, sourceId: true } },
      thresholdEvents: { where: { deleted: false }, select: { id: true } },
    },
  })

  console.log(`\n=== openFDA Auto-Approval Backfill ===`)
  console.log(`Found ${candidates.length} unreviewed openFDA claim(s)\n`)

  let autoApproved = 0
  let skipped = 0

  for (const claim of candidates) {
    const appNum = claim.externalId ?? 'UNKNOWN'
    const displayName = extractDisplayName(claim.text)

    // Gate 1 — real name
    if (appNum !== 'UNKNOWN' && claim.text.startsWith(appNum)) {
      console.log(`  Skipped (failed gate 1 — no brand/generic name): ${appNum}`)
      skipped++
      continue
    }

    // Gate 2 — has source
    if (claim.edges.length === 0) {
      console.log(`  Skipped (failed gate 2 — no sources linked): ${appNum}`)
      skipped++
      continue
    }

    // Gate 3 — has threshold event
    if (claim.thresholdEvents.length === 0) {
      console.log(`  Skipped (failed gate 3 — no threshold event): ${appNum}`)
      skipped++
      continue
    }

    // Gate 4 — has approval date
    if (!claim.claimEmergedAt) {
      console.log(`  Skipped (failed gate 4 — no approval date): ${appNum}`)
      skipped++
      continue
    }

    // All gates passed — approve in a single transaction
    try {
      await prisma.$transaction(async tx => {
        const reviewFields = {
          humanReviewed:    true,
          reviewedBy:       'openfda_v1_auto_backfill',
          reviewedAt:       now,
          reviewConfidence: 'MEDIUM' as const,
          autoApproved:     true,
        }

        await tx.claim.update({ where: { id: claim.id }, data: reviewFields })

        const sourceIds = [...new Set(claim.edges.map(e => e.sourceId))]
        if (sourceIds.length > 0) {
          await tx.source.updateMany({ where: { id: { in: sourceIds } }, data: reviewFields })
        }

        if (claim.edges.length > 0) {
          await tx.edge.updateMany({
            where: { id: { in: claim.edges.map(e => e.id) } },
            data: reviewFields,
          })
        }

        if (claim.thresholdEvents.length > 0) {
          await tx.thresholdEvent.updateMany({
            where: { id: { in: claim.thresholdEvents.map(te => te.id) } },
            data: reviewFields,
          })
        }
      })

      console.log(`  Auto-approved: ${appNum} — ${displayName}`)
      autoApproved++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Error: ${appNum} — ${msg}`)
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Processed    : ${candidates.length}`)
  console.log(`  Auto-approved: ${autoApproved}`)
  console.log(`  Skipped      : ${skipped}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
