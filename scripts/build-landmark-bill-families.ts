// Derives data/landmark-bill-families.json from the Voteview HSall_rollcalls.csv.
//
// The DB stores no bill_number (Source has no metadata column), so bill-family
// grouping for member-reversal detection is keyed here instead: for each entry in
// data/landmark-rollcalls.json, look up its (congress, chamber, rollnumber) row in
// the canonical Voteview rollcalls CSV and record the exact bill_number. Family
// key = congress + chamber-agnostic normalized bill number. Exact match only —
// entries with an empty bill_number are omitted (no title/fuzzy fallback, ever).
//
// Run: npx tsx scripts/build-landmark-bill-families.ts /path/to/HSall_rollcalls.csv
// Output is deterministic; commit the JSON alongside landmark-rollcalls.json.

import * as fs from 'fs'
import { join } from 'path'
import { parse as csvParse } from 'csv-parse/sync'

interface SubsetEntry {
  externalId: string
  legislativeVoteId: string
}

function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/build-landmark-bill-families.ts <HSall_rollcalls.csv>')
    process.exit(1)
  }

  const subset: SubsetEntry[] = JSON.parse(
    fs.readFileSync(join(process.cwd(), 'data/landmark-rollcalls.json'), 'utf-8'),
  )
  const wanted = new Set(subset.map(e => e.externalId))

  const rows = csvParse(fs.readFileSync(csvPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  }) as { congress: string; chamber: string; rollnumber: string; bill_number: string; vote_question: string }[]

  // externalId format matches scripts/ingest-voteview.ts buildExternalId()
  const billByExternalId = new Map<string, { bill: string; question: string }>()
  for (const r of rows) {
    const code = r.chamber === 'Senate' ? 's' : 'h'
    const extId = `voteview_source_${r.congress}_${code}_${r.rollnumber}`
    if (!wanted.has(extId)) continue
    const bill = (r.bill_number || '').trim()
    if (!bill) continue
    billByExternalId.set(extId, { bill, question: (r.vote_question || '').trim() })
  }

  const out = subset
    .filter(e => billByExternalId.has(e.externalId))
    .map(e => ({
      externalId: e.externalId,
      legislativeVoteId: e.legislativeVoteId,
      billNumber: billByExternalId.get(e.externalId)!.bill,
      voteQuestion: billByExternalId.get(e.externalId)!.question,
    }))

  const outPath = join(process.cwd(), 'data/landmark-bill-families.json')
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(`Subset entries: ${subset.length}`)
  console.log(`With bill_number: ${out.length} (omitted: ${subset.length - out.length})`)

  // Family stats: same congress + same exact bill number
  const fam = new Map<string, number>()
  for (const e of out) {
    const congress = e.externalId.split('_')[2]
    const key = `${congress}::${e.billNumber.toUpperCase().replace(/\s+/g, '')}`
    fam.set(key, (fam.get(key) ?? 0) + 1)
  }
  const multi = [...fam.values()].filter(n => n > 1)
  console.log(`Bill families: ${fam.size} | with 2+ landmark rollcalls: ${multi.length} (${multi.reduce((a, b) => a + b, 0)} rollcalls)`)
}

main()
