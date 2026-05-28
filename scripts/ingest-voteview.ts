// Pipeline — Voteview Congressional Roll Call Votes (voteview_v1)
// Dataset: UCLA Voteview (voteview.com) — all US congressional roll call votes 1789–present
// Source CSV: /tmp/voteview/HSall_rollcalls.csv
//   curl -L https://voteview.com/static/data/out/rollcalls/HSall_rollcalls.csv -o /tmp/voteview/HSall_rollcalls.csv
// Creates: Source + LegislativeVote records (one pair per roll call)
// Run: npx tsx scripts/ingest-voteview.ts --congress 118
//      npx tsx scripts/ingest-voteview.ts --congress 118 --limit 5000
//      npx tsx scripts/ingest-voteview.ts --all
//      npx tsx scripts/ingest-voteview.ts --dry-run --congress 118

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { parse as csvParse } from 'csv-parse/sync'

const prisma = new PrismaClient()

const INGESTED_BY = 'voteview_v1'
const BATCH_SIZE = 1000
const CSV_PATH = '/tmp/voteview/HSall_rollcalls.csv'

interface RollcallRow {
  congress: string
  chamber: string
  rollnumber: string
  date: string
  session: string
  clerk_rollnumber: string
  yea_count: string
  nay_count: string
  nominate_mid_1: string
  nominate_mid_2: string
  nominate_spread_1: string
  nominate_spread_2: string
  nominate_log_likelihood: string
  bill_number: string
  vote_result: string
  vote_desc: string
  vote_question: string
  dtl_desc: string
  [key: string]: string
}

type Counts = { inserted: number; skipped: number }

function chamberCode(chamber: string): string {
  return chamber === 'Senate' ? 's' : 'h'
}

function chamberFull(chamber: string): string {
  return chamber === 'Senate' ? 'Senate' : 'House of Representatives'
}

function inferResult(yea: number, nay: number): string {
  if (yea > nay) return 'passed'
  if (nay > yea) return 'failed'
  if (yea > 0 && yea === nay) return 'tied'
  return 'unknown'
}

function buildTitle(row: RollcallRow): string {
  const desc = (row.dtl_desc || row.vote_desc || row.vote_question || '').trim()
  if (desc) return desc.slice(0, 500)
  const bill = (row.bill_number || '').trim()
  if (bill) return `${row.chamber} Roll Call ${row.rollnumber} — ${bill}`
  return `${row.chamber} Roll Call ${row.rollnumber} (${row.congress}th Congress)`
}

function buildExternalId(r: RollcallRow): string {
  return `voteview_source_${r.congress}_${chamberCode(r.chamber)}_${r.rollnumber}`
}

async function processChunk(rows: RollcallRow[], dryRun: boolean): Promise<Counts> {
  const externalIds = rows.map(buildExternalId)

  // Identify which sources already exist (and whether they have a vote attached)
  const existingSources = await prisma.source.findMany({
    where: { externalId: { in: externalIds } },
    select: { id: true, externalId: true, legislativeVotes: { select: { id: true } } },
  })
  const existingExtIds = new Set(existingSources.map(s => s.externalId!))
  const alreadyHasVote = new Set(
    existingSources.filter(s => s.legislativeVotes.length > 0).map(s => s.externalId!),
  )

  const newRows = rows.filter(r => !existingExtIds.has(buildExternalId(r)))
  const skipped = rows.length - newRows.length

  if (dryRun) {
    return { inserted: newRows.length, skipped }
  }

  // Create Source records for new rows
  if (newRows.length > 0) {
    await prisma.source.createMany({
      data: newRows.map(r => ({
        name: buildTitle(r),
        url: `https://voteview.com/rollcall/${r.congress}/${chamberCode(r.chamber)}/${r.rollnumber}`,
        publishedAt: r.date?.trim() ? new Date(r.date.trim()) : null,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        externalId: buildExternalId(r),
        autoApproved: true,
      })),
      skipDuplicates: true,
    })
  }

  // Build row lookup
  const rowMap = new Map(rows.map(r => [buildExternalId(r), r]))

  // Target sources = new ones + existing ones that somehow lack a LegislativeVote
  const targetExtIds = [
    ...newRows.map(buildExternalId),
    ...existingSources.filter(s => !alreadyHasVote.has(s.externalId!)).map(s => s.externalId!),
  ]

  if (targetExtIds.length === 0) return { inserted: 0, skipped: rows.length }

  const targetSources = await prisma.source.findMany({
    where: { externalId: { in: targetExtIds } },
    select: { id: true, externalId: true },
  })

  const voteData = targetSources.map(s => {
    const r = rowMap.get(s.externalId!)!
    const yea = parseInt(r.yea_count) || 0
    const nay = parseInt(r.nay_count) || 0
    return {
      sourceId: s.id,
      chamber: chamberFull(r.chamber),
      yesCount: yea,
      noCount: nay,
      voteDate: r.date?.trim() ? new Date(r.date.trim()) : null,
      passageType: 'legislative_vote',
      passageThreshold: 'simple_majority',
      result: inferResult(yea, nay),
      dataSource: INGESTED_BY,
    }
  })

  if (voteData.length > 0) {
    await prisma.legislativeVote.createMany({ data: voteData })
  }

  return { inserted: newRows.length, skipped }
}

async function main() {
  const args = process.argv.slice(2)

  const getArg = (flag: string): string | null => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? (args[idx + 1] ?? null) : null
  }

  const congressFilter = getArg('--congress') != null ? parseInt(getArg('--congress')!) : null
  const limitArg = getArg('--limit')
  const limit = args.includes('--all') ? Infinity : limitArg ? parseInt(limitArg) : 10000
  const dryRun = args.includes('--dry-run')

  console.log(`\nVoteview Ingest — ${INGESTED_BY}`)
  console.log(`  congress: ${congressFilter ?? 'all'}`)
  console.log(`  limit:    ${limit === Infinity ? 'all' : limit}`)
  console.log(`  dry-run:  ${dryRun}\n`)

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`)
    console.error(`Run: mkdir -p /tmp/voteview && curl -L https://voteview.com/static/data/out/rollcalls/HSall_rollcalls.csv -o ${CSV_PATH}`)
    process.exit(1)
  }

  console.log('Parsing CSV...')
  const raw = fs.readFileSync(CSV_PATH)
  const allRows: RollcallRow[] = csvParse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  })
  console.log(`  Total CSV rows: ${allRows.length}`)

  let rows = congressFilter != null
    ? allRows.filter(r => parseInt(r.congress) === congressFilter)
    : allRows

  if (limit !== Infinity) rows = rows.slice(0, limit)
  console.log(`  After filter/limit: ${rows.length}\n`)

  let totalInserted = 0
  let totalSkipped = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const { inserted, skipped } = await processChunk(chunk, dryRun)
    totalInserted += inserted
    totalSkipped += skipped

    const processed = Math.min(i + BATCH_SIZE, rows.length)
    if (processed % 1000 === 0 || processed === rows.length) {
      console.log(`  ${processed}/${rows.length} — inserted: ${totalInserted} skipped: ${totalSkipped}`)
    }
  }

  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbVotes = await prisma.legislativeVote.count({ where: { dataSource: INGESTED_BY } })

  console.log(`\nDone${dryRun ? ' (dry-run — no writes)' : ''}.`)
  console.log(`  Inserted this run:  ${totalInserted}`)
  console.log(`  Skipped (existed):  ${totalSkipped}`)
  console.log(`  ${INGESTED_BY} Sources in DB:          ${dbSources}`)
  console.log(`  ${INGESTED_BY} LegislativeVotes in DB: ${dbVotes}`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
