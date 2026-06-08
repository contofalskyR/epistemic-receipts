// Backfill MemberVote.memberName with "First Last" form for House members
// whose names were ingested as just the last name (House Clerk XML behavior).
//
// Source: Voteview HSall_members.csv (bioguide_id → bioname "LAST, First M.")
//
// Run:
//   curl -L https://voteview.com/static/data/out/members/HSall_members.csv -o /tmp/hsall_members.csv
//   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-member-fullnames.ts --dry-run
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-member-fullnames.ts
//
// Idempotent: skips rows where memberName already contains a space.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { parse as csvParse } from 'csv-parse/sync'
import * as fs from 'fs'

const prisma = new PrismaClient()
const CSV_PATH = '/tmp/hsall_members.csv'

// "PELOSI, Nancy" → "Nancy Pelosi"; "ALEXANDER, James M." → "James M. Alexander"
function bionameToDisplay(bioname: string): string | null {
  const trimmed = bioname.trim()
  const comma = trimmed.indexOf(',')
  if (comma < 0) return null
  const last = trimmed.slice(0, comma).trim()
  const rest = trimmed.slice(comma + 1).trim()
  if (!last || !rest) return null
  // Title-case the last name (CSV stores it ALL CAPS).
  const lastTitle = last
    .toLowerCase()
    .split(/(\s|-)/)
    .map(p => (p.length > 1 ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join('')
  return `${rest} ${lastTitle}`
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.env.ALLOW_EDITS !== 'true'

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Missing ${CSV_PATH}. Download with:\n  curl -L https://voteview.com/static/data/out/members/HSall_members.csv -o ${CSV_PATH}`)
  }

  const csvText = fs.readFileSync(CSV_PATH, 'utf8')
  type Row = { bioguide_id: string; bioname: string }
  const rows = csvParse(csvText, { columns: true, skip_empty_lines: true }) as Row[]

  const bioguideToDisplay = new Map<string, string>()
  for (const r of rows) {
    if (!r.bioguide_id || !r.bioname) continue
    const display = bionameToDisplay(r.bioname)
    if (display) bioguideToDisplay.set(r.bioguide_id, display)
  }
  console.log(`Loaded ${bioguideToDisplay.size} bioguide → display names from CSV`)

  // Find distinct member IDs whose current memberName has no space (single token).
  const distinctRows = await prisma.$queryRaw<{ memberId: string; memberName: string }[]>`
    SELECT DISTINCT "memberId", "memberName"
    FROM "MemberVote"
    WHERE "memberId" IS NOT NULL
      AND "memberName" NOT LIKE '% %'
  `
  console.log(`Found ${distinctRows.length} distinct (memberId, single-token name) pairs`)

  let updated = 0
  let skippedNoMatch = 0
  let skippedSameName = 0

  for (const row of distinctRows) {
    const target = bioguideToDisplay.get(row.memberId)
    if (!target) {
      skippedNoMatch++
      continue
    }
    if (target === row.memberName) {
      skippedSameName++
      continue
    }
    if (dryRun) {
      if (updated < 10) {
        console.log(`  [dry-run] ${row.memberId}: "${row.memberName}" → "${target}"`)
      }
      updated++
      continue
    }
    const res = await prisma.memberVote.updateMany({
      where: { memberId: row.memberId, memberName: row.memberName },
      data: { memberName: target },
    })
    updated++
    if (updated % 100 === 0) console.log(`  updated ${updated} so far (last: ${row.memberId} → ${target}, ${res.count} rows)`)
  }

  console.log(`\nResults: ${dryRun ? 'DRY RUN — ' : ''}updated_members=${updated} no_csv_match=${skippedNoMatch} already_correct=${skippedSameName}`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
