/**
 * fix-citation-mismatches.ts
 *
 * Fixes source→claim edges where the source paper has zero keyword overlap
 * with the claim it supposedly supports.
 *
 * Actions:
 *   - Score=0 PubMed entries (50): mark Edge as deleted (paper is clearly wrong source for this claim)
 *   - Score=0 DOI entries where claim is NOT a retraction notice: mark Edge as deleted
 *   - Score>0 entries: skip (borderline, might be legitimate)
 *   - Retraction DOIs: skip (claim IS the retraction notice)
 *
 * Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/fix-citation-mismatches.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as csv from 'csv-parse/sync'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const SIGNAL_CSV = path.join(__dirname, 'citation-mismatches-signal.csv')

function isRetractionClaim(claimText: string): boolean {
  const lower = claimText.toLowerCase()
  return lower.includes('retract') || lower.includes('this article') && lower.includes('erratum')
}

async function main() {
  console.log(`=== fix-citation-mismatches.ts (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ===`)

  const raw = fs.readFileSync(SIGNAL_CSV, 'utf-8')
  const rows = csv.parse(raw, { columns: true, skip_empty_lines: true }) as Array<{
    source_id: string
    url: string
    fetched_title: string
    claim_id: string
    claim_text: string
    overlap_score: string
    note: string
  }>

  const toFix: { sourceId: string; claimId: string; url: string; reason: string }[] = []

  for (const row of rows) {
    const score = parseFloat(row.overlap_score)
    const isPubMed = row.note.includes('PubMed')
    const isDOI = row.note.includes('DOI')

    if (isPubMed && score === 0) {
      // Score=0 PubMed: source paper has no keywords in common with claim — wrong citation
      toFix.push({
        sourceId: row.source_id,
        claimId: row.claim_id,
        url: row.url,
        reason: `PubMed score=0: "${row.fetched_title.slice(0, 60)}" vs claim "${row.claim_text.slice(0, 60)}"`,
      })
    } else if (isDOI && score === 0 && !isRetractionClaim(row.claim_text)) {
      // Score=0 DOI that is NOT a retraction claim
      toFix.push({
        sourceId: row.source_id,
        claimId: row.claim_id,
        url: row.url,
        reason: `DOI score=0: "${row.fetched_title.slice(0, 60)}" vs claim "${row.claim_text.slice(0, 60)}"`,
      })
    }
  }

  console.log(`\nEntries to fix: ${toFix.length}`)
  for (const item of toFix) {
    console.log(`  source=${item.sourceId} claim=${item.claimId}`)
    console.log(`    ${item.reason}`)
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made.')
    return
  }

  let fixed = 0
  let notFound = 0

  for (const item of toFix) {
    // Find the Edge connecting this source to this claim
    const edge = await prisma.edge.findFirst({
      where: {
        sourceId: item.sourceId,
        claimId: item.claimId,
        deleted: false,
      },
    })

    if (!edge) {
      console.log(`  NOT FOUND: source=${item.sourceId} claim=${item.claimId}`)
      notFound++
      continue
    }

    await prisma.edge.update({
      where: { id: edge.id },
      data: { deleted: true },
    })
    fixed++
  }

  console.log(`\nFixed: ${fixed} edges marked as deleted`)
  if (notFound > 0) console.log(`Not found (already deleted?): ${notFound}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
